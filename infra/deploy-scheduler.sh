#!/bin/bash

# Deploy Cloud Scheduler job for cleanup operations
# This script creates a Cloud Scheduler job that triggers daily cleanup

set -e  # Exit on any error

# Configuration variables
PROJECT_ID="frl-wb"
REGION="us-central1"
JOB_NAME="cleanup-job"
SERVICE_ACCOUNT_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"
BACKEND_URL="https://your-app-url.com"  # Update this with your actual URL
SERVICE_KEY="cleanup-secret-key-12345"  # Should match your backend config

echo "🕐 Deploying Cloud Scheduler cleanup job..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Job Name: $JOB_NAME"
echo "   Backend URL: $BACKEND_URL"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ No active gcloud authentication found. Please run: gcloud auth login"
    exit 1
fi

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable cloudscheduler.googleapis.com

# Create the Cloud Scheduler job
echo "⏰ Creating Cloud Scheduler job..."
gcloud scheduler jobs create http $JOB_NAME \
    --location=$REGION \
    --schedule="0 0 * * *" \
    --time-zone="UTC" \
    --uri="$BACKEND_URL/api/admin/cleanup" \
    --http-method=GET \
    --headers="Content-Type=application/json,SERVICE_KEY=$SERVICE_KEY" \
    --description="Daily cleanup job for old Firestore data and GCS objects" \
    --oidc-service-account-email="$SERVICE_ACCOUNT_EMAIL" \
    --oidc-token-audience="$BACKEND_URL"

echo "✅ Cloud Scheduler job created successfully!"
echo ""
echo "📋 Job Details:"
echo "   - Schedule: Daily at midnight UTC (0 0 * * *)"
echo "   - Endpoint: $BACKEND_URL/api/admin/cleanup"
echo "   - Authentication: OIDC with service account"
echo "   - Retention: 15 days (configurable in backend)"
echo ""
echo "🔧 To manage the job:"
echo "   List jobs: gcloud scheduler jobs list --location=$REGION"
echo "   Run now: gcloud scheduler jobs run $JOB_NAME --location=$REGION"
echo "   Delete: gcloud scheduler jobs delete $JOB_NAME --location=$REGION"
