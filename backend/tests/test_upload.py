import io
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_upload_file_without_auth(client: TestClient):
    """Test file upload without authentication returns 403"""
    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}

    response = client.post("/api/upload", files=files)

    assert response.status_code == 403


@pytest.mark.integration
def test_upload_file_with_auth(client: TestClient, mock_auth_user, mock_gcs):
    """Test successful file upload with authentication"""
    # Mock the dependency directly
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock GCS upload
    mock_blob = Mock()
    mock_gcs.blob.return_value = mock_blob
    mock_blob.upload_from_file.return_value = None
    mock_blob.public_url = (
        "https://storage.googleapis.com/test-bucket/uploads/test-user-123/test.txt"
    )
    mock_blob.make_public.return_value = None

    files = {"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")}

    response = client.post("/api/upload", files=files)

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert "url" in response.json()
    assert "filename" in response.json()


@pytest.mark.integration
def test_upload_large_file(client: TestClient, mock_auth_user):
    """Test file upload size limit"""
    # Mock the dependency directly
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Create file larger than 10MB
    large_content = b"a" * (11 * 1024 * 1024)
    files = {"file": ("large.txt", io.BytesIO(large_content), "text/plain")}

    response = client.post("/api/upload", files=files)

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 413  # File too large
