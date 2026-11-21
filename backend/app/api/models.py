"""
Model information and prediction endpoints
"""
import json
import logging
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.config import settings
from app.core.security import Permission, utcnow
from app.db.models import Prediction, User
from app.db.session import get_db
from app.services import serving

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_BATCH_SIZE = 1000
# Shortest read the web UI accepts; the longest is settings.MAX_SEQUENCE_LENGTH (the model's input size)
MIN_SEQUENCE_LENGTH = 100
# IUPAC nucleotide codes; ambiguous bases are encoded as "unknown" by the model
VALID_SEQUENCE = re.compile(r"^[ACGTURYSWKMBDHVN]+$")


class PredictRequest(BaseModel):
    sequence: str
    use_cache: bool = True


class PredictResponse(BaseModel):
    predicted_class: str
    confidence: float
    alternatives: list
    probabilities: Dict[str, float] = {}
    class_id: Optional[int] = None
    rank: Optional[str] = None
    lineage: List[str] = []
    is_novel: bool = False
    cached: bool = False


class BatchPredictRequest(BaseModel):
    sequences: List[str] = Field(..., min_length=1)
    sequence_ids: Optional[List[str]] = None
    use_cache: bool = True


def clean_sequence(raw: str) -> str:
    """Strip whitespace/FASTA header and validate nucleotide characters"""
    lines = [l for l in raw.strip().splitlines() if not l.startswith('>')]
    seq = re.sub(r"\s+", "", "".join(lines)).upper()
    if not seq:
        raise HTTPException(status_code=422, detail="Sequence is empty")
    if not VALID_SEQUENCE.match(seq):
        bad = sorted(set(re.sub(r"[ACGTURYSWKMBDHVN]", "", seq)))
        raise HTTPException(
            status_code=422,
            detail=f"Sequence contains invalid characters: {''.join(bad)}"
        )
    seq = seq.replace("U", "T")
    if not MIN_SEQUENCE_LENGTH <= len(seq) <= settings.MAX_SEQUENCE_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Sequence is {len(seq)} bp; it must be {MIN_SEQUENCE_LENGTH}-{settings.MAX_SEQUENCE_LENGTH} bp"
        )
    return seq


