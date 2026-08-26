import os

class Settings:
    # App General
    APP_NAME: str = "JARVIS"
    API_PREFIX: str = "/api"
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    CHROMA_DIR: str = os.path.join(BASE_DIR, "chroma_db")
    UPLOAD_DIR: str = os.path.join(DATA_DIR, "uploads")
    
    # Database
    DATABASE_URL: str = f"sqlite:///{os.path.join(DATA_DIR, 'jarvis.db')}"
    
    # Ollama Local LLM
    OLLAMA_HOST: str = os.getenv("JARVIS_OLLAMA_HOST", "http://localhost:11434")
    DEFAULT_LLM_MODEL: str = os.getenv("JARVIS_DEFAULT_LLM_MODEL", "qwen2.5:latest")
    
    # Embeddings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # RAG Settings (Default parameters that can be overridden in user settings)
    DEFAULT_CHUNK_SIZE: int = 512
    DEFAULT_CHUNK_OVERLAP: int = 64
    DEFAULT_TOP_K: int = 4
    DEFAULT_SIMILARITY_THRESHOLD: float = 0.40  # Cosine similarity metric minimum

    # Multi-LLM Providers settings
    DEFAULT_LLM_PROVIDER: str = os.getenv("JARVIS_DEFAULT_LLM_PROVIDER", "ollama")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")


# Ensure directories exist
settings = Settings()
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_DIR, exist_ok=True)
