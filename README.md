# Real-time Collaborative Whiteboard

A real-time collaborative whiteboard application leveraging Firebase for authentication and Firestore for storage. This application allows users to draw on a shared canvas, chat with other collaborators, and upload files with seamless integration of modern web technologies.

## Features
- Real-time drawing and messaging
- JWT-based authentication
- FastAPI backend with Google Cloud Storage
- CI/CD pipeline with GitHub Actions
- Security features with Firestore rules
- Frontend built with Next.js
- Strong typing and code quality instruments

## Getting Started

Follow the setup instructions for local development and production deployment.

### Prerequisites
- Node.js and Yarn
- Python 3.7+
- Firebase account
- Google Cloud account
- Docker (for production)

### Setup

#### Quick Start - Local Development
```bash
# Install all dependencies
yarn install:all

# Start both frontend and backend servers concurrently
yarn dev:full
```

This will start:
- **Frontend**: http://localhost:3000 (Next.js development server)
- **Backend**: http://localhost:8000 (FastAPI with auto-reload)

Both servers will run concurrently with colored output for easy debugging.

#### Frontend
```bash
cd frontend
# Install dependencies
yarn install
# Start development server
yarn dev
# Run tests
yarn test
```

#### Backend
```bash
cd backend
# Create virtual environment
python -m venv .venv
# Activate virtual environment
source .venv/bin/activate
# Install dependencies
pip install -r requirements.txt
# Run development server
uvicorn app.main:app --reload
# Run tests
pytest
```

### Docker

Build and run the whole application via Docker:
```bash
docker-compose up --build
```

## Documentation

- [Architecture Overview](docs/architecture.md)

## CI/CD

This project uses GitHub Actions to automate testing and deployments. Refer to the GitHub Actions workflow configuration for detailed actions.

---
