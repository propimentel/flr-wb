# Deployment Guide

This guide covers deploying the real-time collaborative whiteboard application to production.

## Architecture Overview

The application is deployed as a containerized FastAPI backend serving both API endpoints and static frontend files, with Firebase for authentication and data storage.

### Components
- **Frontend**: Next.js static build served by FastAPI
- **Backend**: FastAPI with Firebase authentication
- **Database**: Cloud Firestore
- **Storage**: Google Cloud Storage
- **Hosting**: Google Cloud Run
- **CDN**: Firebase Hosting (optional)
- **Scheduler**: Cloud Scheduler for cleanup

## Prerequisites

### Required Tools
```bash
# Install required tools
npm install -g firebase-tools
curl https://sdk.cloud.google.com | bash
docker --version
```

### Required Accounts & APIs
1. **Google Cloud Project**: Create project `frl-wb`
2. **Firebase Project**: Link to GCP project
3. **APIs Enabled**:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - Secret Manager API
   - Cloud Scheduler API
   - Firestore API

### Environment Setup
```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project frl-wb

# Authenticate with Firebase
firebase login
firebase use frl-wb
```

## Deployment Options

### Option 1: Automated Deployment (Recommended)

#### GitHub Actions CI/CD
1. **Set up repository secrets**:
   ```
   GCP_SA_KEY: Service account JSON key
   FIREBASE_TOKEN: Firebase CI token
   FIREBASE_SERVICE_ACCOUNT: Firebase service account JSON
   ```

2. **Push to main branch**:
   ```bash
   git push origin main
   ```

3. **Monitor deployment**: Check GitHub Actions tab

#### Local Automated Deployment
```bash
# Deploy everything
./infra/deploy-cloud-run.sh
./deploy-firestore-rules.sh
./infra/deploy-scheduler.sh
```

### Option 2: Manual Deployment

#### Step 1: Build and Deploy Backend
```bash
# Build Docker image
docker build -t gcr.io/frl-wb/frl-wb-backend .

# Push to registry
docker push gcr.io/frl-wb/frl-wb-backend

# Deploy to Cloud Run
gcloud run deploy frl-wb-backend \
  --image gcr.io/frl-wb/frl-wb-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Step 2: Deploy Firestore Rules
```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

#### Step 3: Setup Cloud Scheduler
```bash
# Create cleanup job
gcloud scheduler jobs create http cleanup-job \
  --location=us-central1 \
  --schedule="0 0 * * *" \
  --uri="https://your-service-url/api/admin/cleanup" \
  --http-method=GET \
  --headers="SERVICE_KEY=your-secret-key"
```

#### Step 4: Deploy Frontend (Optional)
```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Configuration

### Environment Variables

#### Production Environment
```bash
# Core settings
PORT=8080
DEBUG=false

# Firebase
FIREBASE_PROJECT_ID=frl-wb-3bb36
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Storage
GCP_BUCKET_NAME=wb-files
MAX_FILES_PER_USER=5
MAX_FILE_SIZE_MB=10

# Cleanup
RETENTION_DAYS=15
SERVICE_CLEANUP_KEY=your-secret-key

# CORS
ALLOWED_ORIGINS=["https://frl-wb.web.app","https://your-domain.com"]
```

#### Secrets Management
```bash
# Create secrets in Secret Manager
echo -n "your-secret-key" | gcloud secrets create cleanup-service-key --data-file=-

# Reference in Cloud Run
--set-secrets "SERVICE_CLEANUP_KEY=cleanup-service-key:latest"
```

### Firebase Configuration

#### Frontend Config (`.env`)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=frl-wb-3bb36.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=frl-wb-3bb36
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=frl-wb-3bb36.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=164534144386
NEXT_PUBLIC_FIREBASE_APP_ID=1:164534144386:web:6cf700abc4b94843e5d39b
NEXT_PUBLIC_API_URL=https://your-cloud-run-url.com
```

## Production Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Secrets created in Secret Manager
- [ ] Firebase APIs enabled
- [ ] GCS bucket created and configured
- [ ] Service account permissions verified

### Security
- [ ] Firestore security rules deployed
- [ ] CORS origins configured for production
- [ ] Service account follows least privilege
- [ ] Secrets properly managed
- [ ] Health checks configured

### Performance
- [ ] Docker image optimized (multi-stage build)
- [ ] Static assets served efficiently
- [ ] Cloud Run scaling configured
- [ ] CDN configured for static assets

### Monitoring
- [ ] Health checks responding
- [ ] Logs configured and accessible
- [ ] Error monitoring setup
- [ ] Performance monitoring enabled

## Post-Deployment

### Verification Steps
```bash
# Check service health
curl https://your-service-url/health

# Test upload API
curl https://your-service-url/api/upload/health

# Test frontend
curl https://your-service-url/

# Test Firebase authentication
# (Use frontend to test login flow)
```

### Monitoring & Maintenance

#### Cloud Run Monitoring
- **Metrics**: [Cloud Run Console](https://console.cloud.google.com/run)
- **Logs**: [Cloud Logging](https://console.cloud.google.com/logs)
- **Errors**: [Error Reporting](https://console.cloud.google.com/errors)

#### Firebase Monitoring
- **Usage**: [Firebase Console](https://console.firebase.google.com)
- **Performance**: [Performance Monitoring](https://console.firebase.google.com/project/frl-wb/performance)
- **Authentication**: [Auth Console](https://console.firebase.google.com/project/frl-wb/authentication)

#### Scheduled Tasks
- **Cleanup Job**: [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
- **Logs**: Check cleanup execution logs
- **Storage**: Monitor GCS usage and costs

## Scaling & Performance

### Auto-Scaling Configuration
```yaml
# Cloud Run auto-scaling
autoscaling.knative.dev/maxScale: "100"
autoscaling.knative.dev/minScale: "1"
```

### Resource Limits
```yaml
# Resource allocation
resources:
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

### Performance Optimization
- **CDN**: Use Firebase Hosting for static assets
- **Caching**: Implement appropriate cache headers
- **Database**: Optimize Firestore queries and indexes
- **Storage**: Use appropriate GCS storage classes

## Troubleshooting

### Common Issues

#### Deployment Fails
1. Check Docker build logs
2. Verify all required files are included
3. Check environment variables
4. Validate service account permissions

#### Authentication Issues
1. Verify Firebase configuration
2. Check CORS settings
3. Validate service account key
4. Test with Firebase emulator

#### Performance Issues
1. Monitor Cloud Run metrics
2. Check database query performance
3. Optimize Docker image size
4. Review auto-scaling settings

### Debug Commands
```bash
# View service logs
gcloud logs read --service=frl-wb-backend

# Check service status
gcloud run services describe frl-wb-backend --region=us-central1

# Test local Docker build
docker build -t test-app .
docker run -p 8080:8080 test-app

# Firebase emulator
firebase emulators:start
```

## Cost Optimization

### Resource Management
- **Cloud Run**: Pay-per-request model
- **Firestore**: Optimize queries and data structure
- **Storage**: Use appropriate storage classes
- **Scheduler**: Minimal cost for cleanup jobs

### Monitoring Costs
- Set up billing alerts
- Monitor usage dashboards
- Regular cost reviews

## Support & Maintenance

### Regular Tasks
- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and optimize costs
- **Annually**: Security audit and architecture review

### Backup & Recovery
- **Firestore**: Automatic backups enabled
- **Storage**: Versioning and lifecycle policies
- **Code**: Version control with Git
- **Configuration**: Document all settings

For additional support, refer to:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
