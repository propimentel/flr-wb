import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from google.cloud import firestore, storage

from app.core.settings import settings
from app.deps.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize GCP clients
storage_client = storage.Client()
firestore_client = firestore.Client()


async def perform_cleanup() -> dict:
    """
    Perform cleanup of old data from Firestore and GCS.

    Returns:
        dict: Summary of cleanup operations
    """
    cleanup_summary = {
        "boards_deleted": 0,
        "strokes_deleted": 0,
        "messages_deleted": 0,
        "uploads_deleted": 0,
        "gcs_objects_deleted": 0,
        "errors": [],
    }

    try:
        expiration_date = datetime.utcnow() - timedelta(days=settings.retention_days)
        logger.info(f"Cleaning up data older than {expiration_date}")

        # 1. Clean up old boards and their subcollections (strokes, messages)
        await cleanup_boards(expiration_date, cleanup_summary)

        # 2. Clean up old user uploads and associated GCS objects
        await cleanup_user_uploads(expiration_date, cleanup_summary)

        logger.info(f"Cleanup completed: {cleanup_summary}")
        return cleanup_summary

    except Exception as e:
        logger.error(f"Failed to perform cleanup: {e}")
        cleanup_summary["errors"].append(str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def cleanup_boards(expiration_date: datetime, summary: dict) -> None:
    """
    Clean up old boards and their subcollections.

    Args:
        expiration_date: Cutoff date for deletion
        summary: Cleanup summary to update
    """
    try:
        boards_ref = firestore_client.collection("boards")

        # Query all boards (we'll check timestamps of strokes/messages inside)
        for board_doc in boards_ref.stream():
            board_id = board_doc.id
            logger.info(f"Checking board {board_id} for old data")

            # Clean up old strokes
            strokes_ref = board_doc.reference.collection("strokes")
            old_strokes = strokes_ref.where("timestamp", "<", expiration_date).stream()

            stroke_count = 0
            for stroke in old_strokes:
                stroke.reference.delete()
                stroke_count += 1

            if stroke_count > 0:
                logger.info(f"Deleted {stroke_count} old strokes from board {board_id}")
                summary["strokes_deleted"] += stroke_count

            # Clean up old messages
            messages_ref = board_doc.reference.collection("messages")
            old_messages = messages_ref.where(
                "timestamp", "<", expiration_date
            ).stream()

            message_count = 0
            for message in old_messages:
                message.reference.delete()
                message_count += 1

            if message_count > 0:
                logger.info(
                    f"Deleted {message_count} old messages from board {board_id}"
                )
                summary["messages_deleted"] += message_count

            # Check if board is completely empty and old
            remaining_strokes = len(list(strokes_ref.limit(1).stream()))
            remaining_messages = len(list(messages_ref.limit(1).stream()))

            if remaining_strokes == 0 and remaining_messages == 0:
                # Board is empty, delete it if it's old enough
                board_data = board_doc.to_dict()
                board_created = board_data.get("created_at", datetime.utcnow())

                if isinstance(board_created, str):
                    # Handle string timestamps
                    board_created = datetime.fromisoformat(
                        board_created.replace("Z", "+00:00")
                    )

                if board_created < expiration_date:
                    board_doc.reference.delete()
                    logger.info(f"Deleted empty board {board_id}")
                    summary["boards_deleted"] += 1

    except Exception as e:
        logger.error(f"Error cleaning up boards: {e}")
        summary["errors"].append(f"Board cleanup error: {str(e)}")


async def cleanup_user_uploads(expiration_date: datetime, summary: dict) -> None:
    """
    Clean up old user uploads and associated GCS objects.

    Args:
        expiration_date: Cutoff date for deletion
        summary: Cleanup summary to update
    """
    try:
        users_ref = firestore_client.collection("users")

        for user_doc in users_ref.stream():
            user_id = user_doc.id
            uploads_ref = user_doc.reference.collection("uploads")

            # Find old uploads
            old_uploads = uploads_ref.where(
                "uploaded_at", "<", expiration_date
            ).stream()

            for upload_doc in old_uploads:
                upload_data = upload_doc.to_dict()
                file_id = upload_data.get("id")
                filename = upload_data.get("filename", "unknown")

                # Delete from GCS
                try:
                    bucket = storage_client.bucket(settings.gcp_bucket_name)
                    blob_name = f"{user_id}/{file_id}_{filename}"
                    blob = bucket.blob(blob_name)

                    if blob.exists():
                        blob.delete()
                        logger.info(f"Deleted GCS object: {blob_name}")
                        summary["gcs_objects_deleted"] += 1

                except Exception as gcs_error:
                    logger.warning(
                        f"Failed to delete GCS object {blob_name}: {gcs_error}"
                    )
                    summary["errors"].append(f"GCS deletion error: {str(gcs_error)}")

                # Delete from Firestore
                upload_doc.reference.delete()
                summary["uploads_deleted"] += 1
                logger.info(f"Deleted upload {file_id} from user {user_id}")

    except Exception as e:
        logger.error(f"Error cleaning up user uploads: {e}")
        summary["errors"].append(f"Upload cleanup error: {str(e)}")


@router.get("/cleanup", response_description="Perform cleanup of old data")
async def cleanup_route(request: Request):
    """
    Perform cleanup of old data.

    Returns:
        JSONResponse: Cleanup summary and results
    """
    try:
        service_key = request.headers.get("SERVICE_KEY", None)
        if service_key != settings.service_cleanup_key:
            raise HTTPException(status_code=401, detail="Unauthorized access")

        cleanup_summary = await perform_cleanup()

        return {
            "message": "Cleanup completed successfully",
            "summary": cleanup_summary,
            "retention_days": settings.retention_days,
        }
    except HTTPException:
        raise  # Preserve HTTP exceptions
    except Exception as e:
        logger.error(f"Failed to run cleanup endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
