"""
MLOps FastAPI Application - DeepSea eDNA Classification
Production-ready API with MLflow integration
"""
import os
import sys
from pathlib import Path
from typing import List, Callable
from contextlib import asynccontextmanager

import torch
import mlflow
import mlflow.pytorch
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent / "backend"))

from backend.app.models.deep_learning import DeepTaxaClassifier, sequence_to_tensor

# MLflow configuration
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000")
MODEL_NAME = "DeepSeaeDNAClassifier"
MODEL_ALIAS = "champion"


def load_mlflow_model():
    """Load champion model from MLflow Model Registry"""
    import signal
    
    # Try MLflow first with timeout
    def timeout_handler(signum, frame):
        raise TimeoutError("MLflow connection timeout")
    
    # Skip MLflow if URI is not accessible (fail fast)
    mlflow_available = False
    try:
        import requests
        response = requests.get(MLFLOW_TRACKING_URI.replace(':5000', ':5000/health'), timeout=2)
        mlflow_available = response.status_code == 200
    except:
        print(f"⚠️  MLflow not accessible at {MLFLOW_TRACKING_URI}")
        mlflow_available = False
    
    if mlflow_available:
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        try:
            # Try to load from MLflow Model Registry
            model_uri = f"models:/{MODEL_NAME}@{MODEL_ALIAS}"
            model_artifacts = mlflow.pytorch.load_model(model_uri)
            print(f"✅ Loaded champion model from MLflow: {model_uri}")
            return model_artifacts
        except Exception as e:
            print(f"⚠️  Failed to load from MLflow: {e}")
    
    # Fallback to local model
    print("Loading from local model files...")
    local_model_path = Path(__file__).parent / "models" / "best_model.pth"
    if local_model_path.exists():
        print(f"Loading local model from {local_model_path}")
        checkpoint = torch.load(local_model_path, map_location="cpu")
        
        # Load model config
        config_path = Path(__file__).parent / "models" / "model_config.json"
        import json
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Initialize model
        model = DeepTaxaClassifier(
            num_classes=config['num_classes'],
            embedding_dim=config['embedding_dim'],
            hidden_dim=config['hidden_dim'],
            num_conv_layers=config['num_conv_layers'],
            dropout=config['dropout']
        )
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        print("✅ Loaded local model successfully")
        return model
    else:
        raise RuntimeError("No model found - neither in MLflow nor locally")


def get_model_version():
    """Get current champion model version from MLflow"""
    # Skip MLflow check if not accessible
    try:
        import requests
        response = requests.get(MLFLOW_TRACKING_URI.replace(':5000', ':5000/health'), timeout=2)
        if response.status_code != 200:
            return "local"
    except:
        return "local"
    
    try:
        client = mlflow.tracking.MlflowClient(tracking_uri=MLFLOW_TRACKING_URI)
        champion_version = client.get_model_version_by_alias(
            name=MODEL_NAME,
            alias=MODEL_ALIAS
        )
        return champion_version.version
    except:
        return "local"


def load_taxonomy_map():
    """Load taxonomy mapping"""
    taxonomy_path = Path(__file__).parent / "models" / "taxonomy_map.json"
    if taxonomy_path.exists():
        import json
        with open(taxonomy_path, 'r') as f:
            return json.load(f)
    else:
        # Default taxonomy
        return {
            "0": {"name": "Perciformes", "common_name": "Perch-like fishes"},
            "1": {"name": "Salmoniformes", "common_name": "Salmon"},
            "2": {"name": "Clupeiformes", "common_name": "Herring"},
            "3": {"name": "Gadiformes", "common_name": "Cod"},
            "4": {"name": "Pleuronectiformes", "common_name": "Flatfish"},
            "5": {"name": "Decapoda", "common_name": "Crabs/Lobsters"},
            "6": {"name": "Bivalvia", "common_name": "Clams/Mussels"},
            "7": {"name": "Gastropoda", "common_name": "Snails/Slugs"}
        }


# Request/Response Models
class SequenceInput(BaseModel):
    """Input DNA sequence for classification"""
    sequence: str = Field(
        ...,
        min_length=50,
        max_length=1500,
        description="DNA sequence (A, C, G, T, N)",
        example="ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
    )


