"""
MLOps FastAPI Application - DeepSea eDNA Classification
Production-ready API with MLflow integration
"""
import os
import sys
import io
import csv
from pathlib import Path
from typing import List, Callable, Optional
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
    def predict(data: SequenceInput, request: Request, db: Session = Depends(get_db)):
        """
        Predict taxonomic class from DNA sequence
        
        - **sequence**: DNA sequence (50-1500 bp, characters: A, C, G, T, N)
        """
        start_time = time.time()
        
        try:
            # Validate sequence
            sequence = data.sequence.upper()
            valid_bases = set("ACGTN")
            if not all(base in valid_bases for base in sequence):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid DNA sequence. Only A, C, G, T, N characters allowed."
                )
            
            # Check cache (if sequence was predicted recently)
            try:
                cached = get_prediction_by_sequence_hash(db, sequence)
                if cached:
                    print(f"✅ Cache hit for sequence (ID: {cached.id})")
                    return PredictionOutput(
                        class_id=cached.class_id,
                        class_name=cached.class_name,
                        common_name=cached.common_name,
                        confidence=cached.confidence,
                        model_version=cached.model_version
                    )
            except Exception as cache_error:
                print(f"⚠️  Cache check failed: {cache_error}")
            
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
            
            # Calculate processing time
            processing_time_ms = (time.time() - start_time) * 1000
            
            # Save to database
            try:
                client_ip = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent", "")
                
                create_prediction(
                    db=db,
                    sequence=sequence,
                    class_id=prediction,
                    class_name=class_info["name"],
                    common_name=class_info["common_name"],
                    confidence=conf_value,
                    model_version=request.app.state.model_version,
                    device=request.app.state.device,
                    processing_time_ms=processing_time_ms,
                    request_ip=client_ip,
                    user_agent=user_agent
                )
            except Exception as db_error:
                print(f"⚠️  Failed to save prediction to database: {db_error}")
            
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

    # ========================================
    # DATABASE ENDPOINTS - Feature #1
    # ========================================
    
    from database import get_db, init_db, Prediction as DBPrediction
    from crud import (
        create_prediction, get_prediction, get_predictions,
        get_statistics, get_prediction_by_sequence_hash
    )
    from sqlalchemy.orm import Session
    from fastapi import Depends
    import time
    
    # Initialize database on startup
    try:
        init_db()
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")
    
    @app.get("/predictions/history")
    def get_prediction_history(
        skip: int = 0,
        limit: int = 100,
        class_name: str = None,
        min_confidence: float = None,
        db: Session = Depends(get_db)
    ):
        """
        Get prediction history with optional filters
        
        - **skip**: Number of records to skip (for pagination)
        - **limit**: Maximum number of records to return (max 100)
        - **class_name**: Filter by class name (e.g., "Perciformes")
        - **min_confidence**: Minimum confidence threshold (0.0-1.0)
        """
        try:
            predictions = get_predictions(
                db=db,
                skip=skip,
                limit=min(limit, 100),
                class_name=class_name,
                min_confidence=min_confidence
            )
            
            return {
                "total": len(predictions),
                "skip": skip,
                "limit": limit,
                "predictions": [
                    {
                        "id": p.id,
                        "class_name": p.class_name,
                        "common_name": p.common_name,
                        "confidence": p.confidence,
                        "sequence_length": len(p.sequence),
                        "model_version": p.model_version,
                        "created_at": p.created_at.isoformat(),
                        "processing_time_ms": p.processing_time_ms
                    }
                    for p in predictions
                ]
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")
    
    @app.get("/predictions/{prediction_id}")
    def get_prediction_detail(
        prediction_id: int,
        db: Session = Depends(get_db)
    ):
        """
        Get detailed information about a specific prediction
        
        - **prediction_id**: ID of the prediction to retrieve
        """
        try:
            prediction = get_prediction(db, prediction_id)
            if not prediction:
                raise HTTPException(status_code=404, detail="Prediction not found")
            
            return {
                "id": prediction.id,
                "sequence": prediction.sequence,
                "sequence_length": len(prediction.sequence),
                "class_id": prediction.class_id,
                "class_name": prediction.class_name,
                "common_name": prediction.common_name,
                "confidence": prediction.confidence,
                "model_version": prediction.model_version,
                "device": prediction.device,
                "created_at": prediction.created_at.isoformat(),
                "processing_time_ms": prediction.processing_time_ms,
                "request_ip": prediction.request_ip,
                "metadata": prediction.metadata
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch prediction: {str(e)}")
    
    @app.get("/statistics")
    def get_api_statistics(
        days: int = 7,
        db: Session = Depends(get_db)
    ):
        """
        Get prediction statistics for the specified period
        
        - **days**: Number of days to include in statistics (default: 7)
        """
        try:
            stats = get_statistics(db, days=days)
            return stats
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")
    
    @app.delete("/predictions/{prediction_id}")
    def delete_prediction(
        prediction_id: int,
        db: Session = Depends(get_db)
    ):
        """
        Delete a prediction record
        
        - **prediction_id**: ID of the prediction to delete
        """
        try:
            prediction = get_prediction(db, prediction_id)
            if not prediction:
                raise HTTPException(status_code=404, detail="Prediction not found")
            
            db.delete(prediction)
            db.commit()
            return {"message": "Prediction deleted successfully", "id": prediction_id}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete prediction: {str(e)}")

    # ========================================
    # FILE UPLOAD ENDPOINTS - Feature #2
    # ========================================
    
    from fastapi import File, UploadFile, BackgroundTasks
    from file_processor import FileProcessor
    import uuid
    from datetime import datetime
    
    @app.post("/upload/fasta")
    async def upload_fasta(
        file: UploadFile = File(...),
        background_tasks: BackgroundTasks = None,
        db: Session = Depends(get_db),
        request: Request = None
    ):
        """
        Upload FASTA file for batch prediction
        
        - **file**: FASTA file (.fasta, .fa, .fna)
        - Returns: Job ID for tracking progress
        """
        try:
            # Validate file
            file_size = 0
            content_bytes = await file.read()
            file_size = len(content_bytes)
            
            is_valid, error_msg = FileProcessor.validate_file(file.filename, file_size)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_msg)
            
            # Parse file
            content = content_bytes.decode('utf-8')
            sequences = FileProcessor.parse_file(file.filename, content)
            
            if not sequences:
                raise HTTPException(status_code=400, detail="No valid sequences found in file")
            
            # Filter valid sequences
            valid_seqs, invalid_seqs = FileProcessor.filter_sequences(sequences)
            
            if not valid_seqs:
                raise HTTPException(
                    status_code=400,
                    detail=f"No valid sequences found. {len(invalid_seqs)} sequences rejected."
                )
            
            # Create batch job
            job_id = f"job_{uuid.uuid4().hex[:12]}"
            
            from crud import create_batch_job
            batch_job = create_batch_job(
                db=db,
                job_id=job_id,
                total_sequences=len(valid_seqs),
                filename=file.filename,
                metadata={
                    "format": Path(file.filename).suffix,
                    "file_size": file_size,
                    "invalid_sequences": len(invalid_seqs)
                }
            )
            
            # Process sequences
            results = []
            processed = 0
            
            for seq_data in valid_seqs:
                try:
                    # Make prediction
                    seq_input = SequenceInput(sequence=seq_data["sequence"])
                    result = predict(seq_input, request, db)
                    
                    results.append({
                        "id": seq_data["id"],
                        "sequence": seq_data["sequence"],
                        "class_id": result.class_id,
                        "class_name": result.class_name,
                        "common_name": result.common_name,
                        "confidence": result.confidence,
                        "model_version": result.model_version
                    })
                    
                    processed += 1
                    
                except Exception as e:
                    results.append({
                        "id": seq_data["id"],
                        "sequence": seq_data["sequence"],
                        "error": str(e)
                    })
            
            # Update batch job
            from crud import update_batch_job
            
            # Calculate summary
            successful = [r for r in results if "error" not in r]
            failed = [r for r in results if "error" in r]
            
            # Count predictions by class
            class_counts = {}
            for r in successful:
                class_name = r.get("class_name", "Unknown")
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
            
            results_summary = {
                "total_sequences": len(valid_seqs),
                "successful": len(successful),
                "failed": len(failed),
                "invalid_sequences": len(invalid_seqs),
                "predictions_by_class": class_counts,
                "avg_confidence": sum(r["confidence"] for r in successful) / len(successful) if successful else 0
            }
            
            update_batch_job(
                db=db,
                job_id=job_id,
                processed=processed,
                failed=len(failed),
                status="completed",
                results_summary=results_summary
            )
            
            return {
                "job_id": job_id,
                "status": "completed",
                "total_sequences": len(valid_seqs),
                "processed": processed,
                "successful": len(successful),
                "failed": len(failed),
                "invalid_sequences": len(invalid_seqs),
                "results": results,
                "summary": results_summary
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")
    
    @app.post("/upload/csv")
    async def upload_csv(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        request: Request = None
    ):
        """
        Upload CSV file for batch prediction
        
        - **file**: CSV file with 'sequence' column
        - Returns: Prediction results
        """
        # Reuse FASTA upload logic (works for CSV too)
        return await upload_fasta(file=file, db=db, request=request)
    
    @app.get("/batch/{job_id}")
    def get_batch_job_status(
        job_id: str,
        db: Session = Depends(get_db)
    ):
        """
        Get batch job status and results
        
        - **job_id**: Job ID returned from upload endpoint
        """
        try:
            from crud import get_batch_job
            job = get_batch_job(db, job_id)
            
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            
            # Calculate progress percentage
            progress = 0
            if job.total_sequences > 0:
                progress = (job.processed_sequences / job.total_sequences) * 100
            
            return {
                "job_id": job.job_id,
                "status": job.status,
                "total_sequences": job.total_sequences,
                "processed_sequences": job.processed_sequences,
                "failed_sequences": job.failed_sequences,
                "progress_percentage": round(progress, 1),
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "filename": job.filename,
                "results_summary": job.results_summary
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch job: {str(e)}")
    
    @app.get("/batch/{job_id}/download/{format}")
    def download_batch_results(
        job_id: str,
        format: str,
        db: Session = Depends(get_db)
    ):
        """
        Download batch results in specified format
        
        - **job_id**: Job ID
        - **format**: 'csv' or 'fasta'
        """
        from fastapi.responses import Response
        from crud import get_batch_job
        
        try:
            job = get_batch_job(db, job_id)
            
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            
            if job.status != "completed":
                raise HTTPException(status_code=400, detail="Job not completed yet")
            
            # Get predictions for this job
            # For now, return summary (in production, store results in separate table)
            if format.lower() == "csv":
                # Create CSV from summary
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow(["Class", "Count", "Percentage"])
                
                if job.results_summary and "predictions_by_class" in job.results_summary:
                    total = job.results_summary.get("successful", 0)
                    for class_name, count in job.results_summary["predictions_by_class"].items():
                        percentage = (count / total * 100) if total > 0 else 0
                        writer.writerow([class_name, count, f"{percentage:.1f}%"])
                
                content = output.getvalue()
                return Response(
                    content=content,
                    media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=results_{job_id}.csv"}
                )
            
            elif format.lower() == "json":
                return job.results_summary
            
            else:
                raise HTTPException(status_code=400, detail="Format must be 'csv' or 'json'")
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

    # ========================================
    # AUTHENTICATION ENDPOINTS - Feature #3
    # ========================================
    
    from auth import AuthService, get_api_key, require_api_key
    from pydantic import EmailStr
    
    class APIKeyCreate(BaseModel):
        """Request model for creating API key"""
        name: str = Field(..., description="Descriptive name for this API key")
        user_email: EmailStr = Field(..., description="User email address")
        organization: Optional[str] = Field(None, description="Organization name")
        rate_limit: int = Field(1000, description="Requests per hour limit")
        expires_days: int = Field(365, description="Days until expiration")
    
    class APIKeyResponse(BaseModel):
        """Response model for API key"""
        id: int
        name: str
        user_email: str
        organization: Optional[str]
        rate_limit: int
        is_active: bool
        total_requests: int
        created_at: str
        expires_at: Optional[str]
        last_used_at: Optional[str]
    
    @app.post("/auth/keys")
    def create_new_api_key(
        key_data: APIKeyCreate,
        db: Session = Depends(get_db)
    ):
        """
        Create a new API key
        
        ⚠️ WARNING: The plain text key is only shown once! Save it securely.
        
        - **name**: Descriptive name (e.g., "Production Server", "Dev Environment")
        - **user_email**: Email address of key owner
        - **organization**: Optional organization name
        - **rate_limit**: Requests per hour (default: 1000)
        - **expires_days**: Days until expiration (default: 365)
        """
        try:
            api_key_record, plain_key = AuthService.create_api_key(
                db=db,
                name=key_data.name,
                user_email=key_data.user_email,
                organization=key_data.organization,
                rate_limit=key_data.rate_limit,
                expires_days=key_data.expires_days
            )
            
            return {
                "message": "API key created successfully",
                "api_key": plain_key,
                "key_id": api_key_record.id,
                "name": api_key_record.name,
                "user_email": api_key_record.user_email,
                "rate_limit": api_key_record.rate_limit,
                "expires_at": api_key_record.expires_at.isoformat(),
                "warning": "⚠️ Save this key securely! It won't be shown again."
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")
    
    @app.get("/auth/keys")
    def list_api_keys(
        user_email: Optional[str] = None,
        db: Session = Depends(get_db)
    ):
        """
        List all API keys (optionally filtered by user email)
        
        - **user_email**: Filter by user email (optional)
        """
        try:
            keys = AuthService.list_api_keys(db, user_email)
            
            return {
                "total": len(keys),
                "keys": [
                    {
                        "id": key.id,
                        "name": key.name,
                        "user_email": key.user_email,
                        "organization": key.organization,
                        "rate_limit": key.rate_limit,
                        "is_active": bool(key.is_active),
                        "total_requests": key.total_requests,
                        "created_at": key.created_at.isoformat() if key.created_at else None,
                        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None
                    }
                    for key in keys
                ]
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list API keys: {str(e)}")
    
    @app.delete("/auth/keys/{key_id}")
    def revoke_api_key(
        key_id: int,
        db: Session = Depends(get_db)
    ):
        """
        Revoke (deactivate) an API key
        
        - **key_id**: ID of the API key to revoke
        """
        try:
            success = AuthService.revoke_api_key(db, key_id)
            
            if not success:
                raise HTTPException(status_code=404, detail="API key not found")
            
            return {
                "message": "API key revoked successfully",
                "key_id": key_id
            }
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to revoke API key: {str(e)}")
    
    @app.get("/auth/me")
    def get_current_key_info(
        api_key: APIKey = Security(require_api_key)
    ):
        """
        Get information about the current API key
        
        Requires: X-API-Key header
        """
        return {
            "key_id": api_key.id,
            "name": api_key.name,
            "user_email": api_key.user_email,
            "organization": api_key.organization,
            "rate_limit": api_key.rate_limit,
            "total_requests": api_key.total_requests,
            "created_at": api_key.created_at.isoformat() if api_key.created_at else None,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "last_used_at": api_key.last_used_at.isoformat() if api_key.last_used_at else None
        }
    
    @app.get("/auth/usage")
    def get_api_usage(
        api_key: APIKey = Security(require_api_key)
    ):
        """
        Get usage statistics for current API key
        
        Requires: X-API-Key header
        """
        # Calculate usage percentage
        usage_percentage = (api_key.total_requests / api_key.rate_limit * 100) if api_key.rate_limit > 0 else 0
        
        # Check if near limit
        status_text = "normal"
        if usage_percentage >= 90:
            status_text = "critical"
        elif usage_percentage >= 75:
            status_text = "warning"
        
        return {
            "key_name": api_key.name,
            "total_requests": api_key.total_requests,
            "rate_limit": api_key.rate_limit,
            "usage_percentage": round(usage_percentage, 2),
            "status": status_text,
            "requests_remaining": max(0, api_key.rate_limit - api_key.total_requests)
        }

    # ========================================
    # SECURED ENDPOINTS (Optional Auth)
    # ========================================
    
    # Note: Existing /predict endpoint now supports optional authentication
    # If X-API-Key header is provided, it tracks usage
    # If not provided, prediction still works (for backwards compatibility)
    
    @app.post("/v2/predict", response_model=PredictionOutput)
    def predict_v2_authenticated(
        data: SequenceInput,
        request: Request,
        db: Session = Depends(get_db),
        api_key: APIKey = Security(require_api_key)
    ):
        """
        Authenticated prediction endpoint (requires API key)
        
        Same as /predict but requires authentication via X-API-Key header
        Tracks usage and enforces rate limits
        
        - **sequence**: DNA sequence (50-1500 bp, characters: A, C, G, T, N)
        - **Headers**: X-API-Key: your_api_key_here
        """
        # Add API key info to metadata
        result = predict(data, request, db)
        
        # Log that this was an authenticated request
        # (already tracked by get_api_key dependency)
        
        return result

    # ========================================
    # QUALITY CONTROL ENDPOINTS - Feature #4
    # ========================================
    
    from quality_control import (
        QualityController, QualityLevel, ConfidenceThresholds,
        AlertManager
    )
    
    # Initialize alert manager
    alert_manager = AlertManager()
    
    class DetailedPredictionOutput(BaseModel):
        """Detailed prediction with quality assessment"""
        # Main prediction
        class_id: int
        class_name: str
        common_name: str
        confidence: float
        model_version: str
        
        # Quality assessment
        quality_level: str
        quality_message: str
        recommendation: str
        warnings: List[str]
        
        # Alternative predictions
        alternative_predictions: List[Dict]
        
        # Sequence analysis
        sequence_quality: Dict
        
        # Flags
        alert_triggered: bool
        is_ambiguous: bool
    
    @app.post("/predict/detailed", response_model=DetailedPredictionOutput)
    def predict_with_quality_check(
        data: SequenceInput,
        request: Request,
        db: Session = Depends(get_db)
    ):
        """
        Predict with comprehensive quality analysis
        
        Returns prediction with:
        - Quality level assessment (high/medium/low/critical)
        - Alternative predictions (top 3)
        - Confidence warnings
        - Sequence quality analysis
        - Ambiguity detection
        - Actionable recommendations
        
        - **sequence**: DNA sequence (50-1500 bp)
        """
        start_time = time.time()
        
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
                logits, model_confidence = model(seq_tensor)
                prediction = int(torch.argmax(logits, dim=1)[0])
                conf_value = float(model_confidence[0])
            
            # Get top 3 predictions
            taxonomy_map = request.app.state.taxonomy_map
            top_predictions = QualityController.get_top_predictions(
                logits, taxonomy_map, top_k=3
            )
            
            # Generate quality report
            quality_report = QualityController.generate_quality_report(
                sequence=sequence,
                prediction=top_predictions[0],
                top_predictions=top_predictions,
                confidence=conf_value
            )
            
            # Get main prediction info
            class_info = taxonomy_map.get(str(prediction), {
                "name": f"Class_{prediction}",
                "common_name": "Unknown"
            })
            
            # Calculate processing time
            processing_time_ms = (time.time() - start_time) * 1000
            
            # Save to database with quality info
            try:
                client_ip = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent", "")
                
                create_prediction(
                    db=db,
                    sequence=sequence,
                    class_id=prediction,
                    class_name=class_info["name"],
                    common_name=class_info["common_name"],
                    confidence=conf_value,
                    model_version=request.app.state.model_version,
                    device=request.app.state.device,
                    processing_time_ms=processing_time_ms,
                    request_ip=client_ip,
                    user_agent=user_agent,
                    metadata={
                        "quality_level": quality_report["quality_level"],
                        "alert_triggered": quality_report["alert_triggered"],
                        "warnings": quality_report["warnings"]
                    }
                )
            except Exception as db_error:
                print(f"⚠️  Failed to save prediction: {db_error}")
            
            return DetailedPredictionOutput(
                class_id=prediction,
                class_name=class_info["name"],
                common_name=class_info["common_name"],
                confidence=conf_value,
                model_version=request.app.state.model_version,
                quality_level=quality_report["quality_level"],
                quality_message=quality_report["quality_message"],
                recommendation=quality_report["recommendation"],
                warnings=quality_report["warnings"],
                alternative_predictions=quality_report["alternative_predictions"],
                sequence_quality=quality_report["sequence_quality"],
                alert_triggered=quality_report["alert_triggered"],
                is_ambiguous=quality_report["is_ambiguous"]
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
    
    @app.get("/quality/thresholds")
    def get_quality_thresholds():
        """
        Get current quality thresholds
        """
        return {
            "thresholds": {
                "high": ConfidenceThresholds.HIGH,
                "medium": ConfidenceThresholds.MEDIUM,
                "low": ConfidenceThresholds.LOW,
                "critical": ConfidenceThresholds.CRITICAL
            },
            "descriptions": {
                "high": f"≥{ConfidenceThresholds.HIGH*100}% - High confidence, reliable prediction",
                "medium": f"{ConfidenceThresholds.MEDIUM*100}-{ConfidenceThresholds.HIGH*100}% - Medium confidence, acceptable",
                "low": f"{ConfidenceThresholds.LOW*100}-{ConfidenceThresholds.MEDIUM*100}% - Low confidence, review suggested",
                "critical": f"<{ConfidenceThresholds.CRITICAL*100}% - Critical, manual review required"
            }
        }
    
    @app.get("/quality/stats")
    def get_quality_statistics(
        days: int = 7,
        db: Session = Depends(get_db)
    ):
        """
        Get quality statistics for predictions
        
        - **days**: Number of days to analyze (default: 7)
        """
        try:
            from datetime import timedelta
            from sqlalchemy import func
            
            since = datetime.utcnow() - timedelta(days=days)
            
            # Get all predictions
            predictions = db.query(Prediction).filter(
                Prediction.created_at >= since
            ).all()
            
            if not predictions:
                return {
                    "period_days": days,
                    "total_predictions": 0,
                    "message": "No predictions found in this period"
                }
            
            # Analyze quality levels
            quality_counts = {
                "high": 0,
                "medium": 0,
                "low": 0,
                "critical": 0
            }
            
            alerts_triggered = 0
            
            for pred in predictions:
                quality = QualityController.assess_confidence(pred.confidence)
                quality_counts[quality] += 1
                
                if QualityController.should_alert(pred.confidence):
                    alerts_triggered += 1
            
            total = len(predictions)
            
            return {
                "period_days": days,
                "total_predictions": total,
                "quality_distribution": {
                    "high": {
                        "count": quality_counts["high"],
                        "percentage": round(quality_counts["high"] / total * 100, 1)
                    },
                    "medium": {
                        "count": quality_counts["medium"],
                        "percentage": round(quality_counts["medium"] / total * 100, 1)
                    },
                    "low": {
                        "count": quality_counts["low"],
                        "percentage": round(quality_counts["low"] / total * 100, 1)
                    },
                    "critical": {
                        "count": quality_counts["critical"],
                        "percentage": round(quality_counts["critical"] / total * 100, 1)
                    }
                },
                "alerts_triggered": alerts_triggered,
                "alert_rate": round(alerts_triggered / total * 100, 1),
                "average_confidence": round(sum(p.confidence for p in predictions) / total, 4)
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")
    
    @app.get("/quality/low-confidence")
    def get_low_confidence_predictions(
        limit: int = 50,
        min_confidence: float = 0.0,
        max_confidence: float = ConfidenceThresholds.LOW,
        db: Session = Depends(get_db)
    ):
        """
        Get predictions that need review (low confidence)
        
        - **limit**: Maximum number of results (default: 50)
        - **min_confidence**: Minimum confidence threshold
        - **max_confidence**: Maximum confidence threshold (default: 0.50)
        """
        try:
            predictions = db.query(Prediction).filter(
                Prediction.confidence >= min_confidence,
                Prediction.confidence <= max_confidence
            ).order_by(Prediction.confidence.asc()).limit(limit).all()
            
            return {
                "total": len(predictions),
                "threshold": max_confidence,
                "predictions": [
                    {
                        "id": p.id,
                        "class_name": p.class_name,
                        "confidence": p.confidence,
                        "quality_level": QualityController.assess_confidence(p.confidence),
                        "sequence_length": len(p.sequence),
                        "created_at": p.created_at.isoformat(),
                        "metadata": p.metadata
                    }
                    for p in predictions
                ]
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch predictions: {str(e)}")
