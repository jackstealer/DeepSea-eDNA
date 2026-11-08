"""
Model Versioning System for DeepSea eDNA API
Tracks model versions, enables comparisons, and supports rollback
"""
import json
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class ModelVersion:
    """Model version metadata"""
    version_id: str
    version_name: str
    model_path: str
    created_at: str
    description: str
    metrics: Dict[str, float]
    training_info: Dict[str, Any]
    status: str  # active, archived, deprecated
    is_current: bool
    checksum: str
    tags: List[str]


class ModelVersionRegistry:
    """
    Model version registry and management system
    """
    
    def __init__(self, registry_path: str = "./ml_models/registry.json"):
        self.registry_path = Path(registry_path)
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        self.versions: Dict[str, ModelVersion] = {}
        self._load_registry()
        logger.info(f"ModelVersionRegistry initialized: {len(self.versions)} versions loaded")
    
    def _load_registry(self):
        """Load registry from disk"""
        if self.registry_path.exists():
            try:
                with open(self.registry_path, 'r') as f:
                    data = json.load(f)
                    self.versions = {
                        vid: ModelVersion(**vdata) 
                        for vid, vdata in data.get('versions', {}).items()
                    }
                logger.info(f"Loaded {len(self.versions)} versions from registry")
            except Exception as e:
                logger.error(f"Error loading registry: {e}")
                self.versions = {}
        else:
            logger.info("No existing registry found, starting fresh")
    
    def _save_registry(self):
        """Save registry to disk"""
        try:
            data = {
                'versions': {
                    vid: asdict(version) 
                    for vid, version in self.versions.items()
                },
                'last_updated': datetime.utcnow().isoformat()
            }
            with open(self.registry_path, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info("Registry saved successfully")
        except Exception as e:
            logger.error(f"Error saving registry: {e}")
            raise
    
    def _calculate_checksum(self, model_path: Path) -> str:
        """Calculate checksum for model file"""
        try:
            # Check for .pth or .h5 file
            model_file = None
            for ext in ['.pth', '.h5', '.pt']:
                candidate = model_path / f'best_model{ext}'
                if candidate.exists():
                    model_file = candidate
                    break
                # Try marine_model.h5
                candidate = model_path / f'marine_model{ext}'
                if candidate.exists():
                    model_file = candidate
                    break
            
            if not model_file:
                logger.warning(f"No model file found in {model_path}")
                return "unknown"
            
            sha256_hash = hashlib.sha256()
            with open(model_file, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()[:16]  # Short hash
        except Exception as e:
            logger.error(f"Error calculating checksum: {e}")
            return "error"
    
    def register_version(
        self,
        version_name: str,
        model_path: str,
        description: str = "",
        metrics: Optional[Dict[str, float]] = None,
        training_info: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        set_as_current: bool = False
    ) -> ModelVersion:
        """
        Register a new model version
        
        Args:
            version_name: Human-readable version name (e.g., "v2.1", "marine_model_2024")
            model_path: Path to model directory
            description: Description of changes/improvements
            metrics: Performance metrics (accuracy, f1_score, etc.)
            training_info: Training metadata (epochs, batch_size, etc.)
            tags: Tags for categorization
            set_as_current: Set this version as current active model
        
        Returns:
            ModelVersion object
        """
        # Generate unique version ID
        version_id = f"{version_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Calculate checksum
        checksum = self._calculate_checksum(Path(model_path))
        
        # Create version object
        version = ModelVersion(
            version_id=version_id,
            version_name=version_name,
            model_path=str(model_path),
            created_at=datetime.utcnow().isoformat(),
            description=description,
            metrics=metrics or {},
            training_info=training_info or {},
            status="active",
            is_current=False,
            checksum=checksum,
            tags=tags or []
        )
        
        # Add to registry
        self.versions[version_id] = version
        
        # Set as current if requested
        if set_as_current:
            self.set_current_version(version_id)
        
        # Save registry
        self._save_registry()
        
        logger.info(f"Registered model version: {version_id}")
        return version
    
    def get_version(self, version_id: str) -> Optional[ModelVersion]:
        """Get version by ID"""
        return self.versions.get(version_id)
    
    def get_current_version(self) -> Optional[ModelVersion]:
        """Get currently active version"""
        for version in self.versions.values():
            if version.is_current:
                return version
        return None
    
    def set_current_version(self, version_id: str) -> bool:
        """Set a version as current active model"""
        if version_id not in self.versions:
            logger.error(f"Version {version_id} not found")
            return False
        
        # Unset all current flags
        for version in self.versions.values():
            version.is_current = False
        
        # Set new current
        self.versions[version_id].is_current = True
        self._save_registry()
        
        logger.info(f"Set current version to: {version_id}")
        return True
    
    def list_versions(
        self,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[ModelVersion]:
        """
        List versions with optional filters
        
        Args:
            status: Filter by status (active, archived, deprecated)
            tags: Filter by tags
        
        Returns:
            List of ModelVersion objects
        """
        versions = list(self.versions.values())
        
        # Filter by status
        if status:
            versions = [v for v in versions if v.status == status]
        
        # Filter by tags
        if tags:
            versions = [
                v for v in versions 
                if any(tag in v.tags for tag in tags)
            ]
        
        # Sort by creation date (newest first)
        versions.sort(key=lambda v: v.created_at, reverse=True)
        
        return versions
    
    def compare_versions(
        self,
        version_id_1: str,
        version_id_2: str
    ) -> Dict[str, Any]:
        """
        Compare two model versions
        
        Returns detailed comparison including metrics differences
        """
        v1 = self.get_version(version_id_1)
        v2 = self.get_version(version_id_2)
        
        if not v1 or not v2:
            raise ValueError("One or both versions not found")
        
        # Compare metrics
        metrics_comparison = {}
        all_metric_keys = set(v1.metrics.keys()) | set(v2.metrics.keys())
        
        for metric in all_metric_keys:
            val1 = v1.metrics.get(metric, None)
            val2 = v2.metrics.get(metric, None)
            
            if val1 is not None and val2 is not None:
                diff = val2 - val1
                pct_change = (diff / val1 * 100) if val1 != 0 else 0
                metrics_comparison[metric] = {
                    "version_1": val1,
                    "version_2": val2,
                    "difference": diff,
                    "percent_change": pct_change,
                    "improved": diff > 0  # Assuming higher is better
                }
            else:
                metrics_comparison[metric] = {
                    "version_1": val1,
                    "version_2": val2,
                    "difference": None,
                    "percent_change": None,
                    "improved": None
                }
        
        return {
            "version_1": {
                "id": v1.version_id,
                "name": v1.version_name,
                "created_at": v1.created_at,
                "status": v1.status,
                "is_current": v1.is_current
            },
            "version_2": {
                "id": v2.version_id,
                "name": v2.version_name,
                "created_at": v2.created_at,
                "status": v2.status,
                "is_current": v2.is_current
            },
            "metrics_comparison": metrics_comparison,
            "summary": self._generate_comparison_summary(metrics_comparison)
        }
    
    def _generate_comparison_summary(
        self,
        metrics_comparison: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate summary of comparison"""
        improved_count = sum(
            1 for m in metrics_comparison.values() 
            if m.get('improved') is True
        )
        degraded_count = sum(
            1 for m in metrics_comparison.values() 
            if m.get('improved') is False
        )
        unchanged_count = sum(
            1 for m in metrics_comparison.values() 
            if m.get('difference') == 0
        )
        
        return {
            "improved_metrics": improved_count,
            "degraded_metrics": degraded_count,
            "unchanged_metrics": unchanged_count,
            "overall": "improvement" if improved_count > degraded_count else "degradation" if degraded_count > improved_count else "neutral"
        }
    
    def archive_version(self, version_id: str) -> bool:
        """Archive a version (mark as archived but keep in registry)"""
        if version_id not in self.versions:
            return False
        
        version = self.versions[version_id]
        if version.is_current:
            logger.warning("Cannot archive current version")
            return False
        
        version.status = "archived"
        self._save_registry()
        logger.info(f"Archived version: {version_id}")
        return True
    
    def deprecate_version(self, version_id: str, reason: str = "") -> bool:
        """Mark a version as deprecated"""
        if version_id not in self.versions:
            return False
        
        version = self.versions[version_id]
        if version.is_current:
            logger.warning("Cannot deprecate current version")
            return False
        
        version.status = "deprecated"
        if reason:
            version.description = f"{version.description}\n[DEPRECATED: {reason}]"
        self._save_registry()
        logger.info(f"Deprecated version: {version_id}")
        return True
    
    def rollback_to_version(self, version_id: str) -> bool:
        """
        Rollback to a previous version (set as current)
        """
        if version_id not in self.versions:
            logger.error(f"Version {version_id} not found")
            return False
        
        version = self.versions[version_id]
        
        # Check if version is available
        if version.status == "deprecated":
            logger.warning(f"Attempting to rollback to deprecated version: {version_id}")
        
        # Set as current
        return self.set_current_version(version_id)
    
    def get_version_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get version history (chronological list of versions)
        
        Args:
            limit: Maximum number of versions to return
        
        Returns:
            List of version summaries
        """
        versions = sorted(
            self.versions.values(),
            key=lambda v: v.created_at,
            reverse=True
        )[:limit]
        
        history = []
        for v in versions:
            history.append({
                "version_id": v.version_id,
                "version_name": v.version_name,
                "created_at": v.created_at,
                "status": v.status,
                "is_current": v.is_current,
                "description": v.description,
                "key_metrics": {
                    k: v.metrics[k] 
                    for k in ['accuracy', 'f1_score', 'precision', 'recall'] 
                    if k in v.metrics
                },
                "tags": v.tags
            })
        
        return history
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get registry statistics"""
        total = len(self.versions)
        active = sum(1 for v in self.versions.values() if v.status == "active")
        archived = sum(1 for v in self.versions.values() if v.status == "archived")
        deprecated = sum(1 for v in self.versions.values() if v.status == "deprecated")
        
        current = self.get_current_version()
        
        return {
            "total_versions": total,
            "active_versions": active,
            "archived_versions": archived,
            "deprecated_versions": deprecated,
            "current_version": {
                "version_id": current.version_id,
                "version_name": current.version_name,
                "created_at": current.created_at,
                "metrics": current.metrics
            } if current else None,
            "registry_path": str(self.registry_path)
        }
