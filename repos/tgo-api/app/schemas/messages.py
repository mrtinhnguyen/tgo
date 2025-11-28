"""Message payload schemas for Kafka topics."""

from typing import Any, Dict, Optional
from pydantic import Field

from app.schemas.base import BaseSchema


class IncomingMessagePayload(BaseSchema):
    """Typed payload for the tgo.messages.incoming Kafka topic."""

    from_uid: str = Field(..., description="End-user UID on the platform")
    channel_id: str = Field(..., description="WuKongIM channel identifier (Base62-encoded for 251)")
    channel_type: int = Field(..., description="WuKongIM channel type code")

    platform_type: str = Field(..., description="Platform type identifier (e.g., website, wechat, internal)")

    message_text: str = Field(..., description="User message text")

    project_id: str = Field(..., description="Project UUID (string)")
    project_api_key: str = Field(..., description="Project API key to call AI service")

    client_msg_no: str = Field(..., description="Correlation ID for request/response flow")
    session_id: str = Field(..., description="Session identifier for AI conversation")
    received_at: int = Field(..., description="Ingestion timestamp in ms")

    source: str = Field(..., description="Source of ingestion (e.g., platform_sse, webhook)")
    extra: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional extra context")

    # Staff info (optional)
    staff_id: Optional[str] = Field(None, description="Staff UUID (string)")
    staff_cid: Optional[str] = Field(None, description="Staff chat identifier: {staff_id}-staff")

    # AI targeting (optional)
    team_id: Optional[str] = Field(None, description="AI Team ID to route the message to")
    agent_id: Optional[str] = Field(None, description="AI Agent UUID to route the message to")

    # AI guidance fields (optional)
    system_message: Optional[str] = Field(None, description="System message/prompt to guide the AI agent")
    expected_output: Optional[str] = Field(None, description="Expected output format or description for the AI agent")

    # Conditional AI processing flag
    ai_disabled: Optional[bool] = Field(None, description="Whether AI processing is disabled for this message")


