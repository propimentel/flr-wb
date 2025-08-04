from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.deps.auth import get_current_user, get_optional_user


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.firebase_auth.verify_id_token")
async def test_get_current_user_valid_token(mock_verify_token):
    """Test successful token verification"""
    # Mock request
    request = Mock(spec=Request)
    request.state = Mock()

    # Mock credentials
    credentials = Mock(spec=HTTPAuthorizationCredentials)
    credentials.credentials = "valid-token"

    # Mock Firebase response
    mock_verify_token.return_value = {
        "uid": "test-user-123",
        "email": "test@example.com",
        "email_verified": True,
        "auth_time": 1640995200,
    }

    user = await get_current_user(request, credentials)

    assert user["uid"] == "test-user-123"
    assert user["email"] == "test@example.com"
    assert user["email_verified"] == True
    assert "firebase" in user
    mock_verify_token.assert_called_once_with("valid-token")


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.firebase_auth.verify_id_token")
async def test_get_current_user_invalid_token(mock_verify_token):
    """Test invalid token raises 401"""
    from firebase_admin.auth import InvalidIdTokenError

    # Mock request
    request = Mock(spec=Request)
    request.state = Mock()

    # Mock credentials
    credentials = Mock(spec=HTTPAuthorizationCredentials)
    credentials.credentials = "invalid-token"

    # Mock Firebase error
    mock_verify_token.side_effect = InvalidIdTokenError("Invalid token")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, credentials)

    assert exc_info.value.status_code == 401
    assert "Invalid authentication token" in exc_info.value.detail


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.firebase_auth.verify_id_token")
async def test_get_current_user_expired_token(mock_verify_token):
    """Test expired token raises 401"""
    from firebase_admin.auth import ExpiredIdTokenError

    # Mock request
    request = Mock(spec=Request)
    request.state = Mock()

    # Mock credentials
    credentials = Mock(spec=HTTPAuthorizationCredentials)
    credentials.credentials = "expired-token"

    # Mock Firebase error
    mock_verify_token.side_effect = ExpiredIdTokenError(
        "Token expired", Exception("Token expired")
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, credentials)

    assert exc_info.value.status_code == 401
    assert "Invalid authentication token" in exc_info.value.detail


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.firebase_auth.verify_id_token")
async def test_get_current_user_unexpected_error(mock_verify_token):
    """Test unexpected error raises 500"""
    # Mock request
    request = Mock(spec=Request)
    request.state = Mock()

    # Mock credentials
    credentials = Mock(spec=HTTPAuthorizationCredentials)
    credentials.credentials = "token"

    # Mock unexpected error
    mock_verify_token.side_effect = Exception("Unexpected error")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, credentials)

    assert exc_info.value.status_code == 500
    assert "Authentication service error" in exc_info.value.detail


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.get_current_user")
async def test_get_optional_user_success(mock_get_current_user):
    """Test optional user returns user when authentication succeeds"""
    # Mock request and credentials
    request = Mock(spec=Request)
    credentials = Mock(spec=HTTPAuthorizationCredentials)

    # Mock successful auth
    expected_user = {"uid": "test-user-123"}
    mock_get_current_user.return_value = expected_user

    user = await get_optional_user(request, credentials)

    assert user == expected_user


@pytest.mark.unit
@pytest.mark.asyncio
@patch("app.deps.auth.get_current_user")
async def test_get_optional_user_failure(mock_get_current_user):
    """Test optional user returns None when authentication fails"""
    # Mock request and credentials
    request = Mock(spec=Request)
    credentials = Mock(spec=HTTPAuthorizationCredentials)

    # Mock auth failure
    mock_get_current_user.side_effect = HTTPException(status_code=401)

    user = await get_optional_user(request, credentials)

    assert user is None
