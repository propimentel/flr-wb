#!/bin/bash

# Build script for the real-time whiteboard frontend
# This script builds the Next.js frontend and copies static files to the backend

set -e  # Exit on any error

echo "🔨 Building frontend and preparing static files for backend..."

# Navigate to project root
cd "$(dirname "$0")"

# Build shared components first
echo "📦 Building shared components..."
cd shared
npm run build
cd ..

# Build frontend
echo "🏗️ Building Next.js frontend..."
cd frontend
yarn build
cd ..

# Copy static files to backend
echo "📋 Copying static files to backend..."
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/out/* backend/static/

echo "✅ Frontend build complete!"
echo "   - Static files copied to backend/static/"
echo "   - Frontend ready to be served by FastAPI"
echo ""
echo "🚀 You can now start the backend server:"
echo "   cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
