"""
Per-user workspace: personal dashboard stats, prediction history and analysis jobs
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import utcnow
from app.db.models import AnalysisJob, Prediction, User
from app.db.session import get_db
from app.services.model_loader import NOVELTY_THRESHOLD

router = APIRouter(prefix="/me", tags=["My workspace"])


def prediction_row(p: Prediction) -> dict:
    return {
        "id": p.id,
        "sequence_id": p.sequence_id,
        "sequence_preview": p.sequence_preview,
        "sequence_length": p.sequence_length,
        "predicted_class": p.predicted_class,
        "confidence": p.confidence,
        "is_novel": p.is_novel,
        "source": p.source,
        "created_at": p.created_at,
    }


def job_row(j: AnalysisJob) -> dict:
    results = j.results or {}
    return {
        "job_id": j.id,
        "filenames": j.filenames,
        "status": j.status,
        "progress": j.progress,
        "error": j.error,
        "total_sequences": results.get("totalSequences"),
        "identified_taxa": results.get("identifiedTaxa"),
        "created_at": j.created_at,
        "completed_at": j.completed_at,
    }


@router.get("/stats")
def my_stats(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Everything the personal dashboard needs, scoped to the signed-in user"""
    mine = Prediction.user_id == user.id
    total, avg_conf, novel = db.execute(
        select(func.count(Prediction.id), func.avg(Prediction.confidence),
               func.count(Prediction.id).filter(Prediction.is_novel.is_(True))).where(mine)
    ).one()
    last_7d = db.scalar(
        select(func.count(Prediction.id)).where(mine, Prediction.created_at >= utcnow() - timedelta(days=7))
    )
    top_taxa = db.execute(
        select(Prediction.predicted_class, func.count(Prediction.id).label("n"))
        .where(mine).group_by(Prediction.predicted_class).order_by(func.count(Prediction.id).desc()).limit(8)
    ).all()
    recent = db.scalars(select(Prediction).where(mine).order_by(Prediction.created_at.desc()).limit(8)).all()
    jobs = db.scalars(
        select(AnalysisJob).where(AnalysisJob.user_id == user.id).order_by(AnalysisJob.created_at.desc()).limit(5)
    ).all()
    job_total = db.scalar(select(func.count(AnalysisJob.id)).where(AnalysisJob.user_id == user.id))

    registry = getattr(request.app.state, "version_registry", None)
    current = registry.get_current_version() if registry else None
    model_loader = getattr(request.app.state, "model_loader", None)

    return {
        "predictions": {
            "total": total or 0,
            "last_7_days": last_7d or 0,
            "novel": novel or 0,
            "avg_confidence": float(avg_conf) if avg_conf is not None else None,
        },
        "top_taxa": [{"taxon": t, "count": n} for t, n in top_taxa],
        "recent_predictions": [prediction_row(p) for p in recent],
        "jobs": {"total": job_total or 0, "recent": [job_row(j) for j in jobs]},
        "model": {
            "loaded": bool(model_loader and model_loader.is_loaded()),
            "version_name": current.version_name if current else None,
            "accuracy": current.metrics.get("accuracy") if current else None,
            "novelty_threshold": NOVELTY_THRESHOLD,
        },
    }


@router.get("/predictions")
def my_predictions(
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    taxon: str = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Prediction).where(Prediction.user_id == user.id)
    if taxon:
        query = query.where(Prediction.predicted_class == taxon)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Prediction.created_at.desc()).offset(offset).limit(limit)).all()
    return {"total": total or 0, "limit": limit, "offset": offset, "items": [prediction_row(p) for p in rows]}


@router.get("/jobs")
def my_jobs(
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(AnalysisJob).where(AnalysisJob.user_id == user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(AnalysisJob.created_at.desc()).offset(offset).limit(limit)).all()
    return {"total": total or 0, "limit": limit, "offset": offset, "items": [job_row(j) for j in rows]}
