"""
CRUD operations for database
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import hashlib

from database import Prediction, BatchJob


def hash_sequence(sequence: str) -> str:
    """Create hash of sequence for deduplication"""
    return hashlib.sha256(sequence.encode()).hexdigest()


def create_prediction(
    db: Session,
    sequence: str,
    class_id: int,
    class_name: str,
    common_name: str,
    confidence: float,
    model_version: str,
    device: str,
    processing_time_ms: float,
    request_ip: str = None,
    user_agent: str = None,
    metadata: dict = None
) -> Prediction:
    """
    Save a prediction to database
    """
    pred = Prediction(
        sequence=sequence,
        sequence_hash=hash_sequence(sequence),
        class_id=class_id,
        class_name=class_name,
        common_name=common_name,
        confidence=confidence,
        model_version=model_version,
        device=device,
        processing_time_ms=processing_time_ms,
        request_ip=request_ip,
        user_agent=user_agent,
        metadata=metadata
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


def get_prediction(db: Session, prediction_id: int) -> Optional[Prediction]:
    """Get prediction by ID"""
    return db.query(Prediction).filter(Prediction.id == prediction_id).first()


def get_predictions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    class_name: str = None,
    min_confidence: float = None
) -> List[Prediction]:
    """
    Get predictions with optional filters
    """
    query = db.query(Prediction)
    
    if class_name:
        query = query.filter(Prediction.class_name == class_name)
    
    if min_confidence:
        query = query.filter(Prediction.confidence >= min_confidence)
    
    return query.order_by(desc(Prediction.created_at)).offset(skip).limit(limit).all()


def get_prediction_by_sequence_hash(db: Session, sequence: str) -> Optional[Prediction]:
    """
    Check if sequence was already predicted (for caching)
    """
    seq_hash = hash_sequence(sequence)
    # Get most recent prediction for this sequence (within last 24 hours)
    recent = datetime.utcnow() - timedelta(hours=24)
    return db.query(Prediction).filter(
        Prediction.sequence_hash == seq_hash,
        Prediction.created_at >= recent
    ).order_by(desc(Prediction.created_at)).first()


def get_statistics(db: Session, days: int = 7) -> Dict:
    """
    Get prediction statistics
    """
    since = datetime.utcnow() - timedelta(days=days)
    
    # Total predictions
    total = db.query(func.count(Prediction.id)).filter(
        Prediction.created_at >= since
    ).scalar()
    
    # Average confidence
    avg_confidence = db.query(func.avg(Prediction.confidence)).filter(
        Prediction.created_at >= since
    ).scalar() or 0
    
    # Predictions by class
    by_class = db.query(
        Prediction.class_name,
        Prediction.common_name,
        func.count(Prediction.id).label('count')
    ).filter(
        Prediction.created_at >= since
    ).group_by(Prediction.class_name, Prediction.common_name).all()
    
    # Average processing time
    avg_time = db.query(func.avg(Prediction.processing_time_ms)).filter(
        Prediction.created_at >= since
    ).scalar() or 0
    
    # Predictions per day
    predictions_per_day = total / max(days, 1)
    
    return {
        "period_days": days,
        "total_predictions": total,
        "avg_confidence": round(avg_confidence, 4),
        "avg_processing_time_ms": round(avg_time, 2),
        "predictions_per_day": round(predictions_per_day, 1),
        "predictions_by_class": [
            {
                "class_name": row[0],
                "common_name": row[1],
                "count": row[2],
                "percentage": round(row[2] / total * 100, 1) if total > 0 else 0
            }
            for row in by_class
        ]
    }


def create_batch_job(
    db: Session,
    job_id: str,
    total_sequences: int,
    filename: str = None,
    metadata: dict = None
) -> BatchJob:
    """
    Create a batch processing job
    """
    job = BatchJob(
        job_id=job_id,
        total_sequences=total_sequences,
        filename=filename,
        metadata=metadata,
        started_at=datetime.utcnow()
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_batch_job(
    db: Session,
    job_id: str,
    processed: int = None,
    failed: int = None,
    status: str = None,
    results_summary: dict = None
) -> Optional[BatchJob]:
    """
    Update batch job progress
    """
    job = db.query(BatchJob).filter(BatchJob.job_id == job_id).first()
    if not job:
        return None
    
    if processed is not None:
        job.processed_sequences = processed
    if failed is not None:
        job.failed_sequences = failed
    if status:
        job.status = status
        if status == "completed":
            job.completed_at = datetime.utcnow()
    if results_summary:
        job.results_summary = results_summary
    
    db.commit()
    db.refresh(job)
    return job


def get_batch_job(db: Session, job_id: str) -> Optional[BatchJob]:
    """Get batch job by ID"""
    return db.query(BatchJob).filter(BatchJob.job_id == job_id).first()
