import logging
import mimetypes
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from google.cloud import firestore, storage

from app.core.settings import settings
from app.deps.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload")

# Initialize GCP clients
storage_client = storage.Client()
firestore_client = firestore.Client()

# Define allowed file types (extend as needed)
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/pdf",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
}

MAX_FILE_SIZE_BYTES = settings.max_file_size_mb * 1024 * 1024  # Convert MB to bytes


async def validate_file_upload(file: UploadFile, user_uid: str) -> None:
    """
    Validate file upload constraints.

    Args:
        file: The uploaded file
        user_uid: User's Firebase UID

    Raises:
        HTTPException: If validation fails
    """
    # Check file size
    if file.size and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb}MB",
        )

    # Check mime type
    mime_type, _ = mimetypes.guess_type(file.filename or "")
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type '{mime_type}' not allowed. Supported types: {', '.join(ALLOWED_MIME_TYPES)}",
        )

    # Check user's current file count
    user_uploads_ref = (
        firestore_client.collection("users").document(user_uid).collection("uploads")
    )
    uploads_count = len(list(user_uploads_ref.stream()))

    if uploads_count >= settings.max_files_per_user:
        raise HTTPException(
            status_code=429,
            detail=f"Upload limit reached. Maximum {settings.max_files_per_user} files per user",
        )


async def upload_to_gcs(file: UploadFile, blob_name: str) -> str:
    """
    Upload file to Google Cloud Storage.

    Args:
        file: The uploaded file
        blob_name: Name for the blob in GCS

    Returns:
        str: Public download URL

    Raises:
        HTTPException: If upload fails
    """
    try:
        bucket = storage_client.bucket(settings.gcp_bucket_name)
        blob = bucket.blob(blob_name)

        # Set content type
        mime_type, _ = mimetypes.guess_type(file.filename or "")
        blob.content_type = mime_type or "application/octet-stream"

        # Reset file pointer to beginning
        await file.seek(0)

        # Upload file
        blob.upload_from_file(file.file, content_type=blob.content_type)

        # Make blob publicly readable
        blob.make_public()

        return blob.public_url

    except Exception as e:
        logger.error(f"Failed to upload to GCS: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")


async def save_upload_metadata(
    user_uid: str,
    file_id: str,
    filename: str,
    download_url: str,
    file_size: int,
    mime_type: str,
) -> None:
    """
    Save upload metadata to Firestore.

    Args:
        user_uid: User's Firebase UID
        file_id: Generated file ID
        filename: Original filename
        download_url: GCS public URL
        file_size: Size in bytes
        mime_type: MIME type

    Raises:
        HTTPException: If save fails
    """
    try:
        upload_doc = {
            "id": file_id,
            "filename": filename,
            "download_url": download_url,
            "file_size": file_size,
            "mime_type": mime_type,
            "uploaded_at": datetime.utcnow(),
            "user_uid": user_uid,
        }

        # Save to user's uploads subcollection
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        user_uploads_ref.document(file_id).set(upload_doc)

        logger.info(f"Saved upload metadata for file {file_id} by user {user_uid}")

    except Exception as e:
        logger.error(f"Failed to save upload metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to save upload metadata")


