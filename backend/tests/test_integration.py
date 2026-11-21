"""
Integration tests for the DeepSea eDNA API
Run from backend/: pytest tests -v
"""
import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

# Environment isolation lives in conftest.py
from app.api import oauth
from app.core.rate_limit import RateLimiter
from app.main import app

client = TestClient(app)

SEQ = "ATGCGTACGTTAGCCTAGGCTAACGTTAGCATCGATCGGCTAGCTAGGATCCGATCGATTACGGCTAGCTAACG" * 2
PASSWORD = "Str0ng-passw0rd"


@pytest.fixture(scope="module", autouse=True)
def run_lifespan():
    """Run app startup/shutdown (migrations, model loading)"""
    with client:
        yield


def register(email=None, username=None):
    username = username or f"user_{uuid.uuid4().hex[:8]}"
    response = client.post("/auth/register", json={
        "username": username,
        "email": email or f"{username}@example.com",
        "full_name": "Test User",
        "password": PASSWORD,
    })
    assert response.status_code == 201, response.text
    return response.json()


def login(identifier):
    response = client.post("/auth/token", data={"username": identifier, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


def headers(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture(scope="module")
def admin():
    user = register(email="admin@example.com", username="site_admin")
    return {"user": user, "tokens": login("site_admin")}


@pytest.fixture
def viewer():
    user = register()
    return {"user": user, "tokens": login(user["username"])}


class TestRegistrationAndLogin:
    def test_new_users_are_viewers(self, viewer):
        assert viewer["user"]["role"] == "viewer"
        assert viewer["user"]["has_password"] is True

    def test_admin_email_bootstrap(self, admin):
        assert admin["user"]["role"] == "admin"

    def test_login_with_email(self, viewer):
        assert login(viewer["user"]["email"].upper())["token_type"] == "bearer"

    def test_wrong_password(self, viewer):
        response = client.post("/auth/token", data={"username": viewer["user"]["username"], "password": "nope"})
        assert response.status_code == 401

    def test_duplicate_email_rejected(self, viewer):
        response = client.post("/auth/register", json={
            "username": "another_one", "email": viewer["user"]["email"], "full_name": "X", "password": PASSWORD,
        })
        assert response.status_code == 409

    def test_weak_password_rejected(self):
        response = client.post("/auth/register", json={
            "username": "weakling", "email": "weak@example.com", "full_name": "X", "password": "short",
        })
        assert response.status_code == 422

    def test_role_cannot_be_self_assigned(self):
        created = client.post("/auth/register", json={
            "username": "wannabe", "email": "wannabe@example.com", "full_name": "X",
            "password": PASSWORD, "role": "admin",
        }).json()
        assert created["role"] == "viewer"

    def test_no_default_admin_account(self):
        response = client.post("/auth/token", data={"username": "admin", "password": "admin123"})
        assert response.status_code == 401


class TestTokens:
    def test_me_requires_auth(self):
        assert client.get("/auth/me").status_code == 401

    def test_refresh_rotates_tokens(self, viewer):
        refresh = viewer["tokens"]["refresh_token"]
        first = client.post("/auth/refresh", json={"refresh_token": refresh})
        assert first.status_code == 200
        # The used refresh token is revoked
        assert client.post("/auth/refresh", json={"refresh_token": refresh}).status_code == 401
        assert client.get("/auth/me", headers=headers(first.json())).status_code == 200

    def test_refresh_token_is_not_an_access_token(self, viewer):
        bogus = {"Authorization": f"Bearer {viewer['tokens']['refresh_token']}"}
        assert client.get("/auth/me", headers=bogus).status_code == 401

    def test_logout_revokes_tokens(self, viewer):
        tokens = viewer["tokens"]
        response = client.post("/auth/logout", headers=headers(tokens), json={"refresh_token": tokens["refresh_token"]})
        assert response.status_code == 200
        assert client.get("/auth/me", headers=headers(tokens)).status_code == 401
        assert client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


class TestAuthorization:
    def test_viewer_cannot_manage_users(self, viewer):
        assert client.get("/auth/users", headers=headers(viewer["tokens"])).status_code == 403

    def test_viewer_cannot_see_system_monitoring(self, viewer):
        for path in ["/monitoring/system", "/monitoring/dashboard", "/health/detailed", "/cache/stats"]:
            assert client.get(path, headers=headers(viewer["tokens"])).status_code == 403, path

    def test_viewer_can_view_but_not_manage_versions(self, viewer):
        assert client.get("/versions", headers=headers(viewer["tokens"])).status_code == 200
        response = client.post("/versions/register?version_name=x&model_path=y", headers=headers(viewer["tokens"]))
        assert response.status_code == 403

    def test_admin_sees_system(self, admin):
        for path in ["/monitoring/system", "/monitoring/dashboard", "/health/detailed", "/cache/stats", "/auth/users"]:
            assert client.get(path, headers=headers(admin["tokens"])).status_code == 200, path

    def test_admin_promotes_and_disables(self, admin, viewer):
        uid = viewer["user"]["id"]
        promoted = client.patch(f"/auth/users/{uid}", json={"role": "scientist"}, headers=headers(admin["tokens"]))
        assert promoted.status_code == 200 and promoted.json()["role"] == "scientist"

        disabled = client.patch(f"/auth/users/{uid}", json={"is_active": False}, headers=headers(admin["tokens"]))
        assert disabled.status_code == 200
        # Existing tokens stop working immediately, and login is refused
        assert client.get("/auth/me", headers=headers(viewer["tokens"])).status_code == 401
        response = client.post("/auth/token", data={"username": viewer["user"]["username"], "password": PASSWORD})
        assert response.status_code == 403

    def test_admin_cannot_demote_self(self, admin):
        uid = admin["user"]["id"]
        response = client.patch(f"/auth/users/{uid}", json={"role": "viewer"}, headers=headers(admin["tokens"]))
        assert response.status_code == 400

    def test_permissions_matrix(self, viewer):
        data = client.get("/auth/permissions", headers=headers(viewer["tokens"])).json()
        roles = {r["role"]: r["permissions"] for r in data["roles"]}
        assert "user:manage" in roles["admin"] and "user:manage" not in roles["viewer"]


class TestPrediction:
    def test_single_prediction_saved_to_history(self, viewer):
        response = client.post("/api/predict", json={"sequence": SEQ, "use_cache": False}, headers=headers(viewer["tokens"]))
        assert response.status_code == 200
        data = response.json()
        assert 0.0 <= data["confidence"] <= 1.0
        assert len(data["probabilities"]) == 8
        assert abs(sum(data["probabilities"].values()) - 1.0) < 1e-4

        history = client.get("/me/predictions", headers=headers(viewer["tokens"])).json()
        assert history["total"] == 1
        assert history["items"][0]["predicted_class"] == data["predicted_class"]

    def test_prediction_requires_auth(self):
        assert client.post("/api/predict", json={"sequence": SEQ}).status_code == 401

    def test_invalid_sequence(self, viewer):
        response = client.post("/api/predict", json={"sequence": "HELLO123"}, headers=headers(viewer["tokens"]))
        assert response.status_code == 422

    def test_sequence_length_window(self, viewer):
        # Same 100-1,000 bp window the web UI enforces
        for seq in ("ACGT" * 20, "ACGT" * 251):
            response = client.post("/api/predict", json={"sequence": seq}, headers=headers(viewer["tokens"]))
            assert response.status_code == 422, len(seq)
            assert "bp" in response.json()["detail"]

    def test_batch_prediction_and_stats(self, viewer):
        response = client.post(
            "/api/predict/batch",
            json={"sequences": [SEQ, SEQ[::-1]], "sequence_ids": ["a", "b"]},
            headers=headers(viewer["tokens"]),
        )
        assert response.status_code == 200
        data = response.json()
        assert [p["sequence_id"] for p in data["predictions"]] == ["a", "b"]

        stats = client.get("/me/stats", headers=headers(viewer["tokens"])).json()
        assert stats["predictions"]["total"] == 2
        assert stats["model"]["loaded"] is True

    def test_history_is_private(self, viewer):
        client.post("/api/predict", json={"sequence": SEQ}, headers=headers(viewer["tokens"]))
        other = register()
        other_history = client.get("/me/predictions", headers=headers(login(other["username"]))).json()
        assert other_history["total"] == 0


class TestFileAnalysis:
    def upload(self, tokens):
        fasta = f">s1\n{SEQ}\n>s2\n{SEQ[::-1]}\n".encode()
        response = client.post(
            "/api/upload", files={"files": ("sample.fasta", fasta)}, headers=headers(tokens)
        )
        assert response.status_code == 200, response.text
        return response.json()["file_paths"]

    def test_upload_analyze_export(self, viewer):
        file_ids = self.upload(viewer["tokens"])
        assert not any("/" in f or "\\" in f for f in file_ids)  # no server paths leaked

        job = client.post("/api/analyze", json={"file_paths": file_ids}, headers=headers(viewer["tokens"])).json()
        result = client.get(f"/api/results/{job['jobId']}", headers=headers(viewer["tokens"])).json()
        assert result["status"] == "completed", result
        assert result["results"]["totalSequences"] == 2

        for fmt in ["json", "csv", "tsv", "biom", "fasta"]:
            response = client.get(f"/api/export/{job['jobId']}?format={fmt}", headers=headers(viewer["tokens"]))
            assert response.status_code == 200 and response.content, fmt

        jobs = client.get("/me/jobs", headers=headers(viewer["tokens"])).json()
        assert jobs["items"][0]["job_id"] == job["jobId"]

    def test_jobs_and_files_are_private(self, viewer):
        file_ids = self.upload(viewer["tokens"])
        job = client.post("/api/analyze", json={"file_paths": file_ids}, headers=headers(viewer["tokens"])).json()

        intruder = login(register()["username"])
        assert client.get(f"/api/results/{job['jobId']}", headers=headers(intruder)).status_code == 404
        assert client.get(f"/api/export/{job['jobId']}", headers=headers(intruder)).status_code == 404
        assert client.post("/api/analyze", json={"file_paths": file_ids}, headers=headers(intruder)).status_code == 404

    def test_path_traversal_rejected(self, viewer):
        response = client.post("/api/analyze", json={"file_paths": ["../../etc/passwd"]}, headers=headers(viewer["tokens"]))
        assert response.status_code == 400


class TestGitHubOAuth:
    def start(self):
        response = client.get("/auth/oauth/github/login", follow_redirects=False)
        assert response.status_code in (302, 307)
        location = urlparse(response.headers["location"])
        assert location.netloc == "github.com"
        return parse_qs(location.query)["state"][0]

    def mock_provider(self, monkeypatch, email, provider_id):
        monkeypatch.setattr(oauth, "exchange_code", lambda provider, cfg, code: "provider-token")
        monkeypatch.setitem(oauth.PROFILE_FETCHERS, "github", lambda token: oauth.OAuthProfile(
            provider_user_id=provider_id, email=email, full_name="Octo Cat", login_hint="octocat",
        ))

    def finish(self, state):
        response = client.get(f"/auth/oauth/github/callback?code=abc&state={state}", follow_redirects=False)
        return urlparse(response.headers["location"])

    def test_providers_endpoint(self):
        data = client.get("/auth/providers").json()
        assert data == {"password": True, "google": False, "github": True}

    def test_sign_in_creates_viewer_account(self, monkeypatch):
        self.mock_provider(monkeypatch, "octocat@example.org", "1001")
        target = self.finish(self.start())
        assert target.netloc == "frontend.test" and target.path == "/oauth/callback"
        tokens = parse_qs(target.fragment)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token'][0]}"}).json()
        assert me["email"] == "octocat@example.org"
        assert me["role"] == "viewer" and me["providers"] == ["github"] and me["has_password"] is False

    def test_links_to_existing_account_by_email(self, monkeypatch, viewer):
        self.mock_provider(monkeypatch, viewer["user"]["email"], "2002")
        tokens = parse_qs(self.finish(self.start()).fragment)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token'][0]}"}).json()
        assert me["id"] == viewer["user"]["id"]
        assert me["providers"] == ["github"]

    def test_admin_email_gets_admin_role(self, monkeypatch, admin):
        self.mock_provider(monkeypatch, "admin@example.com", "3003")
        tokens = parse_qs(self.finish(self.start()).fragment)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token'][0]}"}).json()
        assert me["role"] == "admin"

    def test_forged_state_rejected(self, monkeypatch):
        self.mock_provider(monkeypatch, "evil@example.com", "4004")
        self.start()
        target = self.finish("forged-state")
        assert target.path == "/login" and "oauth_error" in parse_qs(target.query)

    def test_unconfigured_provider_404(self):
        assert client.get("/auth/oauth/google/login", follow_redirects=False).status_code == 404


class TestModelServing:
    def test_serving_info(self, viewer):
        info = client.get("/api/model/serving", headers=headers(viewer["tokens"])).json()
        assert info["source"] == "local" and info["version"] == "v2.1"
        assert info["mlflow_enabled"] is False

    def test_served_model_is_current_registry_version(self, viewer):
        current = client.get("/versions/current/info", headers=headers(viewer["tokens"])).json()
        assert current["version_name"] == "v2.1" and "local" in current["tags"]

    def test_reload_requires_mlflow_and_permission(self, admin, viewer):
        assert client.post("/api/model/reload", headers=headers(viewer["tokens"])).status_code == 403
        assert client.post("/api/model/reload", headers=headers(admin["tokens"])).status_code == 409


class TestSystem:
    def test_public_health(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy", "model_loaded": True, "database": "ok"}

    def test_rate_limiter(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        limiter.check("ip")
        limiter.check("ip")
        with pytest.raises(Exception) as exc:
            limiter.check("ip")
        assert exc.value.status_code == 429

    def test_client_ip_from_trusted_proxy_header(self, monkeypatch):
        from starlette.requests import Request
        from app.core.config import settings
        from app.core.rate_limit import client_ip

        def make(header_value, name=b"cloudfront-viewer-address"):
            headers = [(name, header_value.encode())] if header_value else []
            return Request({"type": "http", "headers": headers, "client": ("10.0.0.9", 1234)})

        assert client_ip(make("203.0.113.7:443")) == "10.0.0.9"  # header ignored unless trusted
        monkeypatch.setattr(settings, "TRUSTED_PROXY_HEADER", "cloudfront-viewer-address")
        assert client_ip(make("203.0.113.7:443")) == "203.0.113.7"
        assert client_ip(make("2001:db8::1:443")) == "2001:db8::1"
        assert client_ip(make(None)) == "10.0.0.9"

        monkeypatch.setattr(settings, "TRUSTED_PROXY_HEADER", "X-Real-IP")
        assert client_ip(make("198.51.100.4", name=b"x-real-ip")) == "198.51.100.4"
        assert client_ip(make("2001:db8::7", name=b"x-real-ip")) == "2001:db8::7"

    def test_security_headers(self):
        response = client.get("/health")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
