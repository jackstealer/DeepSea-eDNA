"""
Advanced Security System for DeepSea eDNA API
JWT Authentication, Role-Based Access Control, OAuth2, and Token Management
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = "your-secret-key-change-in-production"  # TODO: Move to environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


class UserRole(str, Enum):
    """User role enumeration"""
    ADMIN = "admin"
    SCIENTIST = "scientist"
    VIEWER = "viewer"
    API_USER = "api_user"


class Permission(str, Enum):
    """Permission enumeration"""
    # Prediction permissions
    PREDICT = "predict"
    PREDICT_BATCH = "predict:batch"
    
    # Model permissions
    MODEL_VIEW = "model:view"
    MODEL_MANAGE = "model:manage"
    
    # Version permissions
    VERSION_VIEW = "version:view"
    VERSION_MANAGE = "version:manage"
    
    # Experiment permissions
    EXPERIMENT_VIEW = "experiment:view"
    EXPERIMENT_MANAGE = "experiment:manage"
    
    # Cache permissions
    CACHE_VIEW = "cache:view"
    CACHE_MANAGE = "cache:manage"
    
    # Monitoring permissions
    MONITORING_VIEW = "monitoring:view"
    
    # Admin permissions
    USER_MANAGE = "user:manage"
    SYSTEM_ADMIN = "system:admin"


# Role -> Permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.ADMIN: {
        # Admin has all permissions
        Permission.PREDICT,
        Permission.PREDICT_BATCH,
        Permission.MODEL_VIEW,
        Permission.MODEL_MANAGE,
        Permission.VERSION_VIEW,
        Permission.VERSION_MANAGE,
        Permission.EXPERIMENT_VIEW,
        Permission.EXPERIMENT_MANAGE,
        Permission.CACHE_VIEW,
        Permission.CACHE_MANAGE,
        Permission.MONITORING_VIEW,
        Permission.USER_MANAGE,
        Permission.SYSTEM_ADMIN,
    },
    UserRole.SCIENTIST: {
        # Scientists can predict, view/manage models and experiments
        Permission.PREDICT,
        Permission.PREDICT_BATCH,
        Permission.MODEL_VIEW,
        Permission.MODEL_MANAGE,
        Permission.VERSION_VIEW,
        Permission.VERSION_MANAGE,
        Permission.EXPERIMENT_VIEW,
        Permission.EXPERIMENT_MANAGE,
        Permission.CACHE_VIEW,
        Permission.MONITORING_VIEW,
    },
    UserRole.VIEWER: {
        # Viewers can only view, not modify
        Permission.PREDICT,
        Permission.MODEL_VIEW,
        Permission.VERSION_VIEW,
        Permission.EXPERIMENT_VIEW,
        Permission.CACHE_VIEW,
        Permission.MONITORING_VIEW,
    },
    UserRole.API_USER: {
        # API users can only make predictions
        Permission.PREDICT,
        Permission.PREDICT_BATCH,
    },
}


@dataclass
class User:
    """User model"""
    username: str
    email: str
    full_name: str
    role: str
    hashed_password: str
    disabled: bool = False
    created_at: str = None
    last_login: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()


class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data"""
    username: Optional[str] = None
    role: Optional[str] = None


class UserCreate(BaseModel):
    """User creation model"""
    username: str
    email: str
    full_name: str
    password: str
    role: UserRole = UserRole.VIEWER


class UserResponse(BaseModel):
    """User response model"""
    username: str
    email: str
    full_name: str
    role: str
    disabled: bool
    created_at: str
    last_login: Optional[str] = None