@router.post("/", response_description="Upload a file")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """
    API endpoint to upload a file to GCP Storage.

    Args:
        request: FastAPI request object
        file: File to upload
        user: Authenticated user (from dependency)

    Returns:
        JSONResponse: Upload result with URL and ID
    """
    user_uid = user["uid"]

    try:
        # Validate file upload
        await validate_file_upload(file, user_uid)

        # Generate unique file ID and blob name
        file_id = str(uuid.uuid4())
        file_extension = ""
        if file.filename and "." in file.filename:
            file_extension = "." + file.filename.split(".")[-1]

        blob_name = f"{user_uid}/{file_id}_{file.filename or 'unnamed'}{file_extension}"

        logger.info(
            f"Uploading file '{file.filename}' for user {user_uid} as blob '{blob_name}'"
        )

        # Upload to Google Cloud Storage
        download_url = await upload_to_gcs(file, blob_name)

        # Get file info
        mime_type, _ = mimetypes.guess_type(file.filename or "")
        file_size = file.size or 0

        # Save metadata to Firestore
        await save_upload_metadata(
            user_uid=user_uid,
            file_id=file_id,
            filename=file.filename or "unnamed",
            download_url=download_url,
            file_size=file_size,
            mime_type=mime_type or "application/octet-stream",
        )

        return JSONResponse(
            status_code=200,
            content=jsonable_encoder(
                {
                    "id": file_id,
                    "url": download_url,
                    "filename": file.filename,
                    "file_size": file_size,
                    "mime_type": mime_type,
                    "message": "File uploaded successfully",
                }
            ),
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during file upload: {e}")
        raise HTTPException(
            status_code=500, detail=f"Unexpected error during file upload: {str(e)}"
        )


@router.get("/", response_description="Get user's uploaded files")
async def list_user_files(request: Request, user: dict = Depends(get_current_user)):
    """
    API endpoint to get user's uploaded files.

    Args:
        request: FastAPI request object
        user: Authenticated user (from dependency)

    Returns:
        JSONResponse: List of user's uploaded files
    """
    user_uid = user["uid"]

    try:
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        uploads = []

        for doc in user_uploads_ref.order_by(
            "uploaded_at", direction=firestore.Query.DESCENDING
        ).stream():
            upload_data = doc.to_dict()
            uploads.append(
                {
                    "id": upload_data.get("id"),
                    "filename": upload_data.get("filename"),
                    "download_url": upload_data.get("download_url"),
                    "file_size": upload_data.get("file_size"),
                    "mime_type": upload_data.get("mime_type"),
                    "uploaded_at": (
                        upload_data.get("uploaded_at").isoformat()
                        if upload_data.get("uploaded_at")
                        else None
                    ),
                }
            )

        return JSONResponse(
            status_code=200,
            content=jsonable_encoder(
                {
                    "files": uploads,
                    "total_count": len(uploads),
                    "max_files": settings.max_files_per_user,
                }
            ),
        )

    except Exception as e:
        logger.error(f"Failed to list user files: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve uploaded files")


@router.delete("/{file_id}", response_description="Delete uploaded file")
async def delete_file(
    file_id: str, request: Request, user: dict = Depends(get_current_user)
):
    """
    API endpoint to delete an uploaded file.

    Args:
        file_id: ID of the file to delete
        request: FastAPI request object
        user: Authenticated user (from dependency)

    Returns:
        JSONResponse: Deletion result
    """
    user_uid = user["uid"]

    try:
        # Get file metadata from Firestore
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        file_doc = user_uploads_ref.document(file_id).get()

        if not file_doc.exists:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = file_doc.to_dict()

        # Delete from GCS
        try:
            bucket = storage_client.bucket(settings.gcp_bucket_name)
            # Reconstruct blob name
            blob_name = f"{user_uid}/{file_id}_{file_data.get('filename', 'unnamed')}"
            blob = bucket.blob(blob_name)
            blob.delete()
            logger.info(f"Deleted blob {blob_name} from GCS")
        except Exception as e:
            logger.warning(
                f"Failed to delete blob from GCS: {e} (continuing with Firestore deletion)"
            )

        # Delete from Firestore
        user_uploads_ref.document(file_id).delete()
        logger.info(f"Deleted file {file_id} metadata from Firestore")

        return JSONResponse(
            status_code=200,
            content=jsonable_encoder(
                {"message": "File deleted successfully", "file_id": file_id}
            ),
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete file")


@router.get("/health", response_description="Upload API health check")
async def upload_health():
    """
    Health check endpoint for upload API (no auth required).

    Returns:
        JSONResponse: API status and configuration
    """
    try:
        # Test GCS access
        bucket = storage_client.bucket(settings.gcp_bucket_name)
        bucket.reload()
        gcs_status = "accessible"
    except Exception as e:
        gcs_status = f"error: {str(e)}"

    try:
        # Test Firestore access
        collections = list(firestore_client.collections())
        firestore_status = "accessible"
    except Exception as e:
        firestore_status = f"error: {str(e)}"

    return JSONResponse(
        status_code=200,
        content=jsonable_encoder(
            {
                "service": "upload-api",
                "status": "healthy",
                "bucket_name": settings.gcp_bucket_name,
                "max_files_per_user": settings.max_files_per_user,
                "max_file_size_mb": settings.max_file_size_mb,
                "allowed_mime_types": list(ALLOWED_MIME_TYPES),
                "gcs_status": gcs_status,
                "firestore_status": firestore_status,
            }
        ),
    )
