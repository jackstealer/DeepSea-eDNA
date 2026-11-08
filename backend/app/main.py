import logging
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

from app.api import analysis, upload, export, models
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.services.model_loader import ModelLoader
from mlops.cache_manager import CacheManager
from mlops.monitoring import MonitoringManager
from mlops.model_versioning import ModelVersionRegistry

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global instances
model_loader = None
cache_manager = None
monitoring_manager = None
version_registry = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_loader, cache_manager, monitoring_manager, version_registry
    logger.info("Starting eDNA Analysis API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Model Device: {settings.MODEL_DEVICE}")
    
    # Initialize monitoring manager
    monitoring_manager = MonitoringManager()
    app.state.monitoring_manager = monitoring_manager
    logger.info("Monitoring manager initialized")
    
    # Initialize model version registry
    version_registry = ModelVersionRegistry()
    app.state.version_registry = version_registry
    logger.info(f"Version registry initialized: {len(version_registry.versions)} versions")
    
    # Initialize model loader
    model_loader = ModelLoader()
    await model_loader.load_default_model()
    app.state.model_loader = model_loader
    monitoring_manager.set_model_status("marine_model", model_loader.is_loaded())
    
    # Initialize cache manager
    cache_manager = CacheManager()
    app.state.cache_manager = cache_manager
    logger.info(f"Cache backend: {cache_manager.backend}")
    
    logger.info("Application startup complete")
    
    yield
    logger.info("Shutting down application...")
    if model_loader:
        model_loader.cleanup()
    if cache_manager:
        cache_manager.close()
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Driven Deep-Sea eDNA Analysis Pipeline with Deep Learning",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(models.router, prefix="/api", tags=["Models"])
@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
    }
@app.get("/health")
async def health_check(request: Request):
    """Basic health check"""
    monitoring = request.app.state.monitoring_manager
    if monitoring:
        monitoring.increment_request_count()
    
    return {
        "status": "healthy",
        "model_loaded": model_loader is not None and model_loader.is_loaded(),
        "cache_backend": cache_manager.backend if cache_manager else "not_initialized",
    }


@app.get("/health/detailed")
async def detailed_health_check(request: Request):
    """Comprehensive health check with all components"""
    monitoring = request.app.state.monitoring_manager
    if not monitoring:
        raise HTTPException(status_code=503, detail="Monitoring not initialized")
    
    monitoring.increment_request_count()
    
    return monitoring.get_comprehensive_health(
        model_loader=model_loader,
        cache_manager=cache_manager
    )


# ==================== Feature #6: Monitoring & Observability ====================

@app.get("/monitoring/system")
async def get_system_metrics(request: Request):
    """Get system-level metrics (CPU, memory, disk)"""
    monitoring = request.app.state.monitoring_manager
    if not monitoring:
        raise HTTPException(status_code=503, detail="Monitoring not initialized")
    
    return monitoring.get_system_health()


@app.get("/monitoring/application")
async def get_application_metrics(request: Request):
    """Get application-level metrics"""
    monitoring = request.app.state.monitoring_manager
    if not monitoring:
        raise HTTPException(status_code=503, detail="Monitoring not initialized")
    
    return monitoring.get_application_health()


@app.get("/monitoring/dashboard")
async def get_dashboard_data(request: Request):
    """Get all metrics formatted for monitoring dashboard"""
    monitoring = request.app.state.monitoring_manager
    if not monitoring:
        raise HTTPException(status_code=503, detail="Monitoring not initialized")
    
    dashboard_data = monitoring.get_dashboard_metrics()
    
    # Add cache metrics
    if cache_manager:
        dashboard_data["cache"] = cache_manager.get_stats()
    
    # Add model status
    dashboard_data["model"] = {
        "loaded": model_loader.is_loaded() if model_loader else False,
        "status": "active" if model_loader and model_loader.is_loaded() else "inactive"
    }
    
    return dashboard_data


# ==================== Feature #5: Redis Caching ====================

@app.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    return cache_manager.get_stats()


@app.get("/cache/clear")
async def clear_cache(pattern: Optional[str] = None):
    """Clear cache entries (optionally by pattern)"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    
    count = cache_manager.clear_pattern(pattern) if pattern else cache_manager.clear_all()
    return {
        "status": "success",
        "cleared_keys": count,
        "pattern": pattern
    }


@app.get("/cache/backend")
async def get_cache_backend():
    """Get current cache backend information"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    
    return {
        "backend": cache_manager.backend,
        "description": "Redis" if cache_manager.backend == "redis" else "In-memory (fallback)"
    }


