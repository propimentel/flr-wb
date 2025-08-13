import logging
import mimetypes
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
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

        # Note: Bucket is already configured for public access via uniform bucket-level access
        # So we don't need to call blob.make_public() on individual objects

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
    Save upload metadata to Firestore using global file storage pattern.

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
            "uploaded_by": user_uid,
            "blob_name": f"{user_uid}/{file_id}_{filename}",
        }

        # Save to global files collection (accessible to all users)
        files_ref = firestore_client.collection("files")
        files_ref.document(file_id).set(upload_doc)
        
        # Also save to user's uploads for personal file management
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        user_uploads_ref.document(file_id).set({
            "file_id": file_id,
            "uploaded_at": datetime.utcnow(),
        })

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
        filename = file.filename or 'unnamed'
        
        # Construct consistent blob name (same format used in save_upload_metadata)
        blob_name = f"{user_uid}/{file_id}_{filename}"

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
        # Get user's file IDs from their uploads subcollection
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        user_uploads = list(user_uploads_ref.order_by(
            "uploaded_at", direction=firestore.Query.DESCENDING
        ).stream())
        
        uploads = []
        
        # Get detailed file information from global files collection
        for upload_doc in user_uploads:
            upload_data = upload_doc.to_dict()
            file_id = upload_data.get("file_id")
            
            if file_id:
                # Get full file metadata from global collection
                file_ref = firestore_client.collection("files").document(file_id)
                file_doc = file_ref.get()
                
                if file_doc.exists:
                    file_data = file_doc.to_dict()
                    uploads.append(
                        {
                            "id": file_data.get("id"),
                            "filename": file_data.get("filename"),
                            "download_url": file_data.get("download_url"),
                            "file_size": file_data.get("file_size"),
                            "mime_type": file_data.get("mime_type"),
                            "uploaded_at": (
                                file_data.get("uploaded_at").isoformat()
                                if file_data.get("uploaded_at")
                                else None
                            ),
                        }
                    )
                else:
                    logger.warning(f"File metadata not found in global collection for file_id: {file_id}")

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
    Only the user who uploaded the file can delete it.

    Args:
        file_id: ID of the file to delete
        request: FastAPI request object
        user: Authenticated user (from dependency)

    Returns:
        JSONResponse: Deletion result
    """
    user_uid = user["uid"]

    try:
        # Get file metadata from global files collection
        files_ref = firestore_client.collection("files")
        file_doc = files_ref.document(file_id).get()

        if not file_doc.exists:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = file_doc.to_dict()
        
        # Check if user is authorized to delete this file
        if file_data.get("uploaded_by") != user_uid:
            raise HTTPException(status_code=403, detail="Not authorized to delete this file")

        # Delete from GCS
        try:
            bucket = storage_client.bucket(settings.gcp_bucket_name)
            blob_name = file_data.get("blob_name")
            if blob_name:
                blob = bucket.blob(blob_name)
                blob.delete()
                logger.info(f"Deleted blob {blob_name} from GCS")
        except Exception as e:
            logger.warning(
                f"Failed to delete blob from GCS: {e} (continuing with Firestore deletion)"
            )

        # Delete from global files collection
        files_ref.document(file_id).delete()
        
        # Delete from user's uploads collection
        user_uploads_ref = (
            firestore_client.collection("users")
            .document(user_uid)
            .collection("uploads")
        )
        user_uploads_ref.document(file_id).delete()
        
        logger.info(f"Deleted file {file_id} metadata from Firestore (uploaded by {user_uid})")

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


@router.get("/download/{file_id}", response_description="Download file by ID (DEPRECATED)")
async def download_file_by_id(
    file_id: str, 
    request: Request, 
    user: dict = Depends(get_current_user)
):
    """
    DEPRECATED: This endpoint is kept for backward compatibility but will be removed.
    Please use GET /api/files/{file_id} instead.
    
    Args:
        file_id: The file ID to download
        request: FastAPI request object
        user: Authenticated user (from dependency)
    
    Returns:
        StreamingResponse: Redirects to the new endpoint
    """
    logger.warning(f"DEPRECATED endpoint accessed: /api/upload/download/{file_id}. Use /api/files/{file_id} instead.")
    
    # Construct the new URL path and redirect
    new_url = f"/api/files/{file_id}"
    
    # Use absolute URL if host header is present
    if request.headers.get("host"):
        scheme = request.headers.get("x-forwarded-proto", "http")
        new_url = f"{scheme}://{request.headers['host']}{new_url}"
    
    # Redirect to new endpoint
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=new_url, status_code=308)  # 308 Permanent Redirect


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
