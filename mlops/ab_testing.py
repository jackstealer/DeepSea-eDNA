"""
A/B Testing System for DeepSea eDNA API
Enables live model comparison with traffic splitting and performance tracking
"""
import json
import logging
import random
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import statistics

logger = logging.getLogger(__name__)


class ExperimentStatus(Enum):
    """Experiment status states"""
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrafficSplitStrategy(Enum):
    """Traffic splitting strategies"""
    RANDOM = "random"  # Random split
    HASH = "hash"  # Consistent hashing (same user gets same version)
    GRADUAL = "gradual"  # Gradual rollout with increasing percentages


@dataclass
class ExperimentVariant:
    """A/B test variant (model version)"""
    variant_id: str
    variant_name: str
    version_id: str
    traffic_percentage: float
    prediction_count: int = 0
    total_confidence: float = 0.0
    success_count: int = 0
    error_count: int = 0
    confidence_scores: List[float] = None
    
    def __post_init__(self):
        if self.confidence_scores is None:
            self.confidence_scores = []


@dataclass
class Experiment:
    """A/B test experiment"""
    experiment_id: str
    experiment_name: str
    description: str
    variants: List[ExperimentVariant]
    strategy: str
    status: str
    created_at: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_days: Optional[int] = None
    winner: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ABTestManager:
    """
    A/B Testing Manager for model comparison experiments
    """
    
    def __init__(self, experiments_path: str = "./ml_models/experiments.json"):
        self.experiments_path = Path(experiments_path)
        self.experiments_path.parent.mkdir(parents=True, exist_ok=True)
        self.experiments: Dict[str, Experiment] = {}
        self.active_experiment: Optional[str] = None
        self._load_experiments()
        logger.info(f"ABTestManager initialized: {len(self.experiments)} experiments loaded")
    
    def _load_experiments(self):
        """Load experiments from disk"""
        if self.experiments_path.exists():
            try:
                with open(self.experiments_path, 'r') as f:
                    data = json.load(f)
                    
                    # Load experiments
                    for exp_id, exp_data in data.get('experiments', {}).items():
                        # Reconstruct variants
                        variants = [
                            ExperimentVariant(**v) for v in exp_data['variants']
                        ]
                        exp_data['variants'] = variants
                        self.experiments[exp_id] = Experiment(**exp_data)
                    
                    # Load active experiment
                    self.active_experiment = data.get('active_experiment')
                    
                logger.info(f"Loaded {len(self.experiments)} experiments")
            except Exception as e:
                logger.error(f"Error loading experiments: {e}")
                self.experiments = {}
        else:
            logger.info("No existing experiments found")
    
    def _save_experiments(self):
        """Save experiments to disk"""
        try:
            # Convert experiments to dict
            experiments_dict = {}
            for exp_id, exp in self.experiments.items():
                exp_dict = asdict(exp)
                experiments_dict[exp_id] = exp_dict
            
            data = {
                'experiments': experiments_dict,
                'active_experiment': self.active_experiment,
                'last_updated': datetime.utcnow().isoformat()
            }
            
            with open(self.experiments_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            
            logger.info("Experiments saved successfully")
        except Exception as e:
            logger.error(f"Error saving experiments: {e}")
            raise
    
    def create_experiment(
        self,
        experiment_name: str,
        description: str,
        variant_configs: List[Dict[str, Any]],
        strategy: str = "random",
        duration_days: Optional[int] = None
    ) -> Experiment:
        """
        Create a new A/B test experiment
        
        Args:
            experiment_name: Human-readable experiment name
            description: Experiment description
            variant_configs: List of variant configurations
                [{"name": "control", "version_id": "v1", "traffic": 50}, ...]
            strategy: Traffic split strategy (random, hash, gradual)
            duration_days: Experiment duration (None = unlimited)
        
        Returns:
            Experiment object
        """
        # Validate traffic percentages sum to 100
        total_traffic = sum(v['traffic'] for v in variant_configs)
        if abs(total_traffic - 100.0) > 0.01:
            raise ValueError(f"Traffic percentages must sum to 100, got {total_traffic}")
        
        # Generate experiment ID
        experiment_id = f"exp_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Create variants
        variants = []
        for i, config in enumerate(variant_configs):
            variant = ExperimentVariant(
                variant_id=f"variant_{i}",
                variant_name=config['name'],
                version_id=config['version_id'],
                traffic_percentage=config['traffic'],
                confidence_scores=[]
            )
            variants.append(variant)
        
        # Create experiment
        experiment = Experiment(
            experiment_id=experiment_id,
            experiment_name=experiment_name,
            description=description,
            variants=variants,
            strategy=strategy,
            status=ExperimentStatus.DRAFT.value,
            created_at=datetime.utcnow().isoformat(),
            duration_days=duration_days
        )
        
        # Add to experiments
        self.experiments[experiment_id] = experiment
        self._save_experiments()
        
        logger.info(f"Created experiment: {experiment_id} with {len(variants)} variants")
        return experiment
    
    def start_experiment(self, experiment_id: str) -> bool:
        """Start an experiment"""
        if experiment_id not in self.experiments:
            logger.error(f"Experiment {experiment_id} not found")
            return False
        
        experiment = self.experiments[experiment_id]
        
        # Check if another experiment is active
        if self.active_experiment and self.active_experiment != experiment_id:
            logger.warning(f"Another experiment is active: {self.active_experiment}")
            return False
        
        # Start experiment
        experiment.status = ExperimentStatus.RUNNING.value
        experiment.started_at = datetime.utcnow().isoformat()
        self.active_experiment = experiment_id
        
        self._save_experiments()
        logger.info(f"Started experiment: {experiment_id}")
        return True
    
    def stop_experiment(self, experiment_id: str, declare_winner: bool = False) -> bool:
        """Stop an experiment"""
        if experiment_id not in self.experiments:
            return False
        
        experiment = self.experiments[experiment_id]
        experiment.status = ExperimentStatus.COMPLETED.value
        experiment.ended_at = datetime.utcnow().isoformat()
        
        # Determine winner if requested
        if declare_winner:
            winner = self._determine_winner(experiment)
            experiment.winner = winner
        
        # Clear active experiment
        if self.active_experiment == experiment_id:
            self.active_experiment = None
        
        self._save_experiments()
        logger.info(f"Stopped experiment: {experiment_id}")
        return True
    
    def pause_experiment(self, experiment_id: str) -> bool:
        """Pause an experiment"""
        if experiment_id not in self.experiments:
            return False
        
        experiment = self.experiments[experiment_id]
        experiment.status = ExperimentStatus.PAUSED.value
        
        self._save_experiments()
        logger.info(f"Paused experiment: {experiment_id}")
        return True
    
    def resume_experiment(self, experiment_id: str) -> bool:
        """Resume a paused experiment"""
        if experiment_id not in self.experiments:
            return False
        
        experiment = self.experiments[experiment_id]
        if experiment.status != ExperimentStatus.PAUSED.value:
            logger.warning(f"Experiment {experiment_id} is not paused")
            return False
        
        experiment.status = ExperimentStatus.RUNNING.value
        self.active_experiment = experiment_id
        
        self._save_experiments()
        logger.info(f"Resumed experiment: {experiment_id}")
        return True
    
    def select_variant(self, experiment_id: str, user_id: Optional[str] = None) -> Optional[str]:
        """
        Select a variant for a request based on traffic splitting strategy
        
        Args:
            experiment_id: Experiment ID
            user_id: Optional user identifier for consistent hashing
        
        Returns:
            Variant version_id or None
        """
        if experiment_id not in self.experiments:
            return None
        
        experiment = self.experiments[experiment_id]
        
        if experiment.status != ExperimentStatus.RUNNING.value:
            return None
        
        # Select variant based on strategy
        if experiment.strategy == TrafficSplitStrategy.HASH.value and user_id:
            # Consistent hashing
            variant = self._hash_based_selection(experiment, user_id)
        else:
            # Random selection (default)
            variant = self._random_selection(experiment)
        
        return variant.version_id if variant else None
    
    def _random_selection(self, experiment: Experiment) -> Optional[ExperimentVariant]:
        """Random variant selection"""
        rand_value = random.random() * 100
        cumulative = 0
        
        for variant in experiment.variants:
            cumulative += variant.traffic_percentage
            if rand_value <= cumulative:
                return variant
        
        # Fallback to first variant
        return experiment.variants[0] if experiment.variants else None
    
    def _hash_based_selection(self, experiment: Experiment, user_id: str) -> Optional[ExperimentVariant]:
        """Consistent hash-based variant selection"""
        # Hash user_id to get consistent value
        hash_value = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        
        cumulative = 0
        for variant in experiment.variants:
            cumulative += variant.traffic_percentage
            if hash_value <= cumulative:
                return variant
        
        return experiment.variants[0] if experiment.variants else None
    
    def record_prediction(
        self,
        experiment_id: str,
        variant_id: str,
        confidence: float,
        success: bool = True
    ):
        """Record a prediction result for a variant"""
        if experiment_id not in self.experiments:
            return
        
        experiment = self.experiments[experiment_id]
        
        # Find variant
        variant = next((v for v in experiment.variants if v.variant_id == variant_id), None)
        if not variant:
            return
        
        # Update metrics
        variant.prediction_count += 1
        variant.total_confidence += confidence
        variant.confidence_scores.append(confidence)
        
        # Keep only last 1000 scores to avoid memory issues
        if len(variant.confidence_scores) > 1000:
            variant.confidence_scores = variant.confidence_scores[-1000:]
        
        if success:
            variant.success_count += 1
        else:
            variant.error_count += 1
        
        # Save periodically (every 10 predictions)
        if variant.prediction_count % 10 == 0:
            self._save_experiments()
    
    def get_experiment_results(self, experiment_id: str) -> Dict[str, Any]:
        """Get comprehensive experiment results"""
        if experiment_id not in self.experiments:
            raise ValueError("Experiment not found")
        
        experiment = self.experiments[experiment_id]
        
        # Calculate variant metrics
        variant_results = []
        for variant in experiment.variants:
            avg_confidence = (
                variant.total_confidence / variant.prediction_count
                if variant.prediction_count > 0 else 0
            )
            
            success_rate = (
                variant.success_count / variant.prediction_count * 100
                if variant.prediction_count > 0 else 0
            )
            
            # Calculate confidence interval
            ci_lower, ci_upper = self._calculate_confidence_interval(
                variant.confidence_scores
            )
            
            variant_results.append({
                "variant_id": variant.variant_id,
                "variant_name": variant.variant_name,
                "version_id": variant.version_id,
                "traffic_percentage": variant.traffic_percentage,
                "prediction_count": variant.prediction_count,
                "avg_confidence": round(avg_confidence, 4),
                "success_rate": round(success_rate, 2),
                "error_count": variant.error_count,
                "confidence_interval": {
                    "lower": round(ci_lower, 4),
                    "upper": round(ci_upper, 4)
                }
            })
        
        # Statistical comparison
        statistical_analysis = self._statistical_comparison(experiment)
        
        return {
            "experiment_id": experiment.experiment_id,
            "experiment_name": experiment.experiment_name,
            "status": experiment.status,
            "started_at": experiment.started_at,
            "ended_at": experiment.ended_at,
            "duration_days": experiment.duration_days,
            "winner": experiment.winner,
            "variants": variant_results,
            "statistical_analysis": statistical_analysis
        }
    
    def _calculate_confidence_interval(
        self,
        scores: List[float],
        confidence_level: float = 0.95
    ) -> Tuple[float, float]:
        """Calculate confidence interval for scores"""
        if not scores or len(scores) < 2:
            return (0.0, 0.0)
        
        try:
            mean = statistics.mean(scores)
            stdev = statistics.stdev(scores)
            n = len(scores)
            
            # Using normal approximation (z-score for 95% = 1.96)
            z_score = 1.96 if confidence_level == 0.95 else 1.645
            margin = z_score * (stdev / (n ** 0.5))
            
            return (max(0, mean - margin), min(1, mean + margin))
        except Exception as e:
            logger.error(f"Error calculating confidence interval: {e}")
            return (0.0, 0.0)
    
    def _statistical_comparison(self, experiment: Experiment) -> Dict[str, Any]:
        """Perform statistical comparison between variants"""
        if len(experiment.variants) < 2:
            return {"message": "Need at least 2 variants for comparison"}
        
        # Compare first two variants (control vs treatment)
        control = experiment.variants[0]
        treatment = experiment.variants[1]
        
        if control.prediction_count < 30 or treatment.prediction_count < 30:
            return {
                "message": "Insufficient data for statistical significance (need 30+ samples)",
                "control_samples": control.prediction_count,
                "treatment_samples": treatment.prediction_count
            }
        
        # Calculate means
        control_mean = control.total_confidence / control.prediction_count
        treatment_mean = treatment.total_confidence / treatment.prediction_count
        
        # Calculate improvement
        improvement = ((treatment_mean - control_mean) / control_mean * 100) if control_mean > 0 else 0
        
        # Simple significance check (confidence intervals don't overlap)
        control_ci = self._calculate_confidence_interval(control.confidence_scores)
        treatment_ci = self._calculate_confidence_interval(treatment.confidence_scores)
        
        significant = control_ci[1] < treatment_ci[0] or treatment_ci[1] < control_ci[0]
        
        return {
            "control": {
                "variant_name": control.variant_name,
                "mean_confidence": round(control_mean, 4),
                "samples": control.prediction_count,
                "confidence_interval": [round(control_ci[0], 4), round(control_ci[1], 4)]
            },
            "treatment": {
                "variant_name": treatment.variant_name,
                "mean_confidence": round(treatment_mean, 4),
                "samples": treatment.prediction_count,
                "confidence_interval": [round(treatment_ci[0], 4), round(treatment_ci[1], 4)]
            },
            "improvement_percent": round(improvement, 2),
            "statistically_significant": significant,
            "recommendation": self._get_recommendation(improvement, significant)
        }
    
    def _get_recommendation(self, improvement: float, significant: bool) -> str:
        """Get recommendation based on results"""
        if not significant:
            return "Continue experiment - results not yet statistically significant"
        
        if improvement > 2:
            return "🎉 Treatment performs significantly better - consider rolling out"
        elif improvement < -2:
            return "⚠️ Treatment performs significantly worse - consider stopping"
        else:
            return "Results are similar - choose based on other factors"
    
    def _determine_winner(self, experiment: Experiment) -> Optional[str]:
        """Determine winning variant based on performance"""
        if not experiment.variants:
            return None
        
        # Find variant with highest average confidence
        best_variant = max(
            experiment.variants,
            key=lambda v: (v.total_confidence / v.prediction_count) if v.prediction_count > 0 else 0
        )
        
        return best_variant.version_id
    
    def list_experiments(
        self,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List experiments with optional status filter"""
        experiments = list(self.experiments.values())
        
        if status:
            experiments = [e for e in experiments if e.status == status]
        
        # Sort by creation date (newest first)
        experiments.sort(key=lambda e: e.created_at, reverse=True)
        
        return [
            {
                "experiment_id": e.experiment_id,
                "experiment_name": e.experiment_name,
                "status": e.status,
                "created_at": e.created_at,
                "started_at": e.started_at,
                "variants": [
                    {
                        "name": v.variant_name,
                        "version_id": v.version_id,
                        "traffic": v.traffic_percentage,
                        "predictions": v.prediction_count
                    }
                    for v in e.variants
                ]
            }
            for e in experiments
        ]
    
    def get_active_experiment(self) -> Optional[Experiment]:
        """Get currently active experiment"""
        if not self.active_experiment:
            return None
        return self.experiments.get(self.active_experiment)
