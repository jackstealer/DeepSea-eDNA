"""
Shared test configuration. Settings are read once at import time, so the isolated
environment is set here, before any test module imports the app.
"""
import os
import sys
import tempfile
from pathlib import Path

TEST_TMP = Path(tempfile.mkdtemp(prefix="deepsea-test-"))

os.environ.update({
    # SQLite by default; set TEST_DATABASE_URL to run the suite against PostgreSQL
    "DATABASE_URL": os.environ.get("TEST_DATABASE_URL", f"sqlite:///{(TEST_TMP / 'test.db').as_posix()}"),
    "STATE_DIR": str(TEST_TMP / "state"),
    "UPLOAD_DIR": str(TEST_TMP / "uploads"),
    "ADMIN_EMAILS": "admin@example.com",
    "SECRET_KEY": "test-secret-key-for-the-integration-suite-0123456789",
    "LOGIN_RATE_LIMIT_PER_MINUTE": "1000",
    "GITHUB_CLIENT_ID": "test-client",
    "GITHUB_CLIENT_SECRET": "test-secret",
    # Google stays unconfigured whatever the developer's shell or .env says
    "GOOGLE_CLIENT_ID": "",
    "GOOGLE_CLIENT_SECRET": "",
    "FRONTEND_URL": "http://frontend.test",
    # The API under test serves the bundled model; MLflow is exercised in test_mlflow.py
    "MODEL_SOURCE": "local",
    "MLFLOW_TRACKING_URI": "",
    "GIT_PYTHON_REFRESH": "quiet",
})
os.environ.pop("REDIS_URL", None)

sys.path.insert(0, str(Path(__file__).parent.parent))
