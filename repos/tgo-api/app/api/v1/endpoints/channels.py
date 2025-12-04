"""Channel information endpoints."""

from typing import Any, Dict, Optional, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import get_db
from app.core.security import verify_token, get_user_language, UserLanguage
from app.models import Staff, Visitor, VisitorTag, VisitorActivity, Platform
from app.schemas.visitor import (
    VisitorResponse,
    VisitorAIProfileResponse,
    VisitorAIInsightResponse,
    VisitorSystemInfoResponse,
    VisitorActivityResponse,
    set_visitor_display_nickname,
    resolve_visitor_display_name,
)
from app.schemas import TagResponse
from app.schemas.tag import set_tag_list_display_name
from app.services.ai_client import ai_client

from app.utils.const import CHANNEL_TYPE_CUSTOMER_SERVICE
from app.utils.encoding import parse_visitor_channel_id
from app.utils.intent import localize_visitor_response_intent


router = APIRouter()


# Channel ID suffixes
STAFF_SUFFIX = "-staff"
AGENT_SUFFIX = "-agent"
TEAM_SUFFIX = "-team"


class ChannelInfoResponse(BaseModel):
    name: str = Field(..., description="Channel display name")
    avatar: str = Field(..., description="Channel avatar URL")
    channel_id: str = Field(..., description="WuKongIM channel identifier")
    channel_type: int = Field(..., description="Channel type: 1 (personal), 251 (customer service)")
    entity_type: Literal["visitor", "staff", "agent", "team"] = Field(
        ..., description="Entity type represented by this channel: 'visitor', 'staff', 'agent', or 'team'"
    )
    extra: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Scenario 1 – Customer Service Channel (channel_type == 251):\n"
            "- extra contains the complete VisitorResponse as a dictionary.\n\n"
            "Scenario 2 – Personal Channel - Staff (channel_type == 1 AND channel_id ends with '-staff'):\n"
            "- extra contains staff metadata: staff_id, username, role.\n\n"
            "Scenario 3 – Personal Channel - Agent (channel_type == 1 AND channel_id ends with '-agent'):\n"
            "- extra contains agent metadata from AI service: id, name, instruction, model, is_default, config, team_id, tools, collections.\n\n"
            "Scenario 4 – Personal Channel - Team (channel_type == 1 AND channel_id ends with '-team'):\n"
            "- extra contains team metadata from AI service: id, name, model, instruction, expected_output, is_default, agents.\n\n"
            "Scenario 5 – Personal Channel - Visitor (channel_type == 1 AND channel_id does NOT end with '-staff', '-agent', or '-team'):\n"
            "- Same as Scenario 1: extra contains the complete VisitorResponse as a dictionary."
        ),
        json_schema_extra={
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "platform_id": "00000000-0000-0000-0000-000000000001",
                    "platform_type": "website",
                    "name": "Jane Doe",
                    "is_online": True
                },
                {
                    "staff_id": "7b7d3d6e-8a7d-4a23-9a2f-1f1c9c7f8f00",
                    "username": "support.alice",
                    "role": "user"
                },
                {
                    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
                    "name": "Customer Support Agent",
                    "model": "gpt-4",
                    "is_default": True,
                    "tools": [],
                    "collections": []
                },
                {
                    "id": "b2c3d4e5-6789-01ab-cdef-234567890abc",
                    "name": "Customer Support Team",
                    "model": "gpt-4",
                    "is_default": True,
                    "agents": []
                },
            ]
        },
    )


