import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
from app.config import settings

class VectorStoreManager:
    def __init__(self):
        # Initialize Persistent Chroma DB Client
        self.client = chromadb.PersistentClient(path=settings.CHROMA_DIR)
        
        # Initialize Hugging Face sentence-transformers model
        # Loaded lazily when first needed to speed up application boot
        self._model = None
        self.collection_name = "jarvis_knowledge_base"
        
        # Create or get collection using Cosine Similarity space
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}  # Cosine distance = 1 - Cosine Similarity
        )

    @property
    def model(self):
        """Loads and returns the sentence-transformer model lazily."""
        if self._model is None:
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        return self._model

    def add_chunks(self, document_id: int, filename: str, chunks: List[Dict[str, Any]]):
        """Generates embeddings for chunks and adds them to Chroma DB."""
        if not chunks:
            return
            
        texts = [chunk["text"] for chunk in chunks]
        embeddings = self.model.encode(texts).tolist()
        
        ids = [f"doc_{document_id}_chunk_{chunk['chunk_index']}" for chunk in chunks]
        metadatas = [
            {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": chunk["chunk_index"],
                # We can store a snippet of text or complete text in metadata
            }
            for chunk in chunks
        ]
        
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )

    def delete_document_vectors(self, document_id: int):
        """Removes all vectors belonging to a document ID."""
        # Query metadata matching document_id
        # ChromaDB supports filtering
        self.collection.delete(
            where={"document_id": document_id}
        )

    def query(self, query_text: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Queries Chroma DB for the top_k most similar chunks.
        Calculates similarity_score = 1.0 - cosine_distance.
        """
        query_embedding = self.model.encode([query_text]).tolist()[0]
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        
        formatted_results = []
        if not results or not results["ids"] or len(results["ids"][0]) == 0:
            return formatted_results
            
        ids = results["ids"][0]
        distances = results["distances"][0]
        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        
        for idx in range(len(ids)):
            # Cosine distance ranges from 0 to 2
            # similarity = 1 - distance
            distance = distances[idx]
            similarity = 1.0 - distance
            
            formatted_results.append({
                "id": ids[idx],
                "text": documents[idx],
                "metadata": metadatas[idx],
                "similarity": round(similarity, 4),
                "distance": round(distance, 4)
            })
            
        return formatted_results

    def get_all_chunks(self) -> List[Dict[str, Any]]:
        """Returns all chunks in the vector database for 3D visualizations."""
        data = self.collection.get(include=["metadatas", "embeddings", "documents"])
        chunks = []
        if not data or not data["ids"]:
            return chunks
            
        ids = data["ids"]
        metadatas = data["metadatas"]
        embeddings = data["embeddings"]
        documents = data["documents"]
        
        for idx in range(len(ids)):
            chunks.append({
                "id": ids[idx],
                "text": documents[idx],
                "metadata": metadatas[idx],
                "embedding": embeddings[idx] if embeddings else None
            })
        return chunks
