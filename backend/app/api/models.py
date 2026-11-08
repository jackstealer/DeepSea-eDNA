"""
Model management API endpoints
"""
import logging
import hashlib
from fastapi import APIRouter, HTTPException, Request
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class PredictRequest(BaseModel):
    sequence: str
    use_cache: bool = True


class PredictResponse(BaseModel):
    predicted_class: str
    confidence: float
    alternatives: list
    cached: bool = False


@router.get("/models")
async def list_models():
    """
    List available models
    """
    model_dir = Path(settings.MODEL_DIR)
    
    if not model_dir.exists():
        return {'models': []}
    
    models = []
    for model_path in model_dir.iterdir():
        if model_path.is_dir():
            config_file = model_path / 'model_config.json'
            if config_file.exists():
                models.append({
                    'name': model_path.name,
                    'path': str(model_path)
                })
    
    return {'models': models}


@router.get("/models/{model_name}")
async def get_model_info(model_name: str):
    """
    Get model information
    """
    model_path = Path(settings.MODEL_DIR) / model_name
    
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    
    import json
    
    config_file = model_path / 'model_config.json'
    taxonomy_file = model_path / 'taxonomy_map.json'
    
    info = {'name': model_name}
    
    if config_file.exists():
        with open(config_file, 'r') as f:
            info['config'] = json.load(f)
    
    if taxonomy_file.exists():
        with open(taxonomy_file, 'r') as f:
            taxonomy = json.load(f)
            info['num_classes'] = len(taxonomy)
            info['classes'] = list(taxonomy.values())
    
    return info


@router.post("/predict", response_model=PredictResponse)
async def predict_sequence(request: PredictRequest, req: Request):
    """
    Predict taxonomic classification for a DNA sequence with caching
    """
    try:
        model_loader = req.app.state.model_loader
        cache_manager = req.app.state.cache_manager
        monitoring = req.app.state.monitoring_manager
        
        # Track metrics
        if monitoring:
            monitoring.increment_prediction_count()
        
        # Check cache if enabled
        cached_result = None
        if request.use_cache and cache_manager:
            # Generate cache key
            seq_hash = hashlib.md5(request.sequence.encode()).hexdigest()
            cache_key = f"predict:{seq_hash}"
            cached_result = cache_manager.get(cache_key)
        
        if cached_result:
            logger.info("Returning cached prediction")
            if monitoring:
                monitoring.track_cache_hit("prediction")
            return PredictResponse(**cached_result, cached=True)
        
        # Track cache miss
        if monitoring and request.use_cache:
            monitoring.track_cache_miss("prediction")
        
        # Make prediction
        predictions = model_loader.predict([request.sequence])
        
        if not predictions:
            if monitoring:
                monitoring.increment_error_count()
            raise HTTPException(status_code=400, detail="Prediction failed")
        
        result = predictions[0]
        
        # Prepare response
        response_data = {
            "predicted_class": result.get("taxon_name", "Unknown"),
            "confidence": result.get("confidence", 0.0),
            "alternatives": [
                {
                    "class": alt.get("taxon_name", "Unknown"),
                    "confidence": alt.get("confidence", 0.0)
                }
                for alt in result.get("alternatives", [])[:3]
            ],
            "cached": False
        }
        
        # Cache the result
        if request.use_cache and cache_manager:
            seq_hash = hashlib.md5(request.sequence.encode()).hexdigest()
            cache_key = f"predict:{seq_hash}"
            cache_manager.set(cache_key, response_data, ttl=3600)  # 1 hour TTL
        
        return PredictResponse(**response_data)
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        if monitoring:
            monitoring.increment_error_count()
        raise HTTPException(status_code=500, detail=str(e))
