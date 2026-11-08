"""
Redis Cache Manager for Fast Predictions
"""
import json
import hashlib
from typing import Optional, Dict, Any
from datetime import timedelta
import os


class CacheManager:
    """
    Manage caching with Redis or in-memory fallback
    """
    
    def __init__(self, redis_url: str = None, ttl_seconds: int = 86400):
        """
        Initialize cache manager
        
        Args:
            redis_url: Redis connection URL (e.g., redis://localhost:6379)
            ttl_seconds: Time to live for cache entries (default: 24 hours)
        """
        self.ttl_seconds = ttl_seconds
        self.redis_client = None
        self.memory_cache = {}  # Fallback in-memory cache
        self.use_redis = False
        
        # Try to connect to Redis
        if redis_url or os.getenv("REDIS_URL"):
            try:
                import redis
                url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
                self.redis_client = redis.from_url(
                    url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                # Test connection
                self.redis_client.ping()
                self.use_redis = True
                print(f"✅ Connected to Redis at {url}")
            except Exception as e:
                print(f"⚠️  Redis not available: {e}")
                print("Using in-memory cache fallback")
    
    @staticmethod
    def generate_cache_key(sequence: str, prefix: str = "pred") -> str:
        """
        Generate cache key from sequence
        Uses SHA-256 hash of uppercase sequence
        """
        seq_hash = hashlib.sha256(sequence.upper().encode()).hexdigest()
        return f"{prefix}:{seq_hash[:16]}"
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Get value from cache
        
        Returns:
            Cached dict or None if not found
        """
        try:
            if self.use_redis and self.redis_client:
                # Try Redis first
                value = self.redis_client.get(key)
                if value:
                    return json.loads(value)
            else:
                # Use in-memory cache
                if key in self.memory_cache:
                    return self.memory_cache[key]
        except Exception as e:
            print(f"Cache get error: {e}")
        
        return None
    
    def set(self, key: str, value: Dict[str, Any], ttl: int = None) -> bool:
        """
        Set value in cache
        
        Args:
            key: Cache key
            value: Dict to cache
            ttl: Time to live in seconds (optional, uses default if not provided)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            ttl_to_use = ttl or self.ttl_seconds
            value_json = json.dumps(value)
            
            if self.use_redis and self.redis_client:
                # Store in Redis with TTL
                self.redis_client.setex(
                    key,
                    ttl_to_use,
                    value_json
                )
                return True
            else:
                # Store in memory cache
                self.memory_cache[key] = value
                # Note: In-memory cache doesn't support TTL in this simple implementation
                # In production, use a more sophisticated in-memory cache with TTL
                return True
                
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete value from cache
        """
        try:
            if self.use_redis and self.redis_client:
                self.redis_client.delete(key)
            else:
                if key in self.memory_cache:
                    del self.memory_cache[key]
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False
    
    def clear(self, pattern: str = None) -> int:
        """
        Clear cache entries
        
        Args:
            pattern: Optional pattern to match keys (e.g., "pred:*")
        
        Returns:
            Number of keys deleted
        """
        try:
            if self.use_redis and self.redis_client:
                if pattern:
                    keys = self.redis_client.keys(pattern)
                    if keys:
                        return self.redis_client.delete(*keys)
                    return 0
                else:
                    return self.redis_client.flushdb()
            else:
                # Clear in-memory cache
                if pattern:
                    # Simple pattern matching for in-memory
                    keys_to_delete = [k for k in self.memory_cache.keys() if pattern.replace("*", "") in k]
                    for key in keys_to_delete:
                        del self.memory_cache[key]
                    return len(keys_to_delete)
                else:
                    count = len(self.memory_cache)
                    self.memory_cache.clear()
                    return count
        except Exception as e:
            print(f"Cache clear error: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        """
        try:
            if self.use_redis and self.redis_client:
                info = self.redis_client.info("stats")
                keyspace = self.redis_client.info("keyspace")
                
                # Get prediction keys count
                pred_keys = len(self.redis_client.keys("pred:*"))
                
                return {
                    "cache_type": "redis",
                    "connected": True,
                    "total_keys": keyspace.get("db0", {}).get("keys", 0) if keyspace else 0,
                    "prediction_keys": pred_keys,
                    "hits": info.get("keyspace_hits", 0),
                    "misses": info.get("keyspace_misses", 0),
                    "hit_rate": self._calculate_hit_rate(info.get("keyspace_hits", 0), info.get("keyspace_misses", 0)),
                    "ttl_seconds": self.ttl_seconds
                }
            else:
                return {
                    "cache_type": "in-memory",
                    "connected": True,
                    "total_keys": len(self.memory_cache),
                    "prediction_keys": len([k for k in self.memory_cache.keys() if k.startswith("pred:")]),
                    "ttl_seconds": self.ttl_seconds,
                    "note": "In-memory cache (Redis not available)"
                }
        except Exception as e:
            return {
                "cache_type": "unknown",
                "connected": False,
                "error": str(e)
            }
    
    @staticmethod
    def _calculate_hit_rate(hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage"""
        total = hits + misses
        if total == 0:
            return 0.0
        return round((hits / total) * 100, 2)
    
    def get_prediction_from_cache(self, sequence: str) -> Optional[Dict[str, Any]]:
        """
        Get prediction from cache by sequence
        
        Returns:
            Cached prediction dict or None
        """
        key = self.generate_cache_key(sequence, prefix="pred")
        cached = self.get(key)
        
        if cached:
            # Add cache metadata
            cached["from_cache"] = True
            
        return cached
    
    def cache_prediction(
        self,
        sequence: str,
        prediction: Dict[str, Any],
        ttl: int = None
    ) -> bool:
        """
        Cache a prediction result
        
        Args:
            sequence: DNA sequence
            prediction: Prediction result to cache
            ttl: Optional custom TTL
        """
        key = self.generate_cache_key(sequence, prefix="pred")
        
        # Prepare data to cache
        cache_data = {
            "class_id": prediction.get("class_id"),
            "class_name": prediction.get("class_name"),
            "common_name": prediction.get("common_name"),
            "confidence": prediction.get("confidence"),
            "model_version": prediction.get("model_version"),
            "sequence_length": len(sequence)
        }
        
        return self.set(key, cache_data, ttl)
    
    def warm_cache(self, predictions: list) -> int:
        """
        Warm up cache with a list of predictions
        
        Args:
            predictions: List of (sequence, prediction_dict) tuples
        
        Returns:
            Number of predictions cached
        """
        count = 0
        for sequence, prediction in predictions:
            if self.cache_prediction(sequence, prediction):
                count += 1
        
        return count


# Global cache manager instance
_cache_manager = None


def get_cache_manager(redis_url: str = None) -> CacheManager:
    """
    Get or create global cache manager instance
    """
    global _cache_manager
    
    if _cache_manager is None:
        _cache_manager = CacheManager(redis_url=redis_url)
    
    return _cache_manager
