from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import init_db
from backend.app.api.v1.router import api_v1_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Database Tables
    await init_db()
    yield
    # Shutdown cleanup if needed

app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0-PROD",
    description="Production-grade AI Audio Creation, Multitrack DAW, C2PA Provenance & Licensing Platform API",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Range",
        "Accept-Ranges",
        "Content-Length",
        "Idempotency-Key",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "Retry-After",
    ],
)

# Mount API v1
app.include_router(api_v1_router)

@app.get("/")
async def root():
    return {
        "platform": settings.APP_NAME,
        "version": "2.0.0-PROD",
        "documentation": "/docs",
        "redoc": "/redoc",
        "health": "/api/v1/health",
        "openapi": "/api/v1/openapi.json",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
