"""
API Test Suite for DeepSea eDNA Classification
"""
import pytest
from fastapi.testclient import TestClient
from main import create_app
import torch


# Mock model for testing
class MockModel:
    def eval(self):
        pass
    
    def to(self, device):
        return self
    
    def __call__(self, x):
        # Return mock logits and confidence
        batch_size = x.shape[0]
        logits = torch.randn(batch_size, 8)
        confidence = torch.tensor([[0.95]] * batch_size)
        return logits, confidence


def mock_model_loader():
    """Mock model loader for testing"""
    return MockModel()


def mock_version_loader():
    """Mock version loader"""
    return "test-v1.0"


# Create test app
app = create_app(
    model_loader=mock_model_loader,
    version_loader=mock_version_loader
)
client = TestClient(app)


def test_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["status"] == "ready"


def test_health():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] == True
    assert data["model_version"] == "test-v1.0"


def test_predict_valid_sequence():
    """Test prediction with valid DNA sequence"""
    response = client.post(
        "/predict",
        json={"sequence": "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "class_id" in data
    assert "class_name" in data
    assert "confidence" in data
    assert "model_version" in data
    assert 0 <= data["class_id"] <= 7
    assert 0 <= data["confidence"] <= 1


def test_predict_short_sequence():
    """Test prediction fails with too short sequence"""
    response = client.post(
        "/predict",
        json={"sequence": "ATCG"}
    )
    assert response.status_code == 422  # Validation error


def test_predict_invalid_characters():
    """Test prediction fails with invalid characters"""
    response = client.post(
        "/predict",
        json={"sequence": "ATCGATCGXYZ123" * 10}
    )
    assert response.status_code == 400
    assert "Invalid DNA sequence" in response.json()["detail"]


def test_predict_lowercase():
    """Test prediction with lowercase sequence"""
    response = client.post(
        "/predict",
        json={"sequence": "atcgatcgatcgatcgatcgatcgatcgatcgatcgatcgatcgatcgatcg"}
    )
    assert response.status_code == 200


def test_batch_predict():
    """Test batch prediction"""
    sequences = [
        "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG",
        "GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA",
        "TTAGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTG"
    ]
    response = client.post(
        "/predict/batch",
        json={"sequences": sequences}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert "count" in data
    assert data["count"] == 3
    assert len(data["predictions"]) == 3


def test_model_info():
    """Test model info endpoint"""
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "DeepSeaeDNAClassifier"
    assert data["model_version"] == "test-v1.0"
    assert data["num_classes"] == 8
    assert "taxonomy" in data


# Test data for different classes
TEST_SEQUENCES = {
    "perciformes": "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG",
    "salmoniformes": "GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA",
    "clupeiformes": "TTAGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTG",
    "gadiformes": "CCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGG",
    "pleuronectiformes": "AATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATT",
    "decapoda": "GGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCCTTAAGGCC",
    "bivalvia": "TTAACCGGTTAACCGGTTAACCGGTTAACCGGTTAACCGGTTAACCGGTTAA",
    "gastropoda": "CCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAA"
}


@pytest.mark.parametrize("name,sequence", TEST_SEQUENCES.items())
def test_predict_various_classes(name, sequence):
    """Test prediction for various taxonomic classes"""
    response = client.post(
        "/predict",
        json={"sequence": sequence}
    )
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["class_id"] <= 7


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
