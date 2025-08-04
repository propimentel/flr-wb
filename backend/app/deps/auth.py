import logging
import os

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, initialize_app

from app.core.settings import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()

# Initialize Firebase Admin SDK
try:
    from firebase_admin import get_app

    get_app()  # Check if default app exists
    logger.info("Firebase Admin SDK already initialized")
except ValueError:
    # Default app doesn't exist, initialize it
    if settings.firebase_service_account_path and os.path.exists(
        settings.firebase_service_account_path
    ):
        cred = credentials.Certificate(settings.firebase_service_account_path)
        initialize_app(cred)
        logger.info("Firebase Admin SDK initialized with service account")
    else:
        # Use Application Default Credentials (works in GCP environments)
        try:
            initialize_app(credentials.ApplicationDefault())
            logger.info(
                "Firebase Admin SDK initialized with Application Default Credentials"
            )
        except Exception as e:
            logger.warning(
                f"Could not initialize with Application Default Credentials: {e}"
            )
            # For development, initialize without credentials (will use env vars)
            initialize_app()
            logger.info("Firebase Admin SDK initialized with environment variables")


async def get_current_user(
    request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    FastAPI dependency to get current authenticated user.

    Args:
        request: FastAPI request object
        credentials: HTTP Bearer credentials

    Returns:
        dict: User claims from verified token

    Raises:
        HTTPException: If authentication fails
    """
    if not settings.firebase_project_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase project ID not configured",
        )

    try:
        # Verify the ID token using Firebase Admin SDK
        decoded_token = firebase_auth.verify_id_token(credentials.credentials)

        # Attach user info to request state
        request.state.user = {
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
            "email_verified": decoded_token.get("email_verified", False),
            "auth_time": decoded_token.get("auth_time"),
            "firebase": decoded_token,
        }

        return request.state.user

    except firebase_auth.InvalidIdTokenError as e:
        logger.error(f"Invalid ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.ExpiredIdTokenError as e:
        logger.error(f"Expired ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
        )


async def get_optional_user(
    request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict | None:
    """
    FastAPI dependency to optionally get current user (won't raise error if no auth).

    Args:
        request: FastAPI request object
        credentials: HTTP Bearer credentials

    Returns:
        dict | None: User claims if authenticated, None otherwise
    """
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None
