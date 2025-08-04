import io
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_list_user_files(client: TestClient, mock_auth_user, mock_firebase_admin):
    """Test listing user's uploaded files"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock Firestore query result
    mock_doc = Mock()
    mock_doc.to_dict.return_value = {
        "id": "file-123",
        "filename": "test.txt",
        "download_url": "https://example.com/test.txt",
        "file_size": 1024,
        "mime_type": "text/plain",
        "uploaded_at": None,
    }

    mock_firebase_admin.collection.return_value.document.return_value.collection.return_value.order_by.return_value.stream.return_value = [
        mock_doc
    ]

    response = client.get("/api/upload")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert "total_count" in data
    assert "max_files" in data


@pytest.mark.integration
def test_delete_user_file(
    client: TestClient, mock_auth_user, mock_firebase_admin, mock_gcs
):
    """Test deleting user's uploaded file"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock Firestore document
    mock_doc = Mock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"filename": "test.txt"}

    mock_firebase_admin.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = (
        mock_doc
    )
    mock_firebase_admin.collection.return_value.document.return_value.collection.return_value.document.return_value.delete.return_value = (
        None
    )

    # Mock GCS delete
    mock_blob = Mock()
    mock_gcs.blob.return_value = mock_blob
    mock_blob.delete.return_value = None

    response = client.delete("/api/upload/file-123")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["message"] == "File deleted successfully"


@pytest.mark.integration
def test_delete_nonexistent_file(
    client: TestClient, mock_auth_user, mock_firebase_admin
):
    """Test deleting non-existent file returns 404"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    # Mock Firestore document not found
    mock_doc = Mock()
    mock_doc.exists = False

    mock_firebase_admin.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = (
        mock_doc
    )

    response = client.delete("/api/upload/nonexistent-file")

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 404


@pytest.mark.integration
def test_upload_invalid_file_type(client: TestClient, mock_auth_user):
    """Test uploading invalid file type"""
    # Mock the dependency
    from app.deps.auth import get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: mock_auth_user

    files = {
        "file": (
            "script.exe",
            io.BytesIO(b"executable content"),
            "application/x-executable",
        )
    }

    response = client.post("/api/upload", files=files)

    # Clean up override
    app.dependency_overrides.clear()

    assert response.status_code == 415  # Unsupported media type


@pytest.mark.unit
def test_upload_health_endpoint(client: TestClient, mock_gcs, mock_firebase_admin):
    """Test upload API health check"""
    # Mock GCS bucket reload
    mock_gcs.reload.return_value = None

    # Mock Firestore collections
    mock_firebase_admin.collections.return_value = []

    response = client.get("/api/upload/health")

    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "upload-api"
    assert data["status"] == "healthy"
    assert "bucket_name" in data
    assert "max_files_per_user" in data
    assert "max_file_size_mb" in data