class PredictionOutput(BaseModel):
    """Prediction result"""
    class_id: int
    class_name: str
    common_name: str
    confidence: float
    model_version: str


class BatchSequenceInput(BaseModel):
    """Batch of DNA sequences"""
    sequences: List[str] = Field(..., max_items=100)


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: str
    device: str


def create_app(
    model_loader: Callable = load_mlflow_model,
    version_loader: Callable = get_model_version
):
    """Create FastAPI application with MLflow integration"""
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Application lifespan handler"""
        try:
            print("Starting application...")
            app.state.model = model_loader()
            app.state.model_version = version_loader()
            app.state.taxonomy_map = load_taxonomy_map()
            app.state.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            if torch.cuda.is_available():
                app.state.model = app.state.model.to(app.state.device)
            
            print(f"✅ Model loaded successfully")
            print(f"✅ Model version: {app.state.model_version}")
            print(f"✅ Device: {app.state.device}")
            
        except Exception as ex:
            print(f"❌ Error loading model: {ex}")
            raise RuntimeError("Unable to load the champion model")
        
        yield
        
        print("Shutting down application...")
    
    app = FastAPI(
        title="DeepSea eDNA Classification API",
        description="Production ML API for marine taxonomic classification from DNA sequences",
        version="1.0.0",
        lifespan=lifespan
    )
    
    @app.get("/", response_model=dict)
    def root():
        """Root endpoint"""
        return {
            "message": "DeepSea eDNA Classification API",
            "version": "1.0.0",
            "status": "ready"
        }
    
    @app.get("/health", response_model=HealthResponse)
    def health_check(request: Request):
        """Health check endpoint"""
        return HealthResponse(
            status="healthy",
            model_loaded=hasattr(request.app.state, "model"),
            model_version=request.app.state.model_version,
            device=request.app.state.device
        )
    
    @app.post("/predict", response_model=PredictionOutput)
    def predict(data: SequenceInput, request: Request):
        """
        Predict taxonomic class from DNA sequence
        
        - **sequence**: DNA sequence (50-1500 bp, characters: A, C, G, T, N)
        """
        try:
            # Validate sequence
            sequence = data.sequence.upper()
            valid_bases = set("ACGTN")
            if not all(base in valid_bases for base in sequence):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid DNA sequence. Only A, C, G, T, N characters allowed."
                )
            
            # Convert sequence to tensor
            seq_tensor = sequence_to_tensor(sequence, max_length=1000)
            seq_tensor = seq_tensor.unsqueeze(0).to(request.app.state.device)
            
            # Make prediction
            model = request.app.state.model
            model.eval()
            
            with torch.no_grad():
                logits, confidence = model(seq_tensor)
                prediction = int(torch.argmax(logits, dim=1)[0])
                conf_value = float(confidence[0])
            
            # Get taxonomy info
            taxonomy_map = request.app.state.taxonomy_map
            class_info = taxonomy_map.get(str(prediction), {
                "name": f"Class_{prediction}",
                "common_name": "Unknown"
            })
            
            return PredictionOutput(
                class_id=prediction,
                class_name=class_info["name"],
                common_name=class_info["common_name"],
                confidence=conf_value,
                model_version=request.app.state.model_version
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
    @app.post("/predict/batch")
    def predict_batch(data: BatchSequenceInput, request: Request):
        """
        Batch prediction for multiple DNA sequences
        
        - **sequences**: List of DNA sequences (max 100)
        """
        try:
            results = []
            for seq in data.sequences:
                seq_input = SequenceInput(sequence=seq)
                result = predict(seq_input, request)
                results.append(result)
            
            return {"predictions": results, "count": len(results)}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")
    
    @app.get("/model/info")
    def model_info(request: Request):
        """Get model information"""
        return {
            "model_name": MODEL_NAME,
            "model_version": request.app.state.model_version,
            "model_alias": MODEL_ALIAS,
            "device": request.app.state.device,
            "num_classes": 8,
            "taxonomy": request.app.state.taxonomy_map
        }
    
    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
