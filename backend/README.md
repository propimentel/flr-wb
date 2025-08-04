# FastAPI Backend with Static Frontend Serving

This FastAPI backend serves both the API endpoints and the static Next.js frontend files.

## Features

- **File Upload API** with Firebase authentication
- **Static Frontend Serving** with SPA fallback
- **CORS Configuration** for development and production
- **Health Check Endpoints** for monitoring

## API Endpoints

### Backend Health
- `GET /health` - Backend health check

### Upload API
- `POST /api/upload/` - Upload file (requires auth)
- `GET /api/upload/` - List user's files (requires auth)
- `DELETE /api/upload/{file_id}` - Delete file (requires auth)
- `GET /api/upload/health` - Upload API health check (no auth)

### Frontend
- `GET /` - Serves Next.js frontend
- `GET /*` - SPA fallback for any non-API route

## Static File Serving

The backend automatically serves the Next.js static build from the `static/` directory:

- **Frontend HTML/CSS/JS**: Served from `/static/`
- **Next.js Assets**: Mounted at `/_next/` 
- **SPA Fallback**: Any non-API route serves `index.html`

## Building and Running

### Development
```bash
# Build frontend and copy to backend
./build-frontend.sh

# Start backend with hot reload
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Production
```bash
# Build frontend
./build-frontend.sh

# Start backend
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

Required environment variables in `.env`:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# GCP Storage
GCP_BUCKET_NAME=your-bucket-name
MAX_FILES_PER_USER=5
MAX_FILE_SIZE_MB=10

# CORS
ALLOWED_ORIGINS=["http://localhost:3000","https://your-domain.com"]
```

## Docker Support

Ready for containerization with multi-stage Docker build (see Step 15 in plan).
