import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

def test_dockerfile_exists():
    """Rule: Epic 3 requires a Dockerfile for containerization."""
    assert (PROJECT_ROOT / "Dockerfile").exists(), "Dockerfile is missing! Epic 3 requires containerization."

def test_requirements_txt_exists():
    """Rule: Epic 3 requires a minimal requirements.txt for the API container."""
    req_path = PROJECT_ROOT / "requirements.txt"
    assert req_path.exists(), "requirements.txt is missing!"
    
    with open(req_path, "r") as f:
        content = f.read().lower()
        assert "fastapi" in content, "requirements.txt must include fastapi"
        assert "uvicorn" in content, "requirements.txt must include uvicorn"

def test_fastapi_backend_exists():
    """Rule: Epic 3 requires a FastAPI backend at src/api/main.py."""
    api_main = PROJECT_ROOT / "src" / "api" / "main.py"
    assert api_main.exists(), "src/api/main.py is missing!"
    
    with open(api_main, "r") as f:
        content = f.read()
        assert "FastAPI" in content, "main.py must use FastAPI"
        assert "@app.post" in content or "@app.get" in content, "main.py must define endpoints"
