import os
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

# Set test environment variables
os.environ["TESTING"] = "1"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"
os.environ["GCS_BUCKET_NAME"] = "test-bucket"
os.environ["MAX_FILE_SIZE_MB"] = "10"
os.environ["MAX_FILES_PER_USER"] = "100"


@pytest.fixture
def mock_firebase_admin():
    """Mock Firebase Admin SDK"""
    with patch("firebase_admin.initialize_app"), patch(
        "firebase_admin.credentials.Certificate"
    ), patch("firebase_admin.get_app"), patch(
        "google.cloud.firestore.Client"
    ) as mock_firestore_client:

        # Mock Firestore client and operations
        mock_db = Mock()
        mock_firestore_client.return_value = mock_db

        # Mock collection and document operations
        mock_collection = Mock()
        mock_document = Mock()
        mock_subcollection = Mock()

        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.collection.return_value = mock_subcollection
        mock_subcollection.stream.return_value = []  # Empty list for file count
        mock_subcollection.document.return_value.set.return_value = None

        yield mock_db


@pytest.fixture
def mock_gcs():
    """Mock Google Cloud Storage"""
    with patch("google.cloud.storage.Client") as mock_client:
        mock_bucket = Mock()
        mock_client.return_value.bucket.return_value = mock_bucket
        yield mock_bucket


@pytest.fixture
def client(mock_firebase_admin, mock_gcs):
    """Create test client with mocked dependencies"""
    with patch("app.api.upload.firestore_client", mock_firebase_admin), patch(
        "app.api.upload.storage_client"
    ) as mock_storage:

        mock_storage.bucket.return_value = mock_gcs

        from app.main import app

        with TestClient(app) as test_client:
            yield test_client


@pytest.fixture
def mock_auth_user():
    """Mock authenticated user"""
    return {"uid": "test-user-123", "email": "test@example.com", "name": "Test User"}