# ==================== Feature #7: Model Versioning ====================

@app.get("/versions")
async def list_model_versions(
    request: Request,
    status: Optional[str] = None,
    limit: int = 20
):
    """List all registered model versions with optional filters"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    versions = registry.list_versions(status=status)[:limit]
    
    return {
        "total": len(versions),
        "versions": [
            {
                "version_id": v.version_id,
                "version_name": v.version_name,
                "created_at": v.created_at,
                "status": v.status,
                "is_current": v.is_current,
                "description": v.description,
                "metrics": v.metrics,
                "tags": v.tags,
                "checksum": v.checksum
            }
            for v in versions
        ]
    }


@app.get("/versions/{version_id}")
async def get_version_details(version_id: str, request: Request):
    """Get detailed information about a specific version"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    version = registry.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return {
        "version_id": version.version_id,
        "version_name": version.version_name,
        "model_path": version.model_path,
        "created_at": version.created_at,
        "description": version.description,
        "metrics": version.metrics,
        "training_info": version.training_info,
        "status": version.status,
        "is_current": version.is_current,
        "checksum": version.checksum,
        "tags": version.tags
    }


@app.get("/versions/current/info")
async def get_current_version(request: Request):
    """Get currently active model version"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    current = registry.get_current_version()
    if not current:
        raise HTTPException(status_code=404, detail="No current version set")
    
    return {
        "version_id": current.version_id,
        "version_name": current.version_name,
        "created_at": current.created_at,
        "metrics": current.metrics,
        "status": current.status,
        "description": current.description
    }


@app.post("/versions/register")
async def register_new_version(
    request: Request,
    version_name: str,
    model_path: str,
    description: str = "",
    metrics: Optional[Dict[str, float]] = None,
    training_info: Optional[Dict[str, Any]] = None,
    tags: Optional[List[str]] = None,
    set_as_current: bool = False
):
    """Register a new model version"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    try:
        version = registry.register_version(
            version_name=version_name,
            model_path=model_path,
            description=description,
            metrics=metrics,
            training_info=training_info,
            tags=tags,
            set_as_current=set_as_current
        )
        
        return {
            "status": "success",
            "message": "Version registered successfully",
            "version_id": version.version_id,
            "version_name": version.version_name,
            "is_current": version.is_current
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/versions/{version_id}/activate")
async def activate_version(version_id: str, request: Request):
    """Set a version as the current active model"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    success = registry.set_current_version(version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return {
        "status": "success",
        "message": f"Version {version_id} activated",
        "version_id": version_id
    }


@app.post("/versions/{version_id}/rollback")
async def rollback_version(version_id: str, request: Request):
    """Rollback to a previous version"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    success = registry.rollback_to_version(version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Version not found or rollback failed")
    
    return {
        "status": "success",
        "message": f"Rolled back to version {version_id}",
        "version_id": version_id
    }


@app.get("/versions/compare/{version_id_1}/{version_id_2}")
async def compare_versions(version_id_1: str, version_id_2: str, request: Request):
    """Compare two model versions"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    try:
        comparison = registry.compare_versions(version_id_1, version_id_2)
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/versions/history")
async def get_version_history(request: Request, limit: int = 10):
    """Get version history (chronological)"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    history = registry.get_version_history(limit=limit)
    return {
        "total": len(history),
        "history": history
    }


@app.get("/versions/statistics")
async def get_version_statistics(request: Request):
    """Get version registry statistics"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    return registry.get_statistics()


@app.post("/versions/{version_id}/archive")
async def archive_version(version_id: str, request: Request):
    """Archive a model version"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    success = registry.archive_version(version_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot archive version (not found or is current)")
    
    return {
        "status": "success",
        "message": f"Version {version_id} archived",
        "version_id": version_id
    }


@app.post("/versions/{version_id}/deprecate")
async def deprecate_version(
    version_id: str,
    request: Request,
    reason: str = ""
):
    """Mark a version as deprecated"""
    registry = request.app.state.version_registry
    if not registry:
        raise HTTPException(status_code=503, detail="Version registry not initialized")
    
    success = registry.deprecate_version(version_id, reason=reason)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot deprecate version (not found or is current)")
    
    return {
        "status": "success",
        "message": f"Version {version_id} deprecated",
        "version_id": version_id,
        "reason": reason
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS,
    )
