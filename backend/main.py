"""
EconoMe — Main FastAPI Application Factory
Phase 3: WebSocket Integration for Real-Time Updates
"""

from contextlib import asynccontextmanager

from config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from modules.ai_insight.router import router as insight_router
from modules.auth.router import router as auth_router
from modules.chat.router import router as chat_router
from modules.finance.router import router as finance_router
from modules.learning.router import router as learning_router
from modules.macro.router import router as macro_router
from shared.database import init_db
from shared.exceptions import register_exception_handlers
from shared.redis_client import init_redis
from shared.websocket_manager import register_websocket_handlers, sio
from socketio import ASGIApp


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await init_db()
    await init_redis()
    register_websocket_handlers()  # Initialize WebSocket handlers
    yield
    # cleanup on shutdown (connections closed automatically)


def create_app() -> FastAPI:
    app = FastAPI(
        title="EconoMe API",
        description="Secure AI-Powered Personal Finance Awareness System",
        version="1.0.0",
        docs_url="/docs" if settings.ENV != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────
    # CORS with cookie support
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,  # Allow cookies
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Range", "X-Content-Range"],
        max_age=600,  # Preflight cache
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if settings.ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' https://cdn.jsdelivr.net https://fastapi.tiangolo.com; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com;"
        )
        return response

    # ── Exception Handlers ────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────
    app.include_router(auth_router, prefix="/auth", tags=["Auth"])
    # Import and include enhanced auth router (v2 with OTP and cookies)
    try:
        from modules.auth.enhanced_router import enhanced_router

        app.include_router(enhanced_router, tags=["Auth v2"])
    except ImportError:
        pass  # Enhanced router not yet available
    app.include_router(finance_router, prefix="/finance", tags=["Finance"])
    app.include_router(macro_router, prefix="/macro", tags=["Macro"])
    app.include_router(insight_router, prefix="/insights", tags=["AI Insights"])
    app.include_router(learning_router, prefix="/learning", tags=["Learning"])
    app.include_router(chat_router, prefix="/chat", tags=["AI Tutor"])

    @app.get("/")
    async def root():
        return {
            "message": "EconoMe API is running",
            "docs": "/docs",
            "health": "/health",
            "websocket": "/socket.io",
        }

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "econome-api"}

    return app


app = create_app()

# Wrap FastAPI app with Socket.io ASGI middleware
app = ASGIApp(sio, app)
