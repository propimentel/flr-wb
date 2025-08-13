import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from google.cloud import firestore, storage

from app.core.settings import settings
from app.deps.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files")

# Initialize GCP clients
storage_client = storage.Client()
firestore_client = firestore.Client()


@router.get("/{file_id}", response_description="Download file by ID")
async def get_file(
    file_id: str, 
    request: Request, 
    user: dict = Depends(get_current_user)
):
    """
    Download a file by its ID using proper REST patterns.
    GET /api/files/{file_id} - Standard REST pattern for file retrieval.
    
    Args:
        file_id: The file ID to download
        request: FastAPI request object
        user: Authenticated user (from dependency)
    
    Returns:
        StreamingResponse: The file content with appropriate headers
    """
    user_uid = user["uid"]
    
    logger.info(f"File download request: file_id={file_id}, user_uid={user_uid}")
    
    try:
        # Get file metadata from global files collection
        files_ref = firestore_client.collection("files")
        file_doc = files_ref.document(file_id).get()
        
        if not file_doc.exists:
            logger.warning(f"File {file_id} not found in global files collection")
            raise HTTPException(status_code=404, detail="File not found")
        
        file_data = file_doc.to_dict()
        filename = file_data.get("filename", "download")
        mime_type = file_data.get("mime_type", "application/octet-stream")
        blob_name = file_data.get("blob_name")
        uploaded_by = file_data.get("uploaded_by")
        
        if not blob_name:
            logger.error(f"File {file_id} has no blob_name in metadata")
            raise HTTPException(status_code=500, detail="File metadata corrupted")
        
        logger.info(f"File metadata: filename={filename}, blob_name={blob_name}, uploaded_by={uploaded_by}")
        
        # Get file from GCS
        bucket = storage_client.bucket(settings.gcp_bucket_name)
        blob = bucket.blob(blob_name)
        
        if not blob.exists():
            logger.error(f"File {file_id} metadata exists but blob {blob_name} not found in GCS")
            raise HTTPException(status_code=404, detail="File not found in storage")
        
        # Stream the file content
        def generate_file_stream():
            try:
                with blob.open("rb") as f:
                    while True:
                        chunk = f.read(8192)  # 8KB chunks
                        if not chunk:
                            break
                        yield chunk
            except Exception as e:
                logger.error(f"Error streaming file {file_id}: {e}")
                raise HTTPException(status_code=500, detail="Error streaming file")
        
        # Return streaming response with appropriate headers
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": mime_type,
            "Cache-Control": "no-cache",
            "X-File-ID": file_id,
            "X-Uploaded-By": uploaded_by,
        }
        
        logger.info(f"Streaming file {file_id} ({filename}) to user {user_uid}")
        
        return StreamingResponse(
            generate_file_stream(),
            media_type=mime_type,
            headers=headers
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error downloading file {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download file")


@router.get("/{file_id}/info", response_description="Get file metadata")
async def get_file_info(
    file_id: str,
    request: Request,
    user: dict = Depends(get_current_user)
):
    """
    Get file metadata without downloading the file.
    GET /api/files/{file_id}/info - Get file information
    
    Args:
        file_id: The file ID
        request: FastAPI request object
        user: Authenticated user (from dependency)
    
    Returns:
        JSONResponse: File metadata
    """
    user_uid = user["uid"]
    
    logger.info(f"File info request: file_id={file_id}, user_uid={user_uid}")
    
    try:
        # Get file metadata from global files collection
        files_ref = firestore_client.collection("files")
        file_doc = files_ref.document(file_id).get()
        
        if not file_doc.exists:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_data = file_doc.to_dict()
        
        # Return sanitized file info
        return {
            "id": file_data.get("id"),
            "filename": file_data.get("filename"),
            "file_size": file_data.get("file_size"),
            "mime_type": file_data.get("mime_type"),
            "uploaded_at": file_data.get("uploaded_at").isoformat() if file_data.get("uploaded_at") else None,
            "uploaded_by": file_data.get("uploaded_by"),
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file info {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get file info")
