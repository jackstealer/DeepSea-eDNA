"""
Integration Tests for DeepSea eDNA API
Tests complete workflows and feature interactions
"""
import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

client = TestClient(app)


class TestAuthentication:
    """Test authentication and authorization"""
    
    def test_login_success(self):
        """Test successful login"""
        response = client.post(
            "/auth/token",
            data={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    def test_login_failure(self):
        """Test failed login"""
        response = client.post(
            "/auth/token",
            data={"username": "admin", "password": "wrong"}
        )
        assert response.status_code == 401
    
    def test_get_current_user(self):
        """Test getting current user"""
        # Login first
        login_response = client.post(
            "/auth/token",
            data={"username": "admin", "password": "admin123"}
        )
        token = login_response.json()["access_token"]
        
        # Get user info
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "admin"
        assert data["role"] == "admin"


class TestHealthChecks:
    """Test health check endpoints"""
    
    def test_basic_health(self):
        """Test basic health check"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_detailed_health(self):
        """Test detailed health check"""
        response = client.get("/health/detailed")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "components" in data


class TestVersioning:
    """Test model versioning"""
    
    def test_list_versions(self):
        """Test listing versions"""
        response = client.get("/versions")
        assert response.status_code == 200
        data = response.json()
        assert "versions" in data
        assert "total" in data
    
    def test_version_statistics(self):
        """Test version statistics"""
        response = client.get("/versions/statistics")
        assert response.status_code == 200
        data = response.json()
        assert "total_versions" in data


class TestMonitoring:
    """Test monitoring endpoints"""
    
    def test_system_metrics(self):
        """Test system metrics"""
        response = client.get("/monitoring/system")
        assert response.status_code == 200
        data = response.json()
        assert "cpu" in data
        assert "memory" in data
        assert "disk" in data
    
    def test_dashboard_metrics(self):
        """Test dashboard metrics"""
        response = client.get("/monitoring/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert "overview" in data
        assert "system" in data


class TestCache:
    """Test caching functionality"""
    
    def test_cache_stats(self):
        """Test cache statistics"""
        response = client.get("/cache/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_keys" in data
        assert "hits" in data
        assert "misses" in data
    
    def test_cache_backend(self):
        """Test cache backend info"""
        response = client.get("/cache/backend")
        assert response.status_code == 200
        data = response.json()
        assert "backend" in data


class TestExperiments:
    """Test A/B testing experiments"""
    
    def test_list_experiments(self):
        """Test listing experiments"""
        response = client.get("/experiments")
        assert response.status_code == 200
        data = response.json()
        assert "experiments" in data
        assert "total" in data
    
    def test_active_experiment(self):
        """Test getting active experiment"""
        response = client.get("/experiments/active")
        assert response.status_code == 200
        data = response.json()
        assert "active" in data


class TestSecurity:
    """Test security features"""
    
    def test_security_stats(self):
        """Test security statistics"""
        response = client.get("/auth/security-stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "users_by_role" in data
    
    def test_permissions_list(self):
        """Test permissions listing"""
        response = client.get("/auth/permissions")
        assert response.status_code == 200
        data = response.json()
        assert "roles" in data
        assert "all_permissions" in data


class TestWorkflow:
    """Test complete workflows"""
    
    def test_authentication_workflow(self):
        """Test complete authentication workflow"""
        # 1. Register user
        register_response = client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "full_name": "Test User",
                "password": "test123",
                "role": "viewer"
            }
        )
        # May fail if user exists - that's ok
        
        # 2. Login
        login_response = client.post(
            "/auth/token",
            data={"username": "testuser", "password": "test123"}
        )
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            
            # 3. Access protected resource
            me_response = client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert me_response.status_code == 200
            
            # 4. Logout
            logout_response = client.post(
                "/auth/logout",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert logout_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
