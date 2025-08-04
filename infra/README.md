# Infrastructure - Cleanup Operations & Scheduler

This directory contains infrastructure configuration for automated cleanup operations.

## Overview

The cleanup system automatically removes old data from the application to manage storage costs and comply with data retention policies.

### What Gets Cleaned Up

- **Whiteboard Strokes**: Drawing strokes older than 15 days
- **Chat Messages**: Messages older than 15 days  
- **User Uploads**: Files uploaded more than 15 days ago
- **GCS Objects**: Associated files in Google Cloud Storage
- **Empty Boards**: Boards with no strokes or messages

### Retention Policy

- **Default**: 15 days (configurable via `RETENTION_DAYS` environment variable)
- **Runs**: Daily at midnight UTC
- **Method**: Incremental cleanup (only processes old data)

## Files

### `cloud_scheduler.yaml`
Cloud Scheduler job configuration template for automated cleanup.

### `deploy-scheduler.sh`
Deployment script to create the Cloud Scheduler job.

## Deployment

### Prerequisites

1. **Enable APIs**:
   ```bash
   gcloud services enable cloudscheduler.googleapis.com
   gcloud services enable firestore.googleapis.com
   ```

2. **Backend Deployed**: Your FastAPI backend must be deployed and accessible

3. **Service Account**: Default App Engine service account with Firestore and Storage permissions

### Deploy Scheduler

1. **Update Configuration**:
   ```bash
   # Edit deploy-scheduler.sh
   BACKEND_URL="https://your-actual-backend-url.com"
   SERVICE_KEY="your-actual-service-key"
   ```

2. **Run Deployment**:
   ```bash
   ./infra/deploy-scheduler.sh
   ```

## API Endpoint

### GET /api/admin/cleanup

**Authentication**: Requires `SERVICE_KEY` header

**Response**:
```json
{
  "message": "Cleanup completed successfully",
  "summary": {
    "boards_deleted": 2,
    "strokes_deleted": 150,
    "messages_deleted": 45,
    "uploads_deleted": 8,
    "gcs_objects_deleted": 8,
    "errors": []
  },
  "retention_days": 15
}
```

**Manual Execution**:
```bash
curl -H "SERVICE_KEY: your-service-key" \
     https://your-backend-url.com/api/admin/cleanup
```

## Monitoring

### Cloud Scheduler Console
- View job status: [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler)
- Check execution history and logs

### Backend Logs
- Cleanup operations are logged with INFO level
- Errors are logged with ERROR level
- View logs in Cloud Logging

### Commands
```bash
# List scheduler jobs
gcloud scheduler jobs list --location=us-central1

# Run cleanup manually
gcloud scheduler jobs run cleanup-job --location=us-central1

# View job details
gcloud scheduler jobs describe cleanup-job --location=us-central1
```

## Configuration

### Environment Variables

```bash
# Backend .env
RETENTION_DAYS=15                    # Days to retain data
SERVICE_CLEANUP_KEY=your-secret-key  # Authentication key for cleanup endpoint
```

### Customization

- **Schedule**: Modify cron expression in deployment script
- **Retention**: Change `RETENTION_DAYS` environment variable
- **Scope**: Modify cleanup logic in `backend/app/api/admin.py`

## Security

- **Authentication**: SERVICE_KEY header required
- **OIDC**: Cloud Scheduler uses service account OIDC tokens
- **Permissions**: Service account needs Firestore and Storage permissions
- **Network**: Endpoint only accepts requests from Cloud Scheduler

## Troubleshooting

### Common Issues

1. **401 Unauthorized**:
   - Check SERVICE_KEY matches backend configuration
   - Verify OIDC token configuration

2. **500 Internal Server Error**:
   - Check backend logs for detailed error messages
   - Verify Firestore and Storage permissions

3. **Job Not Running**:
   - Check Cloud Scheduler console for job status
   - Verify job schedule and timezone

### Recovery

If cleanup fails or needs to be run manually:

```bash
# Run cleanup immediately
gcloud scheduler jobs run cleanup-job --location=us-central1

# Check backend health
curl https://your-backend-url.com/health
curl https://your-backend-url.com/api/upload/health
```
