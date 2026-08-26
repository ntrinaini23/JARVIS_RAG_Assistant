from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class DocumentDB(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_type = Column(String)
    file_size = Column(Integer)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Uploaded")  # Uploaded, Processing, Indexed, Failed
    chunk_count = Column(Integer, default=0)

class QueryDB(Base):
    __tablename__ = "queries"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text)
    answer = Column(Text)
    response_time_ms = Column(Integer)
    similarity_score = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ActivityLogDB(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text)
    activity_type = Column(String)  # INFO, SUCCESS, WARNING, ERROR
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SystemSettingDB(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize Database
def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Pre-populate default system settings
    db = SessionLocal()
    try:
        defaults = {
            "chunk_size": str(settings.DEFAULT_CHUNK_SIZE),
            "chunk_overlap": str(settings.DEFAULT_CHUNK_OVERLAP),
            "top_k": str(settings.DEFAULT_TOP_K),
            "similarity_threshold": str(settings.DEFAULT_SIMILARITY_THRESHOLD),
            "llm_model": settings.DEFAULT_LLM_MODEL,
            "temperature": "0.1",
            "max_tokens": "1024",
            "llm_provider": settings.DEFAULT_LLM_PROVIDER,
            "gemini_api_key": settings.GEMINI_API_KEY,
            "openai_api_key": settings.OPENAI_API_KEY,
            "openai_model": "gpt-4o-mini",
            "gemini_model": "gemini-1.5-flash"
        }
        for k, v in defaults.items():
            existing = db.query(SystemSettingDB).filter(SystemSettingDB.key == k).first()
            if not existing:
                db.add(SystemSettingDB(key=k, value=v))
        db.commit()
    except Exception as e:
        print(f"Error seeding DB: {e}")
        db.rollback()
    finally:
        db.close()
