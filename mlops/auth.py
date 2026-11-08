"""
Authentication and API Key Management
"""
from typing import Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import Security, HTTPException, status, Depends
from fastapi.security import APIKeyHeader
import secrets
import hashlib
from database import APIKey, get_db


# API Key header configuration
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class AuthService:
    """
    Service for authentication and API key management
    """
    
    @staticmethod
    def generate_api_key() -> str:
        """
        Generate a secure random API key
        Format: dk_live_<32_random_characters>
        """
        random_part = secrets.token_urlsafe(32)
        return f"dk_live_{random_part}"
    
    @staticmethod
    def hash_api_key(api_key: str) -> str:
        """
        Hash API key for secure storage
        """
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    @staticmethod
    def create_api_key(
        db: Session,
        name: str,
        user_email: str,
        organization: str = None,
        rate_limit: int = 1000,
        expires_days: int = 365
    ) -> Tuple[APIKey, str]:
        """
        Create a new API key
        Returns: (APIKey record, plain_text_key)
        """
        # Generate key
        plain_key = AuthService.generate_api_key()
        key_hash = AuthService.hash_api_key(plain_key)
        
        # Calculate expiry
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
        
        # Create database record
        api_key = APIKey(
            key=key_hash,
            name=name,
            user_email=user_email,
            organization=organization,
            rate_limit=rate_limit,
            expires_at=expires_at
        )
        
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        
        return api_key, plain_key
    
    @staticmethod
    def validate_api_key(db: Session, api_key: str) -> Optional[APIKey]:
        """
        Validate API key and return associated record
        Returns None if invalid
        """
        if not api_key:
            return None
        
        # Hash the provided key
        key_hash = AuthService.hash_api_key(api_key)
        
        # Look up in database
        db_key = db.query(APIKey).filter(APIKey.key == key_hash).first()
        
        if not db_key:
            return None
        
        # Check if active
        if not db_key.is_active:
            return None
        
        # Check if expired
        if db_key.expires_at and db_key.expires_at < datetime.utcnow():
            return None
        
        # Update usage stats
        db_key.total_requests += 1
        db_key.last_used_at = datetime.utcnow()
        db.commit()
        
        return db_key
    
    @staticmethod
    def check_rate_limit(api_key_record: APIKey) -> Tuple[bool, int, int]:
        """
        Check if API key is within rate limit
        Returns: (is_allowed, requests_used, requests_limit)
        """
        # For now, simple total request count
        # In production, use Redis with sliding window
        
        # Check last hour usage (simplified - in production use Redis)
        requests_used = api_key_record.total_requests
        requests_limit = api_key_record.rate_limit
        
        is_allowed = requests_used < requests_limit
        
        return is_allowed, requests_used, requests_limit
    
    @staticmethod
    def revoke_api_key(db: Session, api_key_id: int) -> bool:
        """
        Revoke (deactivate) an API key
        """
        api_key = db.query(APIKey).filter(APIKey.id == api_key_id).first()
        
        if not api_key:
            return False
        
        api_key.is_active = 0
        db.commit()
        
        return True
    
    @staticmethod
    def list_api_keys(db: Session, user_email: str = None) -> list:
        """
        List all API keys, optionally filtered by user
        """
        query = db.query(APIKey)
        
        if user_email:
            query = query.filter(APIKey.user_email == user_email)
        
        return query.order_by(APIKey.created_at.desc()).all()


def get_api_key(
    api_key_header: str = Security(api_key_header),
    db: Session = Depends(get_db)
) -> Optional[APIKey]:
    """
    Dependency to get and validate API key from header
    Returns None if no key provided (for optional auth)
    Raises HTTPException if key is invalid
    """
    if not api_key_header:
        return None
    
    api_key_record = AuthService.validate_api_key(db, api_key_header)
    
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key"
        )
    
    # Check rate limit
    is_allowed, used, limit = AuthService.check_rate_limit(api_key_record)
    
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Used {used}/{limit} requests."
        )
    
    return api_key_record


def require_api_key(
    api_key: Optional[APIKey] = Security(get_api_key)
) -> APIKey:
    """
    Dependency to require API key (mandatory auth)
    Raises HTTPException if no key provided
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Include 'X-API-Key' header."
        )
    
    return api_key


# Rate limit decorator
class RateLimiter:
    """
    Rate limiter for specific endpoints
    """
    
    def __init__(self, requests_per_hour: int = 100):
        self.requests_per_hour = requests_per_hour
    
    def __call__(self, api_key: APIKey = Security(get_api_key)):
        """
        Check rate limit for this endpoint
        """
        if not api_key:
            # No API key, apply stricter limit
            # In production, use IP-based rate limiting
            pass
        
        # Check if within limit
        # In production, use Redis for per-endpoint limits
        
        return api_key
