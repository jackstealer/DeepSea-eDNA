"""
Advanced Monitoring System for DeepSea eDNA API
Provides Prometheus metrics, system health, and performance tracking
"""
import time
import psutil
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from prometheus_client import Counter, Histogram, Gauge, Info
from functools import wraps

logger = logging.getLogger(__name__)


# ==================== Prometheus Metrics ====================

# Request Metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

# Prediction Metrics
predictions_total = Counter(
    'predictions_total',
    'Total predictions made',
    ['model', 'status']
)

prediction_confidence = Histogram(
    'prediction_confidence',
    'Prediction confidence scores',
    ['model', 'predicted_class']
)

prediction_duration = Histogram(
    'prediction_duration_seconds',
    'Prediction processing time',
    ['model']
)

# Cache Metrics
cache_hits = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_type']
)

cache_misses = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_type']
)

# System Metrics
system_cpu_usage = Gauge(
    'system_cpu_usage_percent',
    'System CPU usage percentage'
)

system_memory_usage = Gauge(
    'system_memory_usage_bytes',
    'System memory usage in bytes'
)

system_memory_percent = Gauge(
    'system_memory_usage_percent',
    'System memory usage percentage'
)

system_disk_usage = Gauge(
    'system_disk_usage_bytes',
    'System disk usage in bytes'
)

system_disk_percent = Gauge(
    'system_disk_usage_percent',
    'System disk usage percentage'
)

# Model Metrics
model_loaded = Gauge(
    'model_loaded',
    'Whether ML model is loaded (1=loaded, 0=not loaded)',
    ['model_name']
)

model_predictions_by_class = Counter(
    'model_predictions_by_class_total',
    'Total predictions by predicted class',
    ['model', 'class_name']
)

# Error Metrics
errors_total = Counter(
    'errors_total',
    'Total errors',
    ['error_type', 'endpoint']
)

# Application Info
app_info = Info('app', 'Application information')


# ==================== Monitoring Manager ====================

