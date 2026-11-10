import logging
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

# Add parent directory to path for mlops imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.api import analysis, upload, export, models
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.services.model_loader import ModelLoader
from mlops.cache_manager import CacheManager
from mlops.monitoring import MonitoringManager
from mlops.model_versioning import ModelVersionRegistry
from mlops.ab_testing import ABTestManager
from mlops.advanced_security import (
    SecurityManager, Token, UserCreate, UserResponse,
    UserRole, Permission, oauth2_scheme
)
from fastapi.security import OAuth2PasswordRequestForm

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Global instances
model_loader = None
cache_manager = None
monitoring_manager = None
version_registry = None
ab_test_manager = None
security_manager = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_loader, cache_manager, monitoring_manager, version_registry, ab_test_manager, security_manager
    logger.info("Starting eDNA Analysis API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Model Device: {settings.MODEL_DEVICE}")
    
    # Initialize security manager
    security_manager = SecurityManager()
    app.state.security_manager = security_manager
    logger.info(f"Security manager initialized: {len(security_manager.users)} users")
    
    # Initialize monitoring manager
    monitoring_manager = MonitoringManager()
    app.state.monitoring_manager = monitoring_manager
    logger.info("Monitoring manager initialized")
    
    # Initialize model version registry
    version_registry = ModelVersionRegistry()
    app.state.version_registry = version_registry
    logger.info(f"Version registry initialized: {len(version_registry.versions)} versions")
    
    # Initialize A/B test manager
    ab_test_manager = ABTestManager()
    app.state.ab_test_manager = ab_test_manager
    logger.info(f"A/B test manager initialized: {len(ab_test_manager.experiments)} experiments")
    
    # Download model from S3 if MODEL_S3_BUCKET is set and model files are missing
    s3_bucket = os.environ.get("MODEL_S3_BUCKET", "")
    model_dir = Path(settings.MODEL_DIR)
    model_name = settings.DEFAULT_MODEL
    model_path = model_dir / model_name
    weights_file = model_path / "best_model.pth"

    if s3_bucket and not weights_file.exists():
        logger.info(f"Model weights not found locally. Downloading from S3: s3://{s3_bucket}/{model_name}/")
        try:
            import boto3
            s3 = boto3.client("s3", region_name=os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-2"))
            model_path.mkdir(parents=True, exist_ok=True)
            for filename in ["best_model.pth", "model_config.json", "taxonomy_map.json"]:
                local_file = model_path / filename
                if not local_file.exists():
                    logger.info(f"  Downloading {filename}...")
                    s3.download_file(s3_bucket, f"{model_name}/{filename}", str(local_file))
                    logger.info(f"  ✅ {filename} downloaded ({local_file.stat().st_size / 1024 / 1024:.1f} MB)")
            logger.info("All model files downloaded from S3 successfully.")
        except Exception as e:
            logger.error(f"Failed to download model from S3: {e}")
            raise RuntimeError(f"Cannot load model: S3 download failed — {e}")

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


# ==================== Feature #9: Advanced Security & RBAC ====================

@app.post("/auth/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None
):
    """
    OAuth2 compatible token login endpoint
    Returns access and refresh tokens
    """
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    # Authenticate user
    user = sec_manager.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token = sec_manager.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    refresh_token = sec_manager.create_refresh_token(
        data={"sub": user.username, "role": user.role}
    )
    
    return Token(access_token=access_token, refresh_token=refresh_token)


@app.post("/auth/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    request: Request
):
    """Register a new user (public endpoint for demo)"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    try:
        user = sec_manager.create_user(user_data)
        return UserResponse(
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            disabled=user.disabled,
            created_at=user.created_at,
            last_login=user.last_login
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    """Get current authenticated user"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    # Verify token
    token_data = sec_manager.verify_token(token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Get user
    user = sec_manager.get_user(token_data.username)
    if user is None or user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled"
        )
    
    return UserResponse(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        disabled=user.disabled,
        created_at=user.created_at,
        last_login=user.last_login
    )


@app.post("/auth/refresh")
async def refresh_token(
    refresh_token: str,
    request: Request
):
    """Refresh access token using refresh token"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    # Verify refresh token
    token_data = sec_manager.verify_token(refresh_token)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Create new access token
    access_token = sec_manager.create_access_token(
        data={"sub": token_data.username, "role": token_data.role}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/logout")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    """Logout by revoking the current token"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    sec_manager.revoke_token(token)
    return {"message": "Successfully logged out"}


@app.get("/auth/users")
async def list_users(request: Request):
    """List all users (admin only in production)"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    users = sec_manager.list_users()
    return {
        "total": len(users),
        "users": [
            UserResponse(
                username=u.username,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                disabled=u.disabled,
                created_at=u.created_at,
                last_login=u.last_login
            )
            for u in users
        ]
    }


@app.get("/auth/security-stats")
async def get_security_stats(request: Request):
    """Get security statistics"""
    sec_manager = request.app.state.security_manager
    if not sec_manager:
        raise HTTPException(status_code=503, detail="Security manager not initialized")
    
    return sec_manager.get_statistics()


@app.get("/auth/permissions")
async def get_permissions(request: Request):
    """Get available permissions and role mappings"""
    return {
        "roles": [
            {
                "role": "admin",
                "description": "Full system access",
                "permissions": "all"
            },
            {
                "role": "scientist",
                "description": "Can manage models and experiments",
                "permissions": ["predict", "model:*", "version:*", "experiment:*", "monitoring:view"]
            },
            {
                "role": "viewer",
                "description": "Read-only access",
                "permissions": ["predict", "model:view", "version:view", "experiment:view"]
            },
            {
                "role": "api_user",
                "description": "API access for predictions only",
                "permissions": ["predict", "predict:batch"]
            }
        ],
        "all_permissions": [p.value for p in Permission]
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


# ==================== Feature #8: A/B Testing ====================

@app.post("/experiments/create")
async def create_experiment(
    request: Request,
    experiment_name: str,
    description: str,
    variant_configs: List[Dict[str, Any]],
    strategy: str = "random",
    duration_days: Optional[int] = None
):
    """
    Create a new A/B test experiment
    
    Example variant_configs:
    [
        {"name": "control", "version_id": "v2.0-baseline", "traffic": 50},
        {"name": "treatment", "version_id": "v2.1", "traffic": 50}
    ]
    """
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    try:
        experiment = ab_manager.create_experiment(
            experiment_name=experiment_name,
            description=description,
            variant_configs=variant_configs,
            strategy=strategy,
            duration_days=duration_days
        )
        
        return {
            "status": "success",
            "message": "Experiment created successfully",
            "experiment_id": experiment.experiment_id,
            "experiment_name": experiment.experiment_name,
            "variants": len(experiment.variants)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/experiments/{experiment_id}/start")
async def start_experiment(experiment_id: str, request: Request):
    """Start an A/B test experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    success = ab_manager.start_experiment(experiment_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot start experiment (not found or another experiment is active)"
        )
    
    return {
        "status": "success",
        "message": f"Experiment {experiment_id} started",
        "experiment_id": experiment_id
    }


@app.post("/experiments/{experiment_id}/stop")
async def stop_experiment(
    experiment_id: str,
    request: Request,
    declare_winner: bool = True
):
    """Stop an A/B test experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    success = ab_manager.stop_experiment(experiment_id, declare_winner=declare_winner)
    if not success:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Get results
    results = ab_manager.get_experiment_results(experiment_id)
    
    return {
        "status": "success",
        "message": f"Experiment {experiment_id} stopped",
        "experiment_id": experiment_id,
        "winner": results.get("winner"),
        "results": results
    }


@app.post("/experiments/{experiment_id}/pause")
async def pause_experiment(experiment_id: str, request: Request):
    """Pause an A/B test experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    success = ab_manager.pause_experiment(experiment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return {
        "status": "success",
        "message": f"Experiment {experiment_id} paused",
        "experiment_id": experiment_id
    }


@app.post("/experiments/{experiment_id}/resume")
async def resume_experiment(experiment_id: str, request: Request):
    """Resume a paused A/B test experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    success = ab_manager.resume_experiment(experiment_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot resume experiment (not found or not paused)"
        )
    
    return {
        "status": "success",
        "message": f"Experiment {experiment_id} resumed",
        "experiment_id": experiment_id
    }


@app.get("/experiments")
async def list_experiments(request: Request, status: Optional[str] = None):
    """List all A/B test experiments"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    experiments = ab_manager.list_experiments(status=status)
    
    return {
        "total": len(experiments),
        "experiments": experiments
    }


@app.get("/experiments/{experiment_id}/results")
async def get_experiment_results(experiment_id: str, request: Request):
    """Get detailed results for an A/B test experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    try:
        results = ab_manager.get_experiment_results(experiment_id)
        return results
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/experiments/active")
async def get_active_experiment(request: Request):
    """Get currently active experiment"""
    ab_manager = request.app.state.ab_test_manager
    if not ab_manager:
        raise HTTPException(status_code=503, detail="A/B test manager not initialized")
    
    experiment = ab_manager.get_active_experiment()
    if not experiment:
        return {"active": False, "experiment": None}
    
    return {
        "active": True,
        "experiment": {
            "experiment_id": experiment.experiment_id,
            "experiment_name": experiment.experiment_name,
            "status": experiment.status,
            "variants": [
                {
                    "variant_id": v.variant_id,
                    "variant_name": v.variant_name,
                    "version_id": v.version_id,
                    "traffic_percentage": v.traffic_percentage,
                    "prediction_count": v.prediction_count
                }
                for v in experiment.variants
            ]
        }
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
