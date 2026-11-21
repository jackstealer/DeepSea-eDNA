"""
In development the browser may open the frontend from any of this machine's addresses
(localhost, 127.0.0.1, its LAN IP); production keeps the exact CORS_ORIGINS allowlist.
"""
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app

client = TestClient(app)


def preflight(origin: str):
    return client.options("/auth/token", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})


def test_dev_accepts_loopback_and_private_network_origins():
    for origin in ("http://127.0.0.1:3000", "http://192.168.1.2:3000", "http://10.0.0.7:5173", "http://localhost:3000"):
        response = preflight(origin)
        assert response.status_code == 200, origin
        assert response.headers.get("access-control-allow-origin") == origin


def test_dev_still_rejects_other_sites():
    for origin in ("http://evil.example.com", "https://192.168.1.2.evil.example.com", "http://8.8.8.8:3000"):
        assert preflight(origin).status_code == 400, origin


def test_production_uses_the_exact_allowlist_only():
    assert Settings(ENVIRONMENT="production", SECRET_KEY="p" * 48).cors_origin_regex is None