def _build_enriched_visitor_payload(
    visitor: Visitor,
    db: Session,
    project_id: UUID,
    accept_language: Optional[str] = None,
    user_language: UserLanguage = "en",
) -> VisitorResponse:
    """Build enriched visitor payload with tags, AI profile/insights, system info, and activities."""
    active_tags = [
        vt.tag
        for vt in visitor.visitor_tags
        if vt.deleted_at is None and vt.tag and vt.tag.deleted_at is None
    ]
    tag_responses = [TagResponse.model_validate(tag) for tag in active_tags]
    set_tag_list_display_name(tag_responses, user_language)

    ai_profile_response = (
        VisitorAIProfileResponse.model_validate(visitor.ai_profile) if visitor.ai_profile else None
    )
    ai_insight_response = (
        VisitorAIInsightResponse.model_validate(visitor.ai_insight) if visitor.ai_insight else None
    )
    system_info_response = (
        VisitorSystemInfoResponse.model_validate(visitor.system_info) if visitor.system_info else None
    )

    recent_activities = (
        db.query(VisitorActivity)
        .filter(
            VisitorActivity.visitor_id == visitor.id,
            VisitorActivity.project_id == project_id,
            VisitorActivity.deleted_at.is_(None),
        )
        .order_by(VisitorActivity.occurred_at.desc())
        .limit(10)
        .all()
    )
    recent_activity_responses = [
        VisitorActivityResponse.model_validate(activity) for activity in recent_activities
    ]

    visitor_payload = VisitorResponse.model_validate(visitor).model_copy(
        update={
            "tags": tag_responses,
            "ai_profile": ai_profile_response,
            "ai_insights": ai_insight_response,
            "system_info": system_info_response,
            "recent_activities": recent_activity_responses,
        }
    )
    localize_visitor_response_intent(visitor_payload, accept_language)

    return visitor_payload


def _get_visitor_with_relations(db: Session, visitor_id: UUID, project_id: UUID) -> Optional[Visitor]:
    """Query visitor with all necessary relations loaded."""
    return (
        db.query(Visitor)
        .options(
            selectinload(Visitor.platform),
            selectinload(Visitor.visitor_tags).selectinload(VisitorTag.tag),
            selectinload(Visitor.ai_profile),
            selectinload(Visitor.ai_insight),
            selectinload(Visitor.system_info),
        )
        .filter(
            Visitor.id == visitor_id,
            Visitor.project_id == project_id,
            Visitor.deleted_at.is_(None),
        )
        .first()
    )


def _build_visitor_channel_response(
    visitor: Visitor,
    visitor_payload: VisitorResponse,
    channel_id: str,
    channel_type: int,
    user_language: UserLanguage = "en",
) -> ChannelInfoResponse:
    """Build channel response for visitor entity."""
    name = resolve_visitor_display_name(
        name=visitor.name,
        nickname=visitor.nickname,
        nickname_zh=visitor.nickname_zh,
        language=user_language,
        fallback="Unknown Visitor",
    )
    avatar = visitor_payload.avatar_url or ""
    return ChannelInfoResponse(
        name=name,
        avatar=avatar,
        channel_id=channel_id,
        channel_type=channel_type,
        entity_type="visitor",
        extra=visitor_payload.model_dump(),
    )


def _build_staff_channel_response(
    staff: Staff,
    channel_id: str,
    channel_type: int,
) -> ChannelInfoResponse:
    """Build channel response for staff entity."""
    name = staff.nickname or "Unknown Staff"
    avatar = staff.avatar_url or ""
    extra = {
        "staff_id": str(staff.id),
        "username": staff.username,
        "role": getattr(staff, "role", None),
    }
    return ChannelInfoResponse(
        name=name,
        avatar=avatar,
        channel_id=channel_id,
        channel_type=channel_type,
        entity_type="staff",
        extra=extra,
    )


