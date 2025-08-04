# Multi-stage Dockerfile for FastAPI full-stack application

# Frontend build stage
FROM node:18-alpine AS build-frontend

WORKDIR /app

# Copy package files for dependency installation
COPY frontend/package.json frontend/yarn.lock ./frontend/
COPY shared/package.json shared/yarn.lock ./shared/

# Install dependencies
WORKDIR /app/shared
RUN yarn install

WORKDIR /app/frontend
RUN yarn install

# Copy source code
COPY shared/ /app/shared/
COPY frontend/ /app/frontend/

# Build shared components first
WORKDIR /app/shared
RUN yarn build

# Build and export frontend
WORKDIR /app/frontend
RUN yarn build

# Production stage
FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy static frontend files from build stage
COPY --from=build-frontend /app/frontend/out ./static/

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start the application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
