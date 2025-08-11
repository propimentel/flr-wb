#!/bin/bash

# Deploy to Google Cloud Run
# This script builds and deploys the application to Cloud Run

set -e  # Exit on any error

# Configuration
PROJECT_ID="frl-wb-3bb36"
REGION="us-central1"
SERVICE_NAME="frl-wb-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
CLEANUP_KEY_SECRET="cleanup-service-key"

echo "🚀 Deploying to Google Cloud Run..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"  
echo "   Image: $IMAGE_NAME"
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
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com \
    secretmanager.googleapis.com

# Create cleanup service key secret if it doesn't exist
echo "🔐 Setting up secrets..."
if ! gcloud secrets describe $CLEANUP_KEY_SECRET &> /dev/null; then
    echo "Creating cleanup service key secret..."
    echo -n "cleanup-secret-key-12345" | gcloud secrets create $CLEANUP_KEY_SECRET --data-file=-
    echo "✅ Secret created: $CLEANUP_KEY_SECRET"
else
    echo "✅ Secret already exists: $CLEANUP_KEY_SECRET"
fi

# Build and push the Docker image
echo "🔨 Building Docker image..."
gcloud builds submit --tag $IMAGE_NAME .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 80 \
    --timeout 300 \
    --max-instances 1 \
    --min-instances 0 \
    --set-env-vars "FIREBASE_PROJECT_ID=frl-wb-3bb36,GCP_BUCKET_NAME=wb-files-3bb36,MAX_FILES_PER_USER=5,MAX_FILE_SIZE_MB=10,RETENTION_DAYS=15,DEBUG=false" \
    --set-secrets "SERVICE_CLEANUP_KEY=${CLEANUP_KEY_SECRET}:latest"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Service Details:"
echo "   - URL: $SERVICE_URL"
echo "   - Health Check: $SERVICE_URL/health"
echo "   - Upload API: $SERVICE_URL/api/upload/health"
echo "   - Frontend: $SERVICE_URL/"
echo ""
echo "🔧 Next Steps:"
echo "   1. Update frontend Firebase config with new API URL"
echo "   2. Update Cloud Scheduler with new backend URL"
echo "   3. Test the application: curl $SERVICE_URL/health"
echo ""
echo "🌐 Firebase Hosting:"
echo "   1. Update firebase.json with new API URL: $SERVICE_URL"
echo "   2. Deploy frontend: firebase deploy --only hosting"