@router.get(
    "/info",
    response_model=ChannelInfoResponse,
    responses={
        200: {
            "description": "Channel info response",
            "content": {
                "application/json": {
                    "examples": {
                        "Customer Service Channel - Visitor": {
                            "summary": "Customer Service Channel - Visitor",
                            "value": {
                                "name": "Jane Doe",
                                "avatar": "https://cdn.example.com/avatars/jane.png",
                                "channel_id": "AbC62xyz",
                                "channel_type": 251,
                                "entity_type": "visitor",
                                "extra": {
                                    "id": "550e8400-e29b-41d4-a716-446655440000",
                                    "platform_id": "00000000-0000-0000-0000-000000000001",
                                    "platform_type": "website",
                                    "name": "Jane Doe",
                                    "is_online": True
                                }
                            }
                        },
                        "Personal Channel - Staff": {
                            "summary": "Personal Channel - Staff",
                            "value": {
                                "name": "Alice Support",
                                "avatar": "https://cdn.example.com/avatars/alice.png",
                                "channel_id": "7b7d3d6e-8a7d-4a23-9a2f-1f1c9c7f8f00-staff",
                                "channel_type": 1,
                                "entity_type": "staff",
                                "extra": {
                                    "staff_id": "7b7d3d6e-8a7d-4a23-9a2f-1f1c9c7f8f00",
                                    "username": "support.alice",
                                    "role": "user"
                                }
                            }
                        },
                        "Personal Channel - Agent": {
                            "summary": "Personal Channel - Agent",
                            "value": {
                                "name": "Customer Support Agent",
                                "avatar": "",
                                "channel_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab-agent",
                                "channel_type": 1,
                                "entity_type": "agent",
                                "extra": {
                                    "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
                                    "name": "Customer Support Agent",
                                    "instruction": "You are a helpful customer support agent...",
                                    "model": "gpt-4",
                                    "is_default": True,
                                    "config": {"temperature": 0.7},
                                    "team_id": None,
                                    "tools": [],
                                    "collections": []
                                }
                            }
                        },
                        "Personal Channel - Team": {
                            "summary": "Personal Channel - Team",
                            "value": {
                                "name": "Customer Support Team",
                                "avatar": "",
                                "channel_id": "b2c3d4e5-6789-01ab-cdef-234567890abc-team",
                                "channel_type": 1,
                                "entity_type": "team",
                                "extra": {
                                    "id": "b2c3d4e5-6789-01ab-cdef-234567890abc",
                                    "name": "Customer Support Team",
                                    "instruction": "You are a customer support team...",
                                    "model": "gpt-4",
                                    "is_default": True,
                                    "agents": []
                                }
                            }
                        },
                        "Personal Channel - Visitor": {
                            "summary": "Personal Channel - Visitor",
                            "value": {
                                "name": "John Smith",
                                "avatar": "https://cdn.example.com/avatars/john.png",
                                "channel_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
                                "channel_type": 1,
                                "entity_type": "visitor",
                                "extra": {
                                    "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
                                    "platform_id": "00000000-0000-0000-0000-000000000002",
                                    "platform_type": "wechat",
                                    "name": "John Smith",
                                    "is_online": False
                                }
                            }
                        }
                    }
                }
            }
        }
    },
)
async def get_channel_info(
    request: Request,
    channel_id: str,
    channel_type: int,
    platform_api_key: Optional[str] = None,
    x_platform_api_key: Optional[str] = Header(None, alias="X-Platform-API-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
    user_language: UserLanguage = Depends(get_user_language),
) -> ChannelInfoResponse:
    """Retrieve channel information for a given channel_id and channel_type.

    Security:
    - JWT staff: access to channels within the same project (existing behavior)
    - Platform API key: only staff/agent personal channels (channel_type==1 and channel_id endswith '-staff' or '-agent'),
      and only within the same project as the platform
    """
    accept_language = request.headers.get("Accept-Language")

    # Determine authentication method
    current_user: Optional[Staff] = None
    platform: Optional[Platform] = None

    # Try JWT (staff)
    if credentials and credentials.credentials:
        payload = verify_token(credentials.credentials)
        if payload:
            username = payload.get("sub")
            if username:
                current_user = (
                    db.query(Staff)
                    .filter(Staff.username == username, Staff.deleted_at.is_(None))
                    .first()
                )

    # Try Platform API key if no staff user
    if current_user is None:
        api_key = platform_api_key or x_platform_api_key
        if api_key:
            platform = (
                db.query(Platform)
                .filter(Platform.api_key == api_key)
                .first()
            )
            if not platform:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid platform_api_key")
            if platform.deleted_at is not None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform is deleted")
            if platform.is_active is False:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform is disabled")
        else:
            # Neither JWT nor API key provided
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    # If authenticated via JWT (staff), keep existing behavior
    if current_user is not None:
        return await _handle_staff_auth_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            current_user=current_user,
            db=db,
            accept_language=accept_language,
            user_language=user_language,
        )

    # If authenticated via Platform API key, restrict to staff/agent personal channels
    if platform is not None:
        return await _handle_platform_auth_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            platform=platform,
            db=db,
            user_language=user_language,
        )

    # Unsupported or unauthorized
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported channel_type")


