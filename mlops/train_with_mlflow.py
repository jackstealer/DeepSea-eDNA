"""
MLOps Training Script with MLflow Tracking
DeepSea eDNA Classification Model
"""
import os
import sys
from pathlib import Path
import torch
import mlflow
import mlflow.pytorch
from mlflow import MlflowClient

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from backend.training.train_model import train_classifier

# MLflow configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000")
mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
mlflow.set_experiment("DeepSea_eDNA_Classification")

# Training configuration
TRAINING_CONFIG = {
    "data_dir": str(Path(__file__).parent.parent / "data" / "training" / "marine_diverse"),
    "output_dir": str(Path(__file__).parent / "models"),
    "epochs": 150,
    "batch_size": 64,
    "learning_rate": 0.001,
    "device": "cuda" if torch.cuda.is_available() else "cpu",
    "validation_split": 0.2,
    "use_augmentation": True,
    "use_class_weights": True,
    "early_stopping_patience": 20,
    
    # Model hyperparameters
    "embedding_dim": 128,
    "hidden_dim": 256,
    "num_conv_layers": 3,
    "dropout": 0.4,
    "weight_decay": 5e-4,
}

# Quality gates
MIN_VAL_ACCURACY = 90.0  # Minimum 90% validation accuracy
MIN_VAL_F1 = 0.90        # Minimum 0.90 F1 score

def main():
    """Train model with MLflow tracking"""
    
    print("="*80)
    print("MLOps Training Pipeline - DeepSea eDNA Classification")
    print("="*80)
    print(f"MLflow Tracking URI: {MLFLOW_TRACKING_URI}")
    print(f"Device: {TRAINING_CONFIG['device']}")
    print("="*80)
    
    # Start MLflow run
    with mlflow.start_run() as run:
        print(f"\nMLflow Run ID: {run.info.run_id}")
        
        # Log training parameters
        mlflow.log_params(TRAINING_CONFIG)
        
        # Train the model
        print("\nStarting model training...")
        results = train_classifier(
            data_dir=TRAINING_CONFIG["data_dir"],
            output_dir=TRAINING_CONFIG["output_dir"],
            epochs=TRAINING_CONFIG["epochs"],
            batch_size=TRAINING_CONFIG["batch_size"],
            learning_rate=TRAINING_CONFIG["learning_rate"],
            device=TRAINING_CONFIG["device"],
            validation_split=TRAINING_CONFIG["validation_split"],
            use_augmentation=TRAINING_CONFIG["use_augmentation"],
            use_class_weights=TRAINING_CONFIG["use_class_weights"],
            early_stopping_patience=TRAINING_CONFIG["early_stopping_patience"]
        )
        
        # Extract final metrics
        best_val_loss = results["best_val_loss"]
        best_val_f1 = results["best_val_f1"]
        
        # Get final validation accuracy from training history
        val_acc = results["training_history"]["val_acc"][-1]
        
        print("\n" + "="*80)
        print("Training Complete - Final Metrics:")
        print("="*80)
        print(f"Best Validation Loss: {best_val_loss:.4f}")
        print(f"Best Validation F1: {best_val_f1:.4f}")
        print(f"Final Validation Accuracy: {val_acc:.2f}%")
        
        # Log metrics to MLflow
        mlflow.log_metrics({
            "best_val_loss": best_val_loss,
            "best_val_f1": best_val_f1,
            "final_val_accuracy": val_acc,
        })
        
        # Log all training history
        for epoch, (train_loss, train_acc, val_loss, val_acc_epoch, val_f1) in enumerate(zip(
            results["training_history"]["train_loss"],
            results["training_history"]["train_acc"],
            results["training_history"]["val_loss"],
            results["training_history"]["val_acc"],
            results["training_history"]["val_f1"]
        )):
            mlflow.log_metrics({
                "train_loss": train_loss,
                "train_acc": train_acc,
                "val_loss": val_loss,
                "val_acc": val_acc_epoch,
                "val_f1": val_f1,
            }, step=epoch)
        
        # Quality Gate Check
        print("\n" + "="*80)
        print("Quality Gate Validation:")
        print("="*80)
        
        quality_passed = True
        
        if val_acc < MIN_VAL_ACCURACY:
            print(f"❌ FAILED: Validation accuracy {val_acc:.2f}% < {MIN_VAL_ACCURACY}%")
            quality_passed = False
        else:
            print(f"✅ PASSED: Validation accuracy {val_acc:.2f}% >= {MIN_VAL_ACCURACY}%")
        
        if best_val_f1 < MIN_VAL_F1:
            print(f"❌ FAILED: Validation F1 {best_val_f1:.4f} < {MIN_VAL_F1}")
            quality_passed = False
        else:
            print(f"✅ PASSED: Validation F1 {best_val_f1:.4f} >= {MIN_VAL_F1}")
        
        if not quality_passed:
            mlflow.log_param("quality_gate_status", "FAILED")
            raise ValueError(
                f"Model rejected: Quality gates not met. "
                f"Val Acc: {val_acc:.2f}% (min: {MIN_VAL_ACCURACY}%), "
                f"Val F1: {best_val_f1:.4f} (min: {MIN_VAL_F1})"
            )
        
        mlflow.log_param("quality_gate_status", "PASSED")
        print("\n✅ All quality gates passed!")
        
        # Log model artifacts
        print("\n" + "="*80)
        print("Logging Model Artifacts to MLflow...")
        print("="*80)
        
        # Log the best model
        model_path = Path(TRAINING_CONFIG["output_dir"]) / "best_model.pth"
        
        # Log model to MLflow with PyTorch format
        mlflow.pytorch.log_model(
            pytorch_model=model_path,
            artifact_path="model",
            registered_model_name="DeepSeaeDNAClassifier"
        )
        
        # Log training curves and confusion matrix
        output_dir = Path(TRAINING_CONFIG["output_dir"])
        if (output_dir / "training_curves.png").exists():
            mlflow.log_artifact(str(output_dir / "training_curves.png"))
        if (output_dir / "confusion_matrix.png").exists():
            mlflow.log_artifact(str(output_dir / "confusion_matrix.png"))
        
        # Log configuration files
        if (output_dir / "model_config.json").exists():
            mlflow.log_artifact(str(output_dir / "model_config.json"))
        if (output_dir / "taxonomy_map.json").exists():
            mlflow.log_artifact(str(output_dir / "taxonomy_map.json"))
        
        print("✅ Model artifacts logged successfully")
        
        # Assign champion alias to the model
        print("\n" + "="*80)
        print("Registering Model as Champion...")
        print("="*80)
        
        client = MlflowClient()
        current_run_id = run.info.run_id
        
        # Get all versions of the registered model
        registered_versions = client.search_model_versions(
            "name = 'DeepSeaeDNAClassifier'"
        )
        
        # Find the version registered in this run
        current_model_version = next(
            (
                version
                for version in registered_versions
                if version.run_id == current_run_id
            ),
            None
        )
        
        if current_model_version:
            # Set champion alias
            client.set_registered_model_alias(
                name="DeepSeaeDNAClassifier",
                alias="champion",
                version=current_model_version.version
            )
            print(f"✅ Model version {current_model_version.version} registered as CHAMPION")
            mlflow.log_param("champion_version", current_model_version.version)
        
        print("\n" + "="*80)
        print("MLOps Training Pipeline Complete!")
        print("="*80)
        print(f"Run ID: {run.info.run_id}")
        print(f"Model: DeepSeaeDNAClassifier")
        print(f"Status: CHAMPION")
        print("="*80)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Training failed: {str(e)}")
        sys.exit(1)
