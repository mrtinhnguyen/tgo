"""Internal services router.

This router includes all internal endpoints that do not require authentication.
These endpoints are designed for inter-service communication within the internal network.
"""

from fastapi import APIRouter

from app.api.internal.endpoints import ai_events, users, toolstore

internal_router = APIRouter()

# Include internal endpoints (no authentication required)
internal_router.include_router(
    ai_events.router,
    prefix="/ai/events",
    tags=["Internal AI Events"]
)

# New users endpoint
internal_router.include_router(
    users.router,
    prefix="/users",
    tags=["Internal Users"]
)

# ToolStore endpoint
internal_router.include_router(
    toolstore.router,
    prefix="/toolstore",
    tags=["Internal ToolStore"]
)