async def _handle_staff_auth_channel_info(
    channel_id: str,
    channel_type: int,
    current_user: Staff,
    db: Session,
    accept_language: Optional[str],
    user_language: UserLanguage = "en",
) -> ChannelInfoResponse:
    """Handle channel info request for JWT authenticated staff."""
    # CUSTOMER SERVICE CHANNEL (251): decode Base62 and extract visitor_id
    if channel_type == CHANNEL_TYPE_CUSTOMER_SERVICE:
        return await _get_customer_service_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            project_id=current_user.project_id,
            db=db,
            accept_language=accept_language,
            user_language=user_language,
        )

    # PERSONAL CHANNEL (1)
    if channel_type == 1:
        # Staff channel
        if channel_id.endswith(STAFF_SUFFIX):
            return _get_staff_channel_info(
                channel_id=channel_id,
                channel_type=channel_type,
                project_id=current_user.project_id,
                db=db,
            )

        # Agent channel
        if channel_id.endswith(AGENT_SUFFIX):
            return await _get_agent_channel_info(
                channel_id=channel_id,
                channel_type=channel_type,
                project_id=current_user.project_id,
            )

        # Team channel
        if channel_id.endswith(TEAM_SUFFIX):
            return await _get_team_channel_info(
                channel_id=channel_id,
                channel_type=channel_type,
                project_id=current_user.project_id,
            )

        # Visitor channel (no suffix)
        return _get_personal_visitor_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            project_id=current_user.project_id,
            db=db,
            accept_language=accept_language,
            user_language=user_language,
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported channel_type")


