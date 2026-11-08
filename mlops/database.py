"""
Database models and connection for DeepSea eDNA API
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deepsea_predictions.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class Prediction(Base):
    """
    Prediction record in database
    """
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    sequence = Column(Text, nullable=False)
    sequence_hash = Column(String(64), index=True)  # For fast lookups
    
    # Prediction results
    class_id = Column(Integer, nullable=False)
    class_name = Column(String(100), nullable=False)
    common_name = Column(String(100))
    confidence = Column(Float, nullable=False)
    
    # Model info
    model_version = Column(String(50))
    device = Column(String(20))
    
    # Request metadata
    request_ip = Column(String(50))
    user_agent = Column(String(200))
    api_key = Column(String(100), index=True)  # For future auth
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    processing_time_ms = Column(Float)  # How long prediction took
    
    # Additional data
    extra_data = Column(JSON)  # Store any extra info (renamed from metadata)


class BatchJob(Base):
    """
    Batch processing job record
    """
    __tablename__ = "batch_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(100), unique=True, index=True)
    
    # Job details
    total_sequences = Column(Integer)
    processed_sequences = Column(Integer, default=0)
    failed_sequences = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    
    # Results summary
    results_summary = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Metadata
    filename = Column(String(200))
    user_id = Column(String(100))
    extra_info = Column(JSON)  # Renamed from metadata


class APIKey(Base):
    """
    API key for authentication (for future feature)
    """
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True)
    name = Column(String(100))
    
    # Limits
    rate_limit = Column(Integer, default=1000)  # requests per hour
    is_active = Column(Integer, default=1)
    
    # Usage tracking
    total_requests = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    
    # Owner info
    user_email = Column(String(200))
    organization = Column(String(200))


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")


def get_db():
    """
    Get database session
    Use as dependency in FastAPI endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    # Create tables when run directly
    init_db()
