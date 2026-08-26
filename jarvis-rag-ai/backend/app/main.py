import os
import shutil
import time
import json
from typing import Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

from app.config import settings
from app.database import (
    init_db, get_db, DocumentDB, QueryDB, ActivityLogDB, SystemSettingDB, SessionLocal
)
from app.rag.loader import DocumentLoader
from app.rag.chunker import SentenceAwareChunker
from app.rag.vector_store import VectorStoreManager
from app.rag.query_engine import QueryEngine

# Initialize database tables and defaults
init_db()

app = FastAPI(title="JARVIS AI - RAG Knowledge Assistant API")

# Setup CORS for Frontend Dev Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG Singletons
vector_store = VectorStoreManager()
query_engine = QueryEngine(vector_store)

# Helper function to get current runtime settings from database
def get_system_settings(db: Session) -> Dict[str, Any]:
    rows = db.query(SystemSettingDB).all()
    setting_map = {}
    for r in rows:
        # Convert numeric settings
        if r.key in ["chunk_size", "chunk_overlap", "top_k"]:
            setting_map[r.key] = int(r.value)
        elif r.key in ["similarity_threshold", "temperature"]:
            setting_map[r.key] = float(r.value)
        elif r.key in ["max_tokens"]:
            setting_map[r.key] = int(r.value)
        else:
            setting_map[r.key] = r.value
    return setting_map

def log_activity(db: Session, message: str, activity_type: str = "INFO"):
    log = ActivityLogDB(message=message, activity_type=activity_type)
    db.add(log)
    db.commit()

# --- Background Task for Document Indexing ---
def process_document_task(doc_id: int, file_path: str, filename: str):
    # A new DB session for background thread
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # 1. Update status to Processing
        doc = db.query(DocumentDB).filter(DocumentDB.id == doc_id).first()
        if not doc:
            return
        doc.status = "Processing"
        db.commit()
        log_activity(db, f"Started processing document: '{filename}'", "INFO")
        
        # 2. Extract Text
        text = DocumentLoader.load_document(file_path)
        if not text.strip():
            raise ValueError("No text could be extracted from document.")
            
        # 3. Fetch current chunk settings
        configs = get_system_settings(db)
        chunk_size = configs.get("chunk_size", settings.DEFAULT_CHUNK_SIZE)
        chunk_overlap = configs.get("chunk_overlap", settings.DEFAULT_CHUNK_OVERLAP)
        
        # 4. Chunk text
        chunks = SentenceAwareChunker.chunk_text(text, chunk_size, chunk_overlap)
        
        # 5. Add to vector store
        vector_store.add_chunks(doc_id, filename, chunks)
        
        # 6. Update database record
        doc.status = "Indexed"
        doc.chunk_count = len(chunks)
        db.commit()
        log_activity(db, f"Successfully indexed '{filename}' with {len(chunks)} chunks.", "SUCCESS")
        
    except Exception as e:
        db.rollback()
        doc = db.query(DocumentDB).filter(DocumentDB.id == doc_id).first()
        if doc:
            doc.status = "Failed"
            db.commit()
        log_activity(db, f"Failed to index '{filename}': {str(e)}", "ERROR")
    finally:
        db.close()


# --- API ENDPOINTS ---

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    # 1. Check SQLite
    sqlite_ok = False
    try:
        db.execute(text("SELECT 1"))
        sqlite_ok = True
    except Exception:
        pass

    # 2. Check Ollama
    ollama_ok = False
    ollama_error = ""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags", timeout=2.0)
            if resp.status_code == 200:
                ollama_ok = True
            else:
                ollama_error = f"Ollama HTTP {resp.status_code}"
    except Exception as e:
        ollama_error = str(e)

    # 3. Check ChromaDB
    chroma_ok = False
    try:
        vector_store.client.heartbeat()
        chroma_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if (sqlite_ok and chroma_ok) else "degraded",
        "sqlite": "online" if sqlite_ok else "offline",
        "chroma": "online" if chroma_ok else "offline",
        "ollama": {
            "status": "online" if ollama_ok else "offline",
            "error": ollama_error if not ollama_ok else None
        }
    }