async def _handle_platform_auth_channel_info(
    channel_id: str,
    channel_type: int,
    platform: Platform,
    db: Session,
    user_language: UserLanguage = "en",
) -> ChannelInfoResponse:
    """Handle channel info request for Platform API key authentication."""
    # Only allow channel_type==1 and channel_id ending with '-staff', '-agent', or '-team'
    is_staff_channel = channel_type == 1 and channel_id.endswith(STAFF_SUFFIX)
    is_agent_channel = channel_type == 1 and channel_id.endswith(AGENT_SUFFIX)
    is_team_channel = channel_type == 1 and channel_id.endswith(TEAM_SUFFIX)

    if not (is_staff_channel or is_agent_channel or is_team_channel):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff, agent, and team personal channels are accessible with platform API key",
            )

    if is_staff_channel:
        staff_id_str = channel_id[:-len(STAFF_SUFFIX)]
        try:
            staff_uuid = UUID(staff_id_str)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid staff_id in channel")

        staff = (
            db.query(Staff)
            .filter(
                Staff.id == staff_uuid,
                Staff.deleted_at.is_(None),
            )
            .first()
        )
        if not staff:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")

        # Ensure staff belongs to the same project as the platform
        if staff.project_id != platform.project_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this channel")

        return _build_staff_channel_response(staff, channel_id, channel_type)

    # Agent channel
    if is_agent_channel:
        return await _get_agent_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            project_id=platform.project_id,
        )

    # Team channel
    if is_team_channel:
        return await _get_team_channel_info(
            channel_id=channel_id,
            channel_type=channel_type,
            project_id=platform.project_id,
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported channel type")


async def _get_customer_service_channel_info(
    channel_id: str,
    channel_type: int,
    project_id: UUID,
    db: Session,
    accept_language: Optional[str],
    user_language: UserLanguage = "en",
) -> ChannelInfoResponse:
    """Get channel info for customer service channel (type 251)."""
    try:
        visitor_uuid = parse_visitor_channel_id(channel_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid channel_id format")

    visitor = _get_visitor_with_relations(db, visitor_uuid, project_id)
    if not visitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found")

    visitor_payload = _build_enriched_visitor_payload(visitor, db, project_id, accept_language, user_language)
    set_visitor_display_nickname(visitor_payload, user_language)
    return _build_visitor_channel_response(visitor, visitor_payload, channel_id, channel_type, user_language)


def _get_staff_channel_info(
    channel_id: str,
    channel_type: int,
    project_id: UUID,
    db: Session,
) -> ChannelInfoResponse:
    """Get channel info for staff personal channel."""
    staff_id_str = channel_id[:-len(STAFF_SUFFIX)]
    try:
        staff_uuid = UUID(staff_id_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid staff_id in channel")

    staff = (
        db.query(Staff)
        .filter(
            Staff.id == staff_uuid,
            Staff.project_id == project_id,
            Staff.deleted_at.is_(None),
        )
        .first()
    )
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")

    return _build_staff_channel_response(staff, channel_id, channel_type)


async def _get_agent_channel_info(
    channel_id: str,
    channel_type: int,
    project_id: UUID,
) -> ChannelInfoResponse:
    """Get channel info for agent personal channel."""
    agent_id_str = channel_id[:-len(AGENT_SUFFIX)]
    try:
        agent_uuid = UUID(agent_id_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid agent_id in channel")

    # Fetch agent from AI service
    try:
        agent_data = await ai_client.get_agent(
            project_id=str(project_id),
            agent_id=str(agent_uuid),
            include_tools=True,
            include_collections=True,
        )
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        raise

    name = agent_data.get("name", "Unknown Agent")
    avatar = agent_data.get("avatar_url", "") or ""

    return ChannelInfoResponse(
        name=name,
        avatar=avatar,
        channel_id=channel_id,
        channel_type=channel_type,
        entity_type="agent",
        extra=agent_data,
    )


async def _get_team_channel_info(
    channel_id: str,
    channel_type: int,
    project_id: UUID,
) -> ChannelInfoResponse:
    """Get channel info for team personal channel."""
    team_id_str = channel_id[:-len(TEAM_SUFFIX)]
    try:
        team_uuid = UUID(team_id_str)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid team_id in channel")

    # Fetch team from AI service
    try:
        team_data = await ai_client.get_team(
            project_id=str(project_id),
            team_id=str(team_uuid),
            include_agents=True,
        )
    except HTTPException as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        raise

    name = team_data.get("name", "Unknown Team")
    avatar = ""  # Teams don't have avatars

    return ChannelInfoResponse(
        name=name,
        avatar=avatar,
        channel_id=channel_id,
        channel_type=channel_type,
        entity_type="team",
        extra=team_data,
    )


def _get_personal_visitor_channel_info(
    channel_id: str,
    channel_type: int,
    project_id: UUID,
    db: Session,
    accept_language: Optional[str],
    user_language: UserLanguage = "en",
) -> ChannelInfoResponse:
    """Get channel info for visitor personal channel (no suffix)."""
    try:
        visitor_uuid = UUID(channel_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid visitor_id in channel")

    visitor = _get_visitor_with_relations(db, visitor_uuid, project_id)
    if not visitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visitor not found")

    visitor_payload = _build_enriched_visitor_payload(visitor, db, project_id, accept_language, user_language)
    set_visitor_display_nickname(visitor_payload, user_language)
    return _build_visitor_channel_response(visitor, visitor_payload, channel_id, channel_type, user_language)
