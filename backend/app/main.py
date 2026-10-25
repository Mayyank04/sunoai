import uuid
import time
import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.database import init_db
from backend.app.api.v1.router import api_v1_router
from backend.app.api.v1.lyrics import router as lyrics_router

logger = logging.getLogger("fombo.server")
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Database Tables
    await init_db()
    from backend.app.services.job_runner import job_runner
    await job_runner.start()
    try:
        yield
    finally:
        await job_runner.stop()

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
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "Retry-After",
    ],
)

# Request ID & Audit Logging Middleware
@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    request.state.request_id = request_id
    start_time = time.time()

    logger.info(f"[{request_id}] START {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        elapsed_ms = (time.time() - start_time) * 1000.0
        response.headers["X-Request-ID"] = request_id
        logger.info(f"[{request_id}] FINISH {request.method} {request.url.path} - Status: {response.status_code} ({elapsed_ms:.1f}ms)")
        return response
    except Exception as exc:
        elapsed_ms = (time.time() - start_time) * 1000.0
        logger.error(f"[{request_id}] UNHANDLED ERROR {request.method} {request.url.path} ({elapsed_ms:.1f}ms): {str(exc)}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={"X-Request-ID": request_id},
            content={
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing your request. Please quote the request ID if contacting support.",
                "request_id": request_id,
                "detail": str(exc) if settings.DEBUG else "Internal server error occurred.",
            },
        )

# Global HTTPException handler ensuring X-Request-ID header propagation
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    logger.warning(f"[{request_id}] HTTP {exc.status_code} on {request.method} {request.url.path}: {exc.detail}")
    headers = dict(exc.headers or {})
    headers["X-Request-ID"] = request_id
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={"detail": exc.detail},
    )

# Mount API v1
app.include_router(api_v1_router)

# Mount /api/lyrics directly for unversioned lyrics endpoints
app.include_router(lyrics_router, prefix="/api")

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:;"
    return response

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