class SecurityManager:
    """
    Advanced Security Manager
    Handles JWT authentication, RBAC, and user management
    """
    
    def __init__(self, users_db_path: str = "./ml_models/users.json"):
        self.users_db_path = Path(users_db_path)
        self.users_db_path.parent.mkdir(parents=True, exist_ok=True)
        self.users: Dict[str, User] = {}
        self.revoked_tokens: Set[str] = set()
        self._load_users()
        self._ensure_default_admin()
        logger.info(f"SecurityManager initialized: {len(self.users)} users loaded")
    
    def _load_users(self):
        """Load users from disk"""
        if self.users_db_path.exists():
            try:
                with open(self.users_db_path, 'r') as f:
                    data = json.load(f)
                    self.users = {
                        username: User(**user_data)
                        for username, user_data in data.get('users', {}).items()
                    }
                    self.revoked_tokens = set(data.get('revoked_tokens', []))
                logger.info(f"Loaded {len(self.users)} users")
            except Exception as e:
                logger.error(f"Error loading users: {e}")
                self.users = {}
        else:
            logger.info("No existing users database found")
    
    def _save_users(self):
        """Save users to disk"""
        try:
            data = {
                'users': {
                    username: asdict(user)
                    for username, user in self.users.items()
                },
                'revoked_tokens': list(self.revoked_tokens),
                'last_updated': datetime.utcnow().isoformat()
            }
            with open(self.users_db_path, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info("Users database saved")
        except Exception as e:
            logger.error(f"Error saving users: {e}")
            raise
    
    def _ensure_default_admin(self):
        """Ensure default admin user exists"""
        if "admin" not in self.users:
            admin_user = User(
                username="admin",
                email="admin@deepsea-edna.local",
                full_name="System Administrator",
                role=UserRole.ADMIN.value,
                hashed_password=self.get_password_hash("admin123"),  # Default password
                created_at=datetime.utcnow().isoformat()
            )
            self.users["admin"] = admin_user
            self._save_users()
            logger.warning("Created default admin user (username: admin, password: admin123)")
    
    # ==================== Password Management ====================
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    # ==================== User Management ====================
    
    def get_user(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.users.get(username)
    
    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate a user"""
        user = self.get_user(username)
        if not user:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        if user.disabled:
            return None
        
        # Update last login
        user.last_login = datetime.utcnow().isoformat()
        self._save_users()
        
        return user
    
    def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        if user_data.username in self.users:
            raise ValueError(f"User {user_data.username} already exists")
        
        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            role=user_data.role.value,
            hashed_password=self.get_password_hash(user_data.password)
        )
        
        self.users[user_data.username] = user
        self._save_users()
        
        logger.info(f"Created user: {user_data.username} with role {user_data.role}")
        return user
    
    def update_user(self, username: str, **kwargs) -> Optional[User]:
        """Update user information"""
        user = self.get_user(username)
        if not user:
            return None
        
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        self._save_users()
        return user
    
    def delete_user(self, username: str) -> bool:
        """Delete a user"""
        if username not in self.users:
            return False
        
        # Prevent deleting default admin
        if username == "admin":
            raise ValueError("Cannot delete default admin user")
        
        del self.users[username]
        self._save_users()
        logger.info(f"Deleted user: {username}")
        return True
    
    def list_users(self) -> List[User]:
        """List all users"""
        return list(self.users.values())
    
    # ==================== Token Management ====================
    
    def create_access_token(
        self,
        data: dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify and decode JWT token"""
        try:
            # Check if token is revoked
            if token in self.revoked_tokens:
                return None
            
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            role: str = payload.get("role")
            
            if username is None:
                return None
            
            return TokenData(username=username, role=role)
        except JWTError:
            return None
    
    def revoke_token(self, token: str):
        """Revoke a token"""
        self.revoked_tokens.add(token)
        # Keep only recent revoked tokens (last 7 days worth)
        if len(self.revoked_tokens) > 10000:
            self.revoked_tokens = set(list(self.revoked_tokens)[-5000:])
        self._save_users()
    
    # ==================== RBAC (Role-Based Access Control) ====================
    
    def has_permission(self, user: User, permission: Permission) -> bool:
        """Check if user has a specific permission"""
        user_role = UserRole(user.role)
        user_permissions = ROLE_PERMISSIONS.get(user_role, set())
        return permission in user_permissions
    
    def require_permission(self, permission: Permission):
        """Dependency to require a specific permission"""
        async def permission_checker(
            token: str = Depends(oauth2_scheme),
            security_manager: 'SecurityManager' = None  # Injected via app state
        ):
            # Verify token
            token_data = security_manager.verify_token(token)
            if token_data is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Get user
            user = security_manager.get_user(token_data.username)
            if user is None or user.disabled:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or disabled"
                )
            
            # Check permission
            if not security_manager.has_permission(user, permission):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {permission.value}"
                )
            
            return user
        
        return permission_checker
    
    def require_role(self, *roles: UserRole):
        """Dependency to require specific roles"""
        async def role_checker(
            token: str = Depends(oauth2_scheme),
            security_manager: 'SecurityManager' = None
        ):
            # Verify token
            token_data = security_manager.verify_token(token)
            if token_data is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials"
                )
            
            # Get user
            user = security_manager.get_user(token_data.username)
            if user is None or user.disabled:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or disabled"
                )
            
            # Check role
            if UserRole(user.role) not in roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient privileges. Required roles: {[r.value for r in roles]}"
                )
            
            return user
        
        return role_checker
    
    # ==================== Statistics ====================
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get security statistics"""
        role_counts = {}
        for role in UserRole:
            role_counts[role.value] = sum(1 for u in self.users.values() if u.role == role.value)
        
        return {
            "total_users": len(self.users),
            "active_users": sum(1 for u in self.users.values() if not u.disabled),
            "disabled_users": sum(1 for u in self.users.values() if u.disabled),
            "users_by_role": role_counts,
            "revoked_tokens": len(self.revoked_tokens),
            "roles_available": [r.value for r in UserRole],
            "permissions_available": [p.value for p in Permission]
        }