class MonitoringManager:
    """
    Comprehensive monitoring and observability manager
    """
    
    def __init__(self):
        self.start_time = time.time()
        self.request_count = 0
        self.prediction_count = 0
        self.error_count = 0
        
        # Set application info
        app_info.info({
            'name': 'DeepSea eDNA API',
            'version': '2.0',
            'environment': 'production'
        })
        
        logger.info("MonitoringManager initialized")
    
    # ==================== Decorators ====================
    
    @staticmethod
    def track_request(endpoint: str):
        """Decorator to track HTTP request metrics"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                method = "GET"  # Default, override if needed
                start_time = time.time()
                status = "success"
                
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    status = "error"
                    errors_total.labels(
                        error_type=type(e).__name__,
                        endpoint=endpoint
                    ).inc()
                    raise
                finally:
                    duration = time.time() - start_time
                    http_requests_total.labels(
                        method=method,
                        endpoint=endpoint,
                        status=status
                    ).inc()
                    http_request_duration.labels(
                        method=method,
                        endpoint=endpoint
                    ).observe(duration)
            
            return wrapper
        return decorator
    
    @staticmethod
    def track_prediction(model_name: str = "marine_model"):
        """Decorator to track prediction metrics"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                status = "success"
                
                try:
                    result = await func(*args, **kwargs)
                    
                    # Track prediction metrics if result contains prediction data
                    if isinstance(result, dict):
                        if 'confidence' in result:
                            prediction_confidence.labels(
                                model=model_name,
                                predicted_class=result.get('predicted_class', 'unknown')
                            ).observe(result['confidence'])
                        
                        if 'predicted_class' in result:
                            model_predictions_by_class.labels(
                                model=model_name,
                                class_name=result['predicted_class']
                            ).inc()
                    
                    return result
                except Exception as e:
                    status = "error"
                    raise
                finally:
                    duration = time.time() - start_time
                    predictions_total.labels(
                        model=model_name,
                        status=status
                    ).inc()
                    prediction_duration.labels(
                        model=model_name
                    ).observe(duration)
            
            return wrapper
        return decorator
    
    # ==================== System Health ====================
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get comprehensive system health metrics"""
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            
            # Memory metrics
            memory = psutil.virtual_memory()
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            
            # Update Prometheus gauges
            system_cpu_usage.set(cpu_percent)
            system_memory_usage.set(memory.used)
            system_memory_percent.set(memory.percent)
            system_disk_usage.set(disk.used)
            system_disk_percent.set(disk.percent)
            
            return {
                "cpu": {
                    "usage_percent": cpu_percent,
                    "count": cpu_count,
                    "status": "healthy" if cpu_percent < 80 else "warning"
                },
                "memory": {
                    "total_bytes": memory.total,
                    "used_bytes": memory.used,
                    "available_bytes": memory.available,
                    "usage_percent": memory.percent,
                    "status": "healthy" if memory.percent < 80 else "warning"
                },
                "disk": {
                    "total_bytes": disk.total,
                    "used_bytes": disk.used,
                    "free_bytes": disk.free,
                    "usage_percent": disk.percent,
                    "status": "healthy" if disk.percent < 80 else "warning"
                }
            }
        except Exception as e:
            logger.error(f"Error getting system health: {e}")
            return {"error": str(e)}
    
    def get_application_health(self) -> Dict[str, Any]:
        """Get application-level health metrics"""
        uptime_seconds = time.time() - self.start_time
        
        return {
            "status": "healthy",
            "uptime_seconds": uptime_seconds,
            "uptime_human": self._format_uptime(uptime_seconds),
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def get_comprehensive_health(self, model_loader=None, cache_manager=None) -> Dict[str, Any]:
        """Get comprehensive health check including all components"""
        system_health = self.get_system_health()
        app_health = self.get_application_health()
        
        # Overall status determination
        statuses = []
        if "cpu" in system_health:
            statuses.append(system_health["cpu"]["status"])
        if "memory" in system_health:
            statuses.append(system_health["memory"]["status"])
        if "disk" in system_health:
            statuses.append(system_health["disk"]["status"])
        
        overall_status = "healthy"
        if "warning" in statuses:
            overall_status = "warning"
        if "error" in statuses or "error" in system_health:
            overall_status = "degraded"
        
        health_check = {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "api": {
                    "status": app_health["status"],
                    "uptime": app_health["uptime_human"]
                },
                "system": system_health,
                "model": {
                    "status": "loaded" if model_loader and model_loader.is_loaded() else "not_loaded",
                    "loaded": model_loader.is_loaded() if model_loader else False
                },
                "cache": {
                    "status": "active",
                    "backend": cache_manager.backend if cache_manager else "unknown"
                }
            }
        }
        
        return health_check
    
    # ==================== Cache Tracking ====================
    
    @staticmethod
    def track_cache_hit(cache_type: str = "prediction"):
        """Track a cache hit"""
        cache_hits.labels(cache_type=cache_type).inc()
    
    @staticmethod
    def track_cache_miss(cache_type: str = "prediction"):
        """Track a cache miss"""
        cache_misses.labels(cache_type=cache_type).inc()
    
    # ==================== Model Tracking ====================
    
    @staticmethod
    def set_model_status(model_name: str, loaded: bool):
        """Update model loaded status"""
        model_loaded.labels(model_name=model_name).set(1 if loaded else 0)
    
    # ==================== Dashboard Data ====================
    
    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Get metrics formatted for monitoring dashboard"""
        system_health = self.get_system_health()
        app_health = self.get_application_health()
        
        return {
            "overview": {
                "status": app_health["status"],
                "uptime": app_health["uptime_human"],
                "timestamp": app_health["timestamp"]
            },
            "system": system_health,
            "predictions": {
                "total": self.prediction_count,
                "rate_per_minute": self._calculate_rate(self.prediction_count)
            },
            "requests": {
                "total": self.request_count,
                "rate_per_minute": self._calculate_rate(self.request_count)
            },
            "errors": {
                "total": self.error_count,
                "rate_per_minute": self._calculate_rate(self.error_count)
            }
        }
    
    # ==================== Helper Methods ====================
    
    @staticmethod
    def _format_uptime(seconds: float) -> str:
        """Format uptime in human-readable format"""
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if days > 0:
            return f"{days}d {hours}h {minutes}m {secs}s"
        elif hours > 0:
            return f"{hours}h {minutes}m {secs}s"
        elif minutes > 0:
            return f"{minutes}m {secs}s"
        else:
            return f"{secs}s"
    
    def _calculate_rate(self, count: int) -> float:
        """Calculate rate per minute"""
        uptime_minutes = (time.time() - self.start_time) / 60
        if uptime_minutes > 0:
            return round(count / uptime_minutes, 2)
        return 0.0
    
    def increment_request_count(self):
        """Increment request counter"""
        self.request_count += 1
    
    def increment_prediction_count(self):
        """Increment prediction counter"""
        self.prediction_count += 1
    
    def increment_error_count(self):
        """Increment error counter"""
        self.error_count += 1
