import logging
import os

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.upload import router as upload_router
from app.api.files import router as files_router
from app.core.settings import settings
from app.deps.auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application instance
app = FastAPI(
    title="File Upload API",
    description="FastAPI backend for file upload with Firebase authentication",
    version="1.0.0",
    debug=settings.debug,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(upload_router, prefix=settings.api_prefix, tags=["upload"])
app.include_router(files_router, prefix=settings.api_prefix, tags=["files"])
app.include_router(admin_router, prefix=f"{settings.api_prefix}/admin", tags=["admin"])

# Get the directory of the current file
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(current_dir, "static")

# Mount static files for Next.js assets
if os.path.exists(static_dir):
    app.mount(
        "/_next",
        StaticFiles(directory=os.path.join(static_dir, "_next")),
        name="nextjs-static",
    )

    # SPA fallback - serve index.html for any route not starting with /api
    @app.middleware("http")
    async def spa_fallback(request: Request, call_next):
        """Serve index.html for any route that doesn't start with /api and isn't a static file."""
        response = await call_next(request)

        # If route starts with /api, return as-is
        if request.url.path.startswith("/api"):
            return response

        # If route starts with /_next (static assets), return as-is
        if request.url.path.startswith("/_next"):
            return response

        # If route starts with /health or other backend routes, return as-is
        if request.url.path in ["/health", "/docs", "/redoc", "/openapi.json"]:
            return response

        # If the response is 404 and it's not an API route, serve index.html
        if response.status_code == 404:
            index_path = os.path.join(static_dir, "index.html")
            if os.path.exists(index_path):
                return FileResponse(index_path, media_type="text/html")

        return response

    # Serve index.html for root route
    @app.get("/")
    async def serve_frontend():
        """Serve the frontend index.html."""
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path, media_type="text/html")
        return {
            "message": "Frontend not built. Run 'yarn build' in frontend directory."
        }

else:

    @app.get("/")
    async def root():
        """Root endpoint when static files are not available."""
        return {"message": "FastAPI backend is running. Frontend not built."}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "fastapi-backend"}


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting FastAPI server...")
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