@app.post("/api/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    filename = file.filename
    _, ext = os.path.splitext(filename.lower())
    if ext not in ['.pdf', '.txt', '.docx']:
        raise HTTPException(status_code=400, detail="Unsupported file format. Only PDF, TXT and DOCX are allowed.")
        
    # Save file to upload directory
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Avoid duplicate file uploads causing overwrite conflict
    base_name, extension = os.path.splitext(filename)
    counter = 1
    while os.path.exists(file_path):
        filename = f"{base_name}_{counter}{extension}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        counter += 1

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file to disk: {str(e)}")

    file_size = os.path.getsize(file_path)

    # Insert document metadata in sqlite
    new_doc = DocumentDB(
        filename=filename,
        file_type=ext[1:].upper(),
        file_size=file_size,
        status="Uploaded",
        chunk_count=0
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    log_activity(db, f"Uploaded document: '{filename}' ({file_size} bytes)", "INFO")

    # Queue RAG indexing in the background
    background_tasks.add_task(process_document_task, new_doc.id, file_path, filename)

    return {
        "message": "File uploaded and processing started in background.",
        "document": {
            "id": new_doc.id,
            "filename": new_doc.filename,
            "file_type": new_doc.file_type,
            "file_size": new_doc.file_size,
            "status": new_doc.status
        }
    }


@app.post("/api/documents/url")
async def ingest_url(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required.")
        
    # Simple URL parsing/normalization for filename
    try:
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format.")
        
    try:
        # Fetch the URL content
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=15.0, follow_redirects=True)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch URL. Status code: {response.status_code}")
            html_content = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching URL: {str(e)}")
        
    # Strip HTML tags
    import re
    # Remove script and style elements
    text = re.sub(r'<(script|style)\b[^>]*>([\s\S]*?)<\/\1>', ' ', html_content)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    if not text:
        raise HTTPException(status_code=400, detail="No readable text content extracted from website.")
        
    # Write to a txt file
    domain = parsed_url.netloc.replace(":", "_").replace(".", "_")
    path_suffix = parsed_url.path.strip("/").replace("/", "_")
    path_suffix = f"_{path_suffix}" if path_suffix else ""
    filename = f"web_{domain}{path_suffix}_{int(time.time())}.txt"
    
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    try:
        with open(file_path, "w", encoding="utf-8", errors="ignore") as f:
            f.write(f"Website Source: {url}\n\n" + text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write website contents to disk: {str(e)}")
        
    file_size = os.path.getsize(file_path)
    
    # Insert document metadata
    new_doc = DocumentDB(
        filename=filename,
        file_type="WEBSITE",
        file_size=file_size,
        status="Uploaded",
        chunk_count=0
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    log_activity(db, f"Ingested website content from: {url}", "INFO")
    
    background_tasks.add_task(process_document_task, new_doc.id, file_path, filename)
    
    return {
        "message": "Website content successfully fetched and queued for indexing.",
        "document": {
            "id": new_doc.id,
            "filename": filename,
            "file_type": "WEBSITE",
            "file_size": file_size,
            "status": new_doc.status
        }
    }


@app.post("/api/documents/database")
async def ingest_database_data(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_name = payload.get("db_name", "Database_Export")
    table_name = payload.get("table_name", "records")
    text_content = payload.get("text_content")
    
    if not text_content or not text_content.strip():
        raise HTTPException(status_code=400, detail="Database text content is empty.")
        
    # Create a text file name
    safe_db_name = "".join([c if c.isalnum() else "_" for c in db_name])
    safe_table_name = "".join([c if c.isalnum() else "_" for c in table_name])
    filename = f"db_{safe_db_name}_{safe_table_name}_{int(time.time())}.txt"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(text_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write DB export to disk: {str(e)}")
        
    file_size = os.path.getsize(file_path)
    
    # Insert document metadata
    new_doc = DocumentDB(
        filename=filename,
        file_type="DB_TABLE",
        file_size=file_size,
        status="Uploaded",
        chunk_count=0
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    log_activity(db, f"Ingested database table '{table_name}' from '{db_name}'", "INFO")
    
    background_tasks.add_task(process_document_task, new_doc.id, file_path, filename)
    
    return {
        "message": f"Database table '{table_name}' successfully ingested.",
        "document": {
            "id": new_doc.id,
            "filename": filename,
            "file_type": "DB_TABLE",
            "file_size": file_size,
            "status": new_doc.status
        }
    }


@app.get("/api/documents")
async def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentDB).order_by(DocumentDB.upload_time.desc()).all()
    return docs


@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Delete physical file
    file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    # Delete vector embeddings from Chroma
    try:
        vector_store.delete_document_vectors(document_id)
    except Exception as e:
        log_activity(db, f"Error deleting vectors for '{doc.filename}': {str(e)}", "WARNING")

    # Delete database record
    filename = doc.filename
    db.delete(doc)
    db.commit()

    log_activity(db, f"Deleted document '{filename}' from system.", "INFO")
    return {"message": f"Document '{filename}' successfully deleted."}


@app.post("/api/documents/process")
async def reprocess_documents(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Triggers re-indexing for all Failed or Uploaded documents."""
    docs = db.query(DocumentDB).filter(DocumentDB.status.in_(["Failed", "Uploaded"])).all()
    count = 0
    for doc in docs:
        file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
        if os.path.exists(file_path):
            background_tasks.add_task(process_document_task, doc.id, file_path, doc.filename)
            count += 1
            
    return {"message": f"Re-processing started for {count} documents."}


@app.post("/api/chat")
async def chat_with_jarvis(
    request: dict, # Using dict to bypass Pydantic import issues if strict types are not matching
    db: Session = Depends(get_db)
):
    question = request.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    # 1. Fetch system configs
    configs = get_system_settings(db)
    
    top_k = configs.get("top_k", settings.DEFAULT_TOP_K)
    similarity_threshold = configs.get("similarity_threshold", settings.DEFAULT_SIMILARITY_THRESHOLD)
    temperature = configs.get("temperature", 0.1)
    max_tokens = configs.get("max_tokens", 1024)
    
    llm_provider = configs.get("llm_provider", "ollama")
    api_key = ""
    if llm_provider == "gemini":
        model_name = configs.get("gemini_model", "gemini-1.5-flash")
        api_key = configs.get("gemini_api_key", "")
    elif llm_provider == "openai":
        model_name = configs.get("openai_model", "gpt-4o-mini")
        api_key = configs.get("openai_api_key", "")
    else:
        model_name = configs.get("llm_model", settings.DEFAULT_LLM_MODEL)

    # We return a StreamingResponse that streams JSON data events
    async def response_generator():
        start_time = time.time()
        complete_answer = []
        sources = []
        
        # Run streaming query
        try:
            # We fetch stream tokens
            stream = query_engine.query_stream(
                question=question,
                top_k=top_k,
                similarity_threshold=similarity_threshold,
                llm_provider=llm_provider,
                model_name=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key
            )
            
            for event in stream:
                if event["type"] == "metadata":
                    sources = event["sources"]
                    yield f"event: metadata\ndata: {json.dumps({'sources': sources})}\n\n"
                elif event["type"] == "content":
                    delta = event["delta"]
                    complete_answer.append(delta)
                    yield f"event: content\ndata: {json.dumps({'delta': delta})}\n\n"
                    
            # Complete execution logs in DB
            response_time_ms = int((time.time() - start_time) * 1000)
            full_answer = "".join(complete_answer)
            
            # Find best similarity score
            best_score = max([s["score"] for s in sources]) if sources else 0.0
            
            # Log question to database
            db_query = QueryDB(
                question=question,
                answer=full_answer,
                response_time_ms=response_time_ms,
                similarity_score=best_score
            )
            db_session = SessionLocal() # Use a fresh thread-safe session
            try:
                db_session.add(db_query)
                log_msg = f"User asked: '{question[:40]}...'. Answered in {response_time_ms}ms (Similarity: {best_score})"
                db_session.add(ActivityLogDB(message=log_msg, activity_type="INFO"))
                db_session.commit()
            except Exception:
                db_session.rollback()
            finally:
                db_session.close()

            yield "event: end\ndata: {}\n\n"
            
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    # Set media type as text/event-stream for server-sent events (SSE)
    return StreamingResponse(response_generator(), media_type="text/event-stream")


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    # Total documents count
    doc_count = db.query(DocumentDB).count()
    
    # Total chunks count (sum of chunks)
    # Filter documents that are indexed
    total_chunks = 0
    docs = db.query(DocumentDB).filter(DocumentDB.status == "Indexed").all()
    for d in docs:
        total_chunks += d.chunk_count

    # Total questions answered
    questions_count = db.query(QueryDB).count()

    # Ollama status & Model name
    configs = get_system_settings(db)
    llm_provider = configs.get("llm_provider", "ollama")
    if llm_provider == "gemini":
        active_model = configs.get("gemini_model", "gemini-1.5-flash")
    elif llm_provider == "openai":
        active_model = configs.get("openai_model", "gpt-4o-mini")
    else:
        active_model = configs.get("llm_model", settings.DEFAULT_LLM_MODEL)
    
    ollama_status = "Offline"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags", timeout=1.0)
            if resp.status_code == 200:
                ollama_status = "Online"
    except Exception:
        pass

    return {
        "total_documents": doc_count,
        "total_chunks": total_chunks,
        "total_questions": questions_count,
        "ollama_status": ollama_status,
        "active_model": active_model
    }


@app.get("/api/activity")
async def get_activity_logs(db: Session = Depends(get_db), limit: int = 15):
    logs = db.query(ActivityLogDB).order_by(ActivityLogDB.timestamp.desc()).limit(limit).all()
    return logs


@app.get("/api/settings")
async def get_settings(db: Session = Depends(get_db)):
    # Return active DB settings
    settings_dict = get_system_settings(db)
    
    # Query Ollama available models dynamically to fill settings dropdown
    ollama_models = []
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.OLLAMA_HOST}/api/tags", timeout=2.0)
            if resp.status_code == 200:
                models_data = resp.json().get("models", [])
                ollama_models = [m["name"] for m in models_data]
    except Exception:
        pass

    # Ensure current model is in list
    if settings_dict.get("llm_model") not in ollama_models and settings_dict.get("llm_model"):
        ollama_models.append(settings_dict.get("llm_model"))
        
    return {
        "settings": settings_dict,
        "available_models": ollama_models
    }


@app.put("/api/settings")
async def update_settings(payload: Dict[str, str], db: Session = Depends(get_db)):
    # Payload matches key-value pairs
    for k, v in payload.items():
        existing = db.query(SystemSettingDB).filter(SystemSettingDB.key == k).first()
        if existing:
            existing.value = str(v)
        else:
            db.add(SystemSettingDB(key=k, value=str(v)))
    
    db.commit()
    log_activity(db, "System settings updated.", "INFO")
    return {"message": "Settings updated successfully."}


@app.get("/api/knowledge-graph")
async def get_knowledge_graph():
    """Returns vector nodes coordinates for 3D visualization graph."""
    raw_chunks = vector_store.get_all_chunks()
    nodes = []
    
    # We project the sentence-transformer embeddings (384 dimensions) into mock 3D space (X, Y, Z)
    # Using simple PCA-like projection or indexing to scatter nicely
    for chunk in raw_chunks:
        emb = chunk["embedding"]
        meta = chunk["metadata"]
        
        # Simple projection from embedding vector values
        # Sum portions of embedding to get pseudo-coordinates in range [-10, 10]
        x = sum(emb[0:128]) * 15.0 if emb else 0.0
        y = sum(emb[128:256]) * 15.0 if emb else 0.0
        z = sum(emb[256:384]) * 15.0 if emb else 0.0
        
        nodes.append({
            "id": chunk["id"],
            "filename": meta.get("filename", "unknown"),
            "chunk_index": meta.get("chunk_index", 0),
            "text": chunk["text"][:150] + "...",
            "x": round(x, 3),
            "y": round(y, 3),
            "z": round(z, 3)
        })
        
    return {"nodes": nodes}
