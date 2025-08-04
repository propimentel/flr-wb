import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_health_check(client: TestClient):
    """Test health check endpoint returns 200"""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "fastapi-backend"}


@pytest.mark.unit
def test_health_check_content_type(client: TestClient):
    """Test health check returns correct content type"""
    response = client.get("/health")

    assert response.headers["content-type"] == "application/json"
