"""
Analysis API endpoints (file-based classification jobs, persisted per user)
"""
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_permission
from app.api.upload import resolve_upload
from app.core.security import Permission, UserRole, utcnow
from app.db.models import AnalysisJob, User
from app.db.session import SessionLocal, get_db
from app.services.model_loader import NOVELTY_THRESHOLD, ModelLoader
from app.services.sequence_processor import SequenceProcessor, TaxonomyMapper

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalysisRequest(BaseModel):
    file_paths: List[str] = Field(..., min_length=1, max_length=20)  # file IDs returned by /upload


class AnalysisResponse(BaseModel):
    jobId: str
    status: str
    progress: Optional[float] = None
    currentStep: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def update_job(db: Session, job: AnalysisJob, **fields):
    for key, value in fields.items():
        setattr(job, key, value)
    db.commit()


def run_analysis(job_id: str, file_paths: List[Path], model_loader: ModelLoader, model_label: str):
    """
    Background task: preprocess, classify and summarise the uploaded files
    """
    started = time.perf_counter()
    db = SessionLocal()
    job = db.get(AnalysisJob, job_id)
    try:
        update_job(db, job, status='processing', current_step='preprocessing', progress=10)

        processor = SequenceProcessor()
        all_sequences = []
        all_abundances = {}
        for file_path in file_paths:
            sequences, abundance, _ = processor.process_pipeline(str(file_path))
            all_sequences.extend(sequences)
            for seq_str, count in abundance.items():
                all_abundances[seq_str] = all_abundances.get(seq_str, 0) + count

        logger.info(f"Job {job_id}: {len(all_sequences)} sequences after preprocessing")
        if not all_sequences:
            raise ValueError(
                f"No sequences passed quality filtering "
                f"(length must be {processor.min_length}-{processor.max_length} bp)"
            )

        update_job(db, job, current_step='classification', progress=40)
        sequence_strings = [str(seq.seq) for seq in all_sequences]
        predictions = model_loader.predict(sequence_strings)

        update_job(db, job, current_step='abundance', progress=75)

        # Aggregate results by taxon
        taxon_data = {}
        for i, pred in enumerate(predictions):
            entry = taxon_data.setdefault(pred['taxon_name'], {
                'abundance': 0, 'confidence': [], 'rank': pred['rank'], 'lineage': pred['lineage'],
            })
            entry['abundance'] += all_abundances.get(sequence_strings[i], 1)
            entry['confidence'].append(pred['confidence'])

        taxonomic_data = sorted(
            (
                {
                    'name': name,
                    'abundance': data['abundance'],
                    'confidence': sum(data['confidence']) / len(data['confidence']),
                    'isNovel': sum(data['confidence']) / len(data['confidence']) < NOVELTY_THRESHOLD,
                    'taxonomicRank': data['rank'],
                    'lineage': data['lineage'],
                }
                for name, data in taxon_data.items()
            ),
            key=lambda t: t['abundance'],
            reverse=True,
        )

        # Per-sequence rows (used by the results table and FASTA export)
        sequence_rows = [
            {
                'sequence_id': all_sequences[i].id,
                'predicted_taxon': pred['taxon_name'],
                'confidence': pred['confidence'],
                'abundance': all_abundances.get(sequence_strings[i], 1),
                'is_novel': pred['is_novel'],
                'rank': pred['rank'],
                'lineage': pred['lineage'],
            }
            for i, pred in enumerate(predictions)
        ]

        update_job(db, job, current_step='annotation', progress=90)
        diversity = TaxonomyMapper().calculate_diversity_indices({t['name']: t['abundance'] for t in taxonomic_data})

        results = {
            'totalSequences': len(all_sequences),
            'identifiedTaxa': len(taxonomic_data),
            'novelTaxa': sum(1 for t in taxonomic_data if t['isNovel']),
            'shannonDiversity': diversity['shannon'],
            'simpsonDiversity': diversity['simpson'],
            'evenness': diversity['evenness'],
            'taxonomicData': taxonomic_data,
            'predictions': sequence_rows,
            'metadata': {
                'processingTime': round(time.perf_counter() - started, 3),
                'model': model_label,
                'clustering': 'Exact-match dereplication',
                'timestamp': datetime.now(timezone.utc).isoformat(),
            },
        }
        update_job(
            db, job, status='completed', progress=100, current_step=None,
            results=results, sequences=sequence_strings, completed_at=utcnow(),
        )
        logger.info(f"Analysis {job_id} completed")

    except Exception as e:
        logger.error(f"Analysis {job_id} failed: {e}")
        db.rollback()
        update_job(db, job, status='failed', error=str(e), completed_at=utcnow())
    finally:
        db.close()


def get_owned_job(db: Session, job_id: str, user: User) -> AnalysisJob:
    """Jobs are private: other users get 404, as if the job did not exist"""
    job = db.get(AnalysisJob, job_id)
    if job is None or (job.user_id != user.id and user.role != UserRole.ADMIN.value):
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/analyze", response_model=AnalysisResponse)
def start_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks,
    req: Request,
    user: User = Depends(require_permission(Permission.PREDICT_BATCH)),
    db: Session = Depends(get_db),
):
    """
    Start an analysis job over files previously uploaded by the same user
    """
    paths = [resolve_upload(user, file_id) for file_id in request.file_paths]
    job = AnalysisJob(
        id=str(uuid.uuid4()),
        user_id=user.id,
        filenames=[p.name.split("_", 1)[-1] for p in paths],
        status='queued',
        progress=0,
    )
    db.add(job)
    db.commit()

    info = req.app.state.model_info  # the model version actually serving, recorded with the results
    model_label = f"{info['name']} v{info['version']}" + (f" @{info['alias']}" if info.get('alias') else "")
    background_tasks.add_task(run_analysis, job.id, paths, req.app.state.model_loader, model_label)
    logger.info(f"User {user.id} started analysis job {job.id} with {len(paths)} files")
    return AnalysisResponse(jobId=job.id, status='queued', progress=0)


@router.get("/results/{job_id}", response_model=AnalysisResponse)
def get_results(job_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get analysis status and results
    """
    job = get_owned_job(db, job_id, user)
    return AnalysisResponse(
        jobId=job.id,
        status=job.status,
        progress=job.progress,
        currentStep=job.current_step,
        results=job.results,
        error=job.error,
    )
