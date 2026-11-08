import logging
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

from app.api import analysis, upload, export, models
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.services.model_loader import ModelLoader
from mlops.cache_manager import CacheManager

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global instances
model_loader = None
cache_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_loader, cache_manager
    logger.info("Starting eDNA Analysis API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Model Device: {settings.MODEL_DEVICE}")
    
    # Initialize model loader
    model_loader = ModelLoader()
    await model_loader.load_default_model()
    app.state.model_loader = model_loader
    
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
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model_loader is not None and model_loader.is_loaded(),
        "cache_backend": cache_manager.backend if cache_manager else "not_initialized",
    }


# ==================== Feature #5: Redis Caching ====================

@app.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    return cache_manager.get_stats()


@app.post("/cache/clear")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS,
    )
