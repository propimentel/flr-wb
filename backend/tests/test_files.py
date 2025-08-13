import io
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_download_file_by_id(client: TestClient, mock_auth_user, mock_firebase_admin, mock_gcs):
    """Test downloading a file using the new files API"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock global files document
    mock_file_doc = Mock()
    mock_file_doc.exists = True
    mock_file_doc.to_dict.return_value = {
        "id": "file-123",
        "filename": "test.txt",
        "mime_type": "text/plain",
        "blob_name": "test-user-123/file-123_test.txt",
        "uploaded_by": "test-user-123",
    }

    # Mock global files collection get
    mock_firebase_admin.collection.return_value.document.return_value.get.return_value = mock_file_doc

    # Mock GCS blob
    mock_blob = Mock()
    mock_blob.exists.return_value = True
    mock_blob.open.return_value.__enter__.return_value.read.return_value = b"test content"
    mock_gcs.blob.return_value = mock_blob

    response = client.get("/api/files/file-123")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/plain"
    assert "test.txt" in response.headers.get("content-disposition", "")


@pytest.mark.integration
def test_download_file_not_found(client: TestClient, mock_auth_user, mock_firebase_admin):
    """Test downloading a non-existent file returns 404"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock global files document not found
    mock_file_doc = Mock()
    mock_file_doc.exists = False

    mock_firebase_admin.collection.return_value.document.return_value.get.return_value = mock_file_doc

    response = client.get("/api/files/nonexistent-file")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 404


@pytest.mark.integration
def test_get_file_info(client: TestClient, mock_auth_user, mock_firebase_admin):
    """Test getting file metadata using the new files API"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock global files document
    mock_file_doc = Mock()
    mock_file_doc.exists = True
    mock_file_doc.to_dict.return_value = {
        "id": "file-123",
        "filename": "test.txt",
        "file_size": 1024,
        "mime_type": "text/plain",
        "uploaded_at": None,
        "uploaded_by": "test-user-123",
    }

    # Mock global files collection get
    mock_firebase_admin.collection.return_value.document.return_value.get.return_value = mock_file_doc

    response = client.get("/api/files/file-123/info")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "file-123"
    assert data["filename"] == "test.txt"
    assert data["file_size"] == 1024
    assert data["mime_type"] == "text/plain"
    assert data["uploaded_by"] == "test-user-123"


@pytest.mark.integration
def test_get_file_info_not_found(client: TestClient, mock_auth_user, mock_firebase_admin):
    """Test getting file info for non-existent file returns 404"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock global files document not found
    mock_file_doc = Mock()
    mock_file_doc.exists = False

    mock_firebase_admin.collection.return_value.document.return_value.get.return_value = mock_file_doc

    response = client.get("/api/files/nonexistent-file/info")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 404


@pytest.mark.integration
def test_download_file_without_auth(client: TestClient):
    """Test file download without authentication returns 403"""
    response = client.get("/api/files/file-123")
    assert response.status_code == 403


@pytest.mark.integration
def test_get_file_info_without_auth(client: TestClient):
    """Test file info without authentication returns 403"""
    response = client.get("/api/files/file-123/info")
    assert response.status_code == 403


@pytest.mark.integration
def test_deprecated_download_endpoint_redirect(client: TestClient, mock_auth_user):
    """Test that the deprecated download endpoint redirects to the new endpoint"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    response = client.get("/api/upload/download/file-123", follow_redirects=False)

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 308  # Permanent Redirect
    assert "/api/files/file-123" in response.headers.get("location", "")
