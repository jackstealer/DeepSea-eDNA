"""
Quality Control and Confidence Analysis
"""
from typing import Dict, List, Tuple
import torch
from enum import Enum


class QualityLevel(str, Enum):
    """Quality assessment levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    CRITICAL = "critical"


class ConfidenceThresholds:
    """
    Confidence thresholds for quality assessment
    """
    HIGH = 0.85       # > 85% = High confidence, reliable
    MEDIUM = 0.70     # 70-85% = Medium confidence, acceptable
    LOW = 0.50        # 50-70% = Low confidence, review suggested
    CRITICAL = 0.50   # < 50% = Critical, manual review required


class QualityController:
    """
    Quality control for predictions
    """
    
    @staticmethod
    def assess_confidence(confidence: float) -> QualityLevel:
        """
        Assess quality level based on confidence score
        """
        if confidence >= ConfidenceThresholds.HIGH:
            return QualityLevel.HIGH
        elif confidence >= ConfidenceThresholds.MEDIUM:
            return QualityLevel.MEDIUM
        elif confidence >= ConfidenceThresholds.LOW:
            return QualityLevel.LOW
        else:
            return QualityLevel.CRITICAL
    
    @staticmethod
    def get_quality_message(quality: QualityLevel) -> str:
        """
        Get user-friendly message for quality level
        """
        messages = {
            QualityLevel.HIGH: "High confidence - Reliable prediction",
            QualityLevel.MEDIUM: "Medium confidence - Acceptable prediction",
            QualityLevel.LOW: "Low confidence - Consider reviewing this prediction",
            QualityLevel.CRITICAL: "Critical - Manual review strongly recommended"
        }
        return messages.get(quality, "Unknown quality level")
    
    @staticmethod
    def get_recommendation(quality: QualityLevel) -> str:
        """
        Get action recommendation based on quality
        """
        recommendations = {
            QualityLevel.HIGH: "proceed",
            QualityLevel.MEDIUM: "proceed_with_caution",
            QualityLevel.LOW: "manual_review_suggested",
            QualityLevel.CRITICAL: "manual_review_required"
        }
        return recommendations.get(quality, "unknown")
    
    @staticmethod
    def should_alert(confidence: float, threshold: float = ConfidenceThresholds.LOW) -> bool:
        """
        Determine if alert should be triggered
        """
        return confidence < threshold
    
    @staticmethod
    def get_top_predictions(
        logits: torch.Tensor,
        taxonomy_map: Dict,
        top_k: int = 3
    ) -> List[Dict]:
        """
        Get top K predictions with probabilities
        
        Args:
            logits: Model output logits
            taxonomy_map: Mapping of class IDs to names
            top_k: Number of top predictions to return
        
        Returns:
            List of {class_id, class_name, probability} sorted by probability
        """
        # Apply softmax to get probabilities
        probabilities = torch.softmax(logits, dim=1)[0]
        
        # Get top K predictions
        top_probs, top_indices = torch.topk(probabilities, min(top_k, len(probabilities)))
        
        results = []
        for prob, idx in zip(top_probs, top_indices):
            class_id = int(idx)
            class_info = taxonomy_map.get(str(class_id), {
                "name": f"Class_{class_id}",
                "common_name": "Unknown"
            })
            
            results.append({
                "class_id": class_id,
                "class_name": class_info["name"],
                "common_name": class_info["common_name"],
                "probability": float(prob),
                "percentage": float(prob) * 100
            })
        
        return results
    
    @staticmethod
    def calculate_entropy(probabilities: torch.Tensor) -> float:
        """
        Calculate Shannon entropy of prediction
        Higher entropy = more uncertainty
        
        Returns:
            Entropy value (0 = certain, higher = uncertain)
        """
        # Avoid log(0)
        probs = probabilities[probabilities > 0]
        entropy = -torch.sum(probs * torch.log2(probs))
        return float(entropy)
    
    @staticmethod
    def check_ambiguity(
        top_predictions: List[Dict],
        margin_threshold: float = 0.1
    ) -> Tuple[bool, str]:
        """
        Check if prediction is ambiguous (similar probabilities for top classes)
        
        Args:
            top_predictions: List of top predictions
            margin_threshold: Minimum probability difference to be unambiguous
        
        Returns:
            (is_ambiguous, explanation)
        """
        if len(top_predictions) < 2:
            return False, "Only one class available"
        
        top1 = top_predictions[0]["probability"]
        top2 = top_predictions[1]["probability"]
        
        margin = top1 - top2
        
        if margin < margin_threshold:
            return True, f"Top two predictions are very close ({margin*100:.1f}% difference)"
        
        return False, f"Clear winner ({margin*100:.1f}% margin)"
    
    @staticmethod
    def analyze_sequence_quality(sequence: str) -> Dict:
        """
        Analyze DNA sequence quality
        
        Returns:
            Quality metrics about the sequence
        """
        seq_upper = sequence.upper()
        length = len(seq_upper)
        
        # Count each base
        a_count = seq_upper.count('A')
        c_count = seq_upper.count('C')
        g_count = seq_upper.count('G')
        t_count = seq_upper.count('T')
        n_count = seq_upper.count('N')
        
        # Calculate percentages
        gc_content = (g_count + c_count) / length * 100 if length > 0 else 0
        n_percentage = n_count / length * 100 if length > 0 else 0
        
        # Assess quality
        quality_issues = []
        
        if n_percentage > 10:
            quality_issues.append(f"High ambiguous base content ({n_percentage:.1f}%)")
        
        if gc_content < 30 or gc_content > 70:
            quality_issues.append(f"Unusual GC content ({gc_content:.1f}%)")
        
        if length < 100:
            quality_issues.append(f"Short sequence ({length} bp)")
        
        return {
            "length": length,
            "gc_content": round(gc_content, 2),
            "n_percentage": round(n_percentage, 2),
            "base_counts": {
                "A": a_count,
                "C": c_count,
                "G": g_count,
                "T": t_count,
                "N": n_count
            },
            "quality_issues": quality_issues,
            "sequence_quality": "good" if not quality_issues else "warning"
        }
    
    @staticmethod
    def generate_quality_report(
        sequence: str,
        prediction: Dict,
        top_predictions: List[Dict],
        confidence: float
    ) -> Dict:
        """
        Generate comprehensive quality report
        
        Returns:
            Complete quality assessment
        """
        # Assess confidence quality
        quality_level = QualityController.assess_confidence(confidence)
        
        # Check for ambiguity
        is_ambiguous, ambiguity_reason = QualityController.check_ambiguity(top_predictions)
        
        # Analyze sequence quality
        seq_quality = QualityController.analyze_sequence_quality(sequence)
        
        # Generate recommendation
        recommendation = QualityController.get_recommendation(quality_level)
        
        # Determine if alert should be triggered
        alert_triggered = QualityController.should_alert(confidence)
        
        # Generate warnings
        warnings = []
        if quality_level == QualityLevel.CRITICAL:
            warnings.append("⚠️ Very low confidence - Manual review required")
        elif quality_level == QualityLevel.LOW:
            warnings.append("⚠️ Low confidence - Consider manual review")
        
        if is_ambiguous:
            warnings.append(f"⚠️ Ambiguous prediction - {ambiguity_reason}")
        
        if seq_quality["quality_issues"]:
            for issue in seq_quality["quality_issues"]:
                warnings.append(f"⚠️ Sequence quality: {issue}")
        
        return {
            "quality_level": quality_level,
            "quality_message": QualityController.get_quality_message(quality_level),
            "recommendation": recommendation,
            "alert_triggered": alert_triggered,
            "warnings": warnings,
            "is_ambiguous": is_ambiguous,
            "ambiguity_reason": ambiguity_reason,
            "sequence_quality": seq_quality,
            "alternative_predictions": top_predictions[1:] if len(top_predictions) > 1 else []
        }


class AlertManager:
    """
    Manage alerts for low-confidence predictions
    """
    
    def __init__(self):
        self.alerts = []
    
    def create_alert(
        self,
        prediction_id: int,
        sequence: str,
        confidence: float,
        quality_level: QualityLevel,
        warnings: List[str]
    ) -> Dict:
        """
        Create alert for low-confidence prediction
        """
        alert = {
            "alert_id": f"alert_{prediction_id}",
            "prediction_id": prediction_id,
            "sequence_length": len(sequence),
            "confidence": confidence,
            "quality_level": quality_level,
            "warnings": warnings,
            "timestamp": "2026-11-08T12:00:00",  # Use datetime.utcnow() in production
            "status": "pending_review"
        }
        
        self.alerts.append(alert)
        return alert
    
    def get_alerts(self, min_severity: QualityLevel = QualityLevel.LOW) -> List[Dict]:
        """
        Get all alerts above minimum severity
        """
        severity_order = {
            QualityLevel.HIGH: 0,
            QualityLevel.MEDIUM: 1,
            QualityLevel.LOW: 2,
            QualityLevel.CRITICAL: 3
        }
        
        min_level = severity_order[min_severity]
        
        return [
            alert for alert in self.alerts
            if severity_order[alert["quality_level"]] >= min_level
        ]
