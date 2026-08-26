import sys
import os
import time

# Add parent dir to sys.path to run directly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import init_db, SessionLocal, DocumentDB, QueryDB, ActivityLogDB
from app.rag.chunker import SentenceAwareChunker
from app.rag.vector_store import VectorStoreManager
from app.rag.query_engine import QueryEngine

def run_test():
    print("=========================================")
    print("JARVIS - RUNNING RAG SYSTEM INTEGRATION TEST")
    print("=========================================")
    
    # 1. Initialize SQLite
    print("\n1. Initializing SQLite Database...")
    init_db()
    db = SessionLocal()
    print("-> SQLite loaded successfully.")
    
    # 2. Set up documents metadata
    print("\n2. Seeding Test Document...")
    test_doc = db.query(DocumentDB).filter(DocumentDB.filename == "test_rules.txt").first()
    if test_doc:
        print("-> Test document metadata already exists in SQLite. Cleaning vectors...")
        vstore = VectorStoreManager()
        vstore.delete_document_vectors(test_doc.id)
        db.delete(test_doc)
        db.commit()
        
    test_doc = DocumentDB(
        filename="test_rules.txt",
        file_type="TXT",
        file_size=1024,
        status="Uploaded",
        chunk_count=0
    )
    db.add(test_doc)
    db.commit()
    db.refresh(test_doc)
    print(f"-> Created document ID: {test_doc.id}")

    # 3. Simulate Chunking
    print("\n3. Testing Sentence-Aware Chunking...")
    sample_text = (
        "JARVIS is an Intelligent Knowledge Assistant. It processes local files to ground answer generation. "
        "The attendance rules specify that students must maintain at least 75% attendance. "
        "Failure to satisfy the attendance threshold will prevent students from writing final examinations. "
        "Medical leaves are supported if submitted with signed doctor slips within 48 hours of return."
    )
    chunks = SentenceAwareChunker.chunk_text(sample_text, chunk_size=200, chunk_overlap=30)
    print(f"-> Generated {len(chunks)} text chunks:")
    for c in chunks:
        print(f"   [Chunk #{c['chunk_index']}]: '{c['text']}'")
        
    # 4. Ingest Chunks in ChromaDB
    print("\n4. Testing Persistent Vector Store (ChromaDB + sentence-transformers)...")
    vstore = VectorStoreManager()
    vstore.add_chunks(test_doc.id, test_doc.filename, chunks)
    
    test_doc.status = "Indexed"
    test_doc.chunk_count = len(chunks)
    db.commit()
    print("-> Chunks embedded and uploaded to ChromaDB collection successfully.")
    
    # 5. Query Engine Retrieval Confidence Test
    print("\n5. Testing Similarity Query Engine...")
    qengine = QueryEngine(vstore)
    
    # Positive Match: question closely aligned with chunks
    q1 = "What is the attendance threshold?"
    print(f"-> Question: '{q1}'")
    res1 = vstore.query(q1, top_k=2)
    print("-> Retrieved matches:")
    for match in res1:
        print(f"   Score: {match['similarity']} | Text: '{match['text']}'")
    
    # Negative Match: question completely unrelated to chunks
    q2 = "What is the capital of France?"
    print(f"\n-> Unrelated Question: '{q2}'")
    res2 = qengine.query(q2, similarity_threshold=0.40)
    print(f"-> QueryEngine Answer: '{res2['answer']}'")
    print(f"-> Citations count: {len(res2['sources'])}")
    
    db.close()
    print("\n=========================================")
    print("RAG SYSTEM INTEGRATION TEST COMPLETED")
    print("=========================================")

if __name__ == "__main__":
    run_test()