def format_prediction(result: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a ModelLoader result into the API response shape"""
    return {
        "predicted_class": result.get("taxon_name", "Unknown"),
        "confidence": result.get("confidence", 0.0),
        "alternatives": [
            {
                "class": alt.get("taxon_name", "Unknown"),
                "confidence": alt.get("probability", 0.0)
            }
            for alt in result.get("top_predictions", [])[:3]
        ],
        "probabilities": result.get("probabilities", {}),
        "class_id": result.get("predicted_class"),
        "rank": result.get("rank"),
        "lineage": result.get("lineage", []),
        "is_novel": result.get("is_novel", False),
        "cached": False
    }


def history_entry(user: User, sequence: str, data: Dict[str, Any], source: str, sequence_id: str = None) -> Prediction:
    return Prediction(
        user_id=user.id,
        sequence_id=sequence_id,
        sequence_preview=sequence[:60],
        sequence_length=len(sequence),
        predicted_class=data["predicted_class"],
        confidence=float(data["confidence"]),
        is_novel=bool(data["is_novel"]),
        source=source,
    )


def cache_key(req: Request, sequence: str) -> str:
    return req.app.state.cache_manager.generate_cache_key(sequence, prefix=serving.cache_prefix(req.app.state.model_info))


def record_ab_test(req: Request, confidence: float, success: bool = True):
    """Attribute a prediction to the running A/B experiment, if any"""
    ab_manager = getattr(req.app.state, "ab_test_manager", None)
    if not ab_manager:
        return
    experiment = ab_manager.get_active_experiment()
    if not experiment or experiment.status != "running":
        return
    version_id = ab_manager.select_variant(experiment.experiment_id)
    variant = next((v for v in experiment.variants if v.version_id == version_id), None)
    if variant:
        ab_manager.record_prediction(experiment.experiment_id, variant.variant_id, confidence, success)


@router.get("/model/serving")
def serving_model(req: Request, _: User = Depends(require_permission(Permission.MODEL_VIEW))):
    """Which model version is answering predictions, and where it was loaded from"""
    return {**req.app.state.model_info, "mlflow_enabled": serving.mlflow_enabled()}


@router.post("/model/reload")
def reload_model(req: Request, user: User = Depends(require_permission(Permission.MODEL_MANAGE))):
    """
    Reload models:/<name>@<alias> from MLflow (e.g. after promoting a new champion), without a restart
    """
    if not serving.mlflow_enabled():
        raise HTTPException(status_code=409, detail="MLflow is not configured (set MLFLOW_TRACKING_URI)")
    try:
        loader, info = serving.load_from_mlflow()
    except Exception as e:
        logger.error(f"Model reload failed: {e}")
        raise HTTPException(status_code=502, detail=f"Could not load the model from MLflow: {e}")

    info["loaded_at"] = utcnow().isoformat()
    previous = req.app.state.model_info
    # Swap references; in-flight requests finish on the old model, which is then garbage-collected
    req.app.state.model_loader, req.app.state.model_info = loader, info
    serving.sync_version_registry(req.app.state.version_registry, info)
    logger.info(f"{user.username} reloaded model: v{previous.get('version')} -> v{info['version']}")
    return {"previous_version": previous.get("version"), **info}


@router.get("/models")
def list_models(_: User = Depends(require_permission(Permission.MODEL_VIEW))):
    """
    List available models
    """
    model_dir = Path(settings.MODEL_DIR)
    if not model_dir.exists():
        return {'models': []}
    return {
        'models': [
            {'name': p.name}
            for p in model_dir.iterdir()
            if p.is_dir() and (p / 'model_config.json').exists()
        ]
    }


@router.get("/models/{model_name}")
def get_model_info(model_name: str, _: User = Depends(require_permission(Permission.MODEL_VIEW))):
    """
    Get model information
    """
    model_dir = Path(settings.MODEL_DIR).resolve()
    model_path = (model_dir / model_name).resolve()
    if model_path.parent != model_dir or not model_path.is_dir():
        raise HTTPException(status_code=404, detail="Model not found")

    info = {'name': model_name}
    config_file = model_path / 'model_config.json'
    taxonomy_file = model_path / 'taxonomy_map.json'
    if config_file.exists():
        info['config'] = json.loads(config_file.read_text())
    if taxonomy_file.exists():
        taxonomy = json.loads(taxonomy_file.read_text())
        info['num_classes'] = len(taxonomy)
        info['classes'] = list(taxonomy.values())
    return info


@router.post("/predict", response_model=PredictResponse)
def predict_sequence(
    request: PredictRequest,
    req: Request,
    user: User = Depends(require_permission(Permission.PREDICT)),
    db: Session = Depends(get_db),
):
    """
    Predict taxonomic classification for a DNA sequence (cached; saved to the user's history)
    """
    model_loader = req.app.state.model_loader
    cache_manager = req.app.state.cache_manager
    monitoring = req.app.state.monitoring_manager

    sequence = clean_sequence(request.sequence)
    if monitoring:
        monitoring.increment_prediction_count()

    key = cache_key(req, sequence) if cache_manager else None
    cached_result = cache_manager.get(key) if (request.use_cache and cache_manager) else None

    if cached_result:
        if monitoring:
            monitoring.track_cache_hit("prediction")
        response_data = {**cached_result, "cached": True}
    else:
        if monitoring and request.use_cache:
            monitoring.track_cache_miss("prediction")
        try:
            predictions = model_loader.predict([sequence])
            if not predictions:
                raise RuntimeError("Model returned no prediction")
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            if monitoring:
                monitoring.increment_error_count()
            record_ab_test(req, 0.0, success=False)
            raise HTTPException(status_code=500, detail="Prediction failed")

        response_data = format_prediction(predictions[0])
        record_ab_test(req, response_data["confidence"])
        if request.use_cache and cache_manager:
            cache_manager.set(key, response_data, ttl=3600)  # 1 hour TTL

    db.add(history_entry(user, sequence, response_data, source="single"))
    db.commit()
    return PredictResponse(**response_data)


@router.post("/predict/batch")
def predict_batch(
    request: BatchPredictRequest,
    req: Request,
    user: User = Depends(require_permission(Permission.PREDICT_BATCH)),
    db: Session = Depends(get_db),
):
    """
    Classify many DNA sequences in one request (each is saved to the user's history)
    """
    if len(request.sequences) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Batch too large: {len(request.sequences)} sequences (max {MAX_BATCH_SIZE})"
        )
    if request.sequence_ids and len(request.sequence_ids) != len(request.sequences):
        raise HTTPException(status_code=422, detail="sequence_ids must match sequences in length")

    model_loader = req.app.state.model_loader
    cache_manager = req.app.state.cache_manager
    monitoring = req.app.state.monitoring_manager

    ids = request.sequence_ids or [f"seq_{i + 1}" for i in range(len(request.sequences))]
    sequences = []
    for seq_id, raw in zip(ids, request.sequences):
        try:
            sequences.append(clean_sequence(raw))
        except HTTPException as e:
            raise HTTPException(status_code=422, detail=f"{seq_id}: {e.detail}")

    # Resolve cache hits first, then run the model once over the misses
    results: List[Optional[Dict[str, Any]]] = [None] * len(sequences)
    misses = []
    for i, seq in enumerate(sequences):
        cached = cache_manager.get(cache_key(req, seq)) if (request.use_cache and cache_manager) else None
        if cached:
            results[i] = {**cached, "cached": True}
            if monitoring:
                monitoring.track_cache_hit("prediction")
        else:
            misses.append(i)
            if monitoring and request.use_cache:
                monitoring.track_cache_miss("prediction")

    try:
        if misses:
            predictions = model_loader.predict([sequences[i] for i in misses])
            for i, pred in zip(misses, predictions):
                data = format_prediction(pred)
                results[i] = data
                record_ab_test(req, data["confidence"])
                if request.use_cache and cache_manager:
                    cache_manager.set(cache_key(req, sequences[i]), data, ttl=3600)
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        if monitoring:
            monitoring.increment_error_count()
        raise HTTPException(status_code=500, detail="Batch prediction failed")

    if monitoring:
        monitoring.prediction_count += len(sequences)
    db.add_all(
        history_entry(user, seq, r, source="batch", sequence_id=seq_id)
        for seq_id, seq, r in zip(ids, sequences, results)
    )
    db.commit()

    taxa_counts = Counter(r["predicted_class"] for r in results)
    return {
        "total": len(results),
        "predictions": [{"sequence_id": seq_id, **r} for seq_id, r in zip(ids, results)],
        "summary": {
            "richness": len(taxa_counts),
            "dominant_taxon": taxa_counts.most_common(1)[0][0] if taxa_counts else None,
            "taxa_counts": dict(taxa_counts),
        }
    }
