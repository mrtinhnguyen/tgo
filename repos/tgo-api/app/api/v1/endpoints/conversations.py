"""Conversation management endpoints for WuKongIM."""

from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import get_current_active_user, get_user_language, UserLanguage, require_permission
from app.models import Staff, StaffRole, Visitor, VisitorTag, VisitorWaitingQueue, WaitingStatus, VisitorSession, SessionStatus, VisitorServiceStatus
from app.schemas.base import PaginationMetadata
from app.schemas.wukongim import (
    ChannelInfo,
    WuKongIMChannelMessageSyncRequest,
    WuKongIMChannelMessageSyncResponse,
    WuKongIMConversation,
    WuKongIMConversationSyncRequest,
    WuKongIMConversationSyncResponse,
    WuKongIMConversationWithChannelsResponse,
    WuKongIMDeleteConversationRequest,
    WuKongIMSetUnreadRequest,
)
from app.schemas.visitor import VisitorResponse, resolve_visitor_display_name, set_visitor_display_nickname
from app.api.v1.endpoints.channels import _build_enriched_visitor_payload
from app.services.wukongim_client import wukongim_client
from app.utils.encoding import build_visitor_channel_id, parse_visitor_channel_id
from app.utils.const import CHANNEL_TYPE_CUSTOMER_SERVICE

logger = get_logger("api.conversations")
router = APIRouter()


async def _build_channels_for_conversations(
    db: Session,
    conversations: List[WuKongIMConversation],
    project_id: UUID,
    user_language: UserLanguage = "en",
    accept_language: Optional[str] = None,
) -> List[ChannelInfo]:
    """
    Build channel information list for conversations with batch query optimization.
    
    Args:
        db: Database session
        conversations: List of WuKongIM conversations
        project_id: Current project ID
        user_language: User language preference
        
    Returns:
        List of ChannelInfo for each conversation
    """
    if not conversations:
        return []
    
    # Extract visitor IDs from customer service channels (channel_type=251)
    visitor_ids: List[UUID] = []
    channel_id_to_visitor_id: Dict[str, UUID] = {}
    
    for conv in conversations:
        channel_type = conv.channel_type
        channel_id = conv.channel_id
        if channel_type == CHANNEL_TYPE_CUSTOMER_SERVICE and channel_id:
            try:
                visitor_id = parse_visitor_channel_id(channel_id)
                visitor_ids.append(visitor_id)
                channel_id_to_visitor_id[channel_id] = visitor_id
            except ValueError:
                # Invalid channel ID format, skip
                continue
    
    if not visitor_ids:
        return []
    
    # Batch query all visitors with relations (single query for performance)
    # Filter out visitors with CLOSED or QUEUED status
    visitors = (
        db.query(Visitor)
        .options(
            selectinload(Visitor.platform),
            selectinload(Visitor.visitor_tags).selectinload(VisitorTag.tag),
            selectinload(Visitor.ai_profile),
            selectinload(Visitor.ai_insight),
            selectinload(Visitor.system_info),
        )
        .filter(
            Visitor.id.in_(visitor_ids),
            Visitor.project_id == project_id,
            Visitor.deleted_at.is_(None),
            Visitor.service_status.notin_([
                VisitorServiceStatus.CLOSED.value,
                VisitorServiceStatus.QUEUED.value,
            ]),
        )
        .all()
    )
    
    # Create visitor lookup map
    visitor_map: Dict[UUID, Visitor] = {v.id: v for v in visitors}
    
    # Batch query open sessions for all visitors to get assigned_staff_id
    open_sessions = (
        db.query(VisitorSession)
        .filter(
            VisitorSession.visitor_id.in_(visitor_ids),
            VisitorSession.project_id == project_id,
            VisitorSession.status == SessionStatus.OPEN.value,
        )
        .all()
    )
    
    # Create session lookup map (visitor_id -> staff_id)
    visitor_to_staff: Dict[UUID, UUID] = {}
    for session in open_sessions:
        if session.staff_id:
            visitor_to_staff[session.visitor_id] = session.staff_id
    
    # Build channel info list
    channels: List[ChannelInfo] = []
    
    for conv in conversations:
        channel_type = conv.channel_type
        channel_id = conv.channel_id
        
        if channel_type != CHANNEL_TYPE_CUSTOMER_SERVICE:
            continue
            
        visitor_id = channel_id_to_visitor_id.get(channel_id)
        if not visitor_id:
            continue
            
        visitor = visitor_map.get(visitor_id)
        if not visitor:
            continue
        
        # Build visitor response with enriched data (keep consistent with get_channel_info)
        visitor_payload = _build_enriched_visitor_payload(
            visitor=visitor,
            db=db,
            project_id=project_id,
            accept_language=accept_language,
            user_language=user_language,
        )
        
        # Set display_nickname based on user language
        set_visitor_display_nickname(visitor_payload, user_language)
        
        # Add assigned_staff_id if exists
        assigned_staff_id = visitor_to_staff.get(visitor_id)
        extra_data = visitor_payload.model_dump()
        if assigned_staff_id:
            extra_data["assigned_staff_id"] = str(assigned_staff_id)
        
        # Resolve display name
        name = resolve_visitor_display_name(
            name=visitor.name,
            nickname=visitor.nickname,
            nickname_zh=visitor.nickname_zh,
            language=user_language,
            fallback="Unknown Visitor",
        )
        
        channel_info = ChannelInfo(
            name=name,
            avatar=visitor_payload.avatar_url or "",
            channel_id=channel_id,
            channel_type=channel_type,
            entity_type="visitor",
            extra=extra_data,
        )
        channels.append(channel_info)
    
    return channels


class WuKongIMConversationPaginatedResponse(BaseModel):
    """Paginated response for WuKongIM conversations."""
    
    conversations: List[WuKongIMConversation] = Field(
        default_factory=list,
        description="List of conversations"
    )
    pagination: PaginationMetadata = Field(..., description="Pagination metadata")


@router.post(
    "/my",
    response_model=WuKongIMConversationWithChannelsResponse,
    summary="同步我的会话列表",
    description="同步当前客服在 WuKongIM 中的所有会话列表（包含历史会话），包含最近消息和频道信息。",
)
async def sync_my_conversations(
    http_request: Request,
    request: WuKongIMConversationSyncRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
    user_language: UserLanguage = Depends(get_user_language),
) -> WuKongIMConversationWithChannelsResponse:
    """
    同步当前客服的会话列表。
    
    直接从 WuKongIM 获取当前客服参与的所有会话及其最近消息记录，
    包括已关闭的历史会话。同时返回每个会话对应的频道详细信息。
    """
    staff_uid = f"{current_user.id}-staff"

    logger.info(
        f"Staff {current_user.username} syncing my conversations",
        extra={
            "staff_username": current_user.username,
            "staff_uid": staff_uid,
            "msg_count": request.msg_count,
        }
    )

    try:
        conversations = await wukongim_client.sync_conversations(
            uid=staff_uid,
            last_msg_seqs=request.last_msg_seqs,
            msg_count=request.msg_count,
        )

        logger.info(f"Successfully synced {len(conversations)} conversations for staff {current_user.username}")

        # Build channels list with batch query for performance
        # This filters out visitors with CLOSED or QUEUED status
        channels = await _build_channels_for_conversations(
            db=db,
            conversations=conversations,
            project_id=current_user.project_id,
            user_language=user_language,
            accept_language=http_request.headers.get("Accept-Language"),
        )
        
        # Only filter visitor (customer service) conversations by valid channels.
        # Non-visitor conversations (e.g., personal/team/agent) should be kept.
        valid_channel_ids = {ch.channel_id for ch in channels}
        filtered_conversations = [
            conv
            for conv in conversations
            if conv.channel_type != CHANNEL_TYPE_CUSTOMER_SERVICE
            or (conv.channel_id in valid_channel_ids)
        ]

        return WuKongIMConversationWithChannelsResponse(
            conversations=filtered_conversations,
            channels=channels,
        )

    except Exception as e:
        logger.error(f"Failed to sync conversations for staff {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync conversations"
        )


@router.post(
    "/all",
    response_model=WuKongIMConversationPaginatedResponse,
    summary="获取所有服务过的访客会话",
    description="获取当前客服服务过的所有访客会话列表（基于 VisitorSession 表，包括已关闭的会话），支持分页。",
)
async def sync_all_conversations(
    msg_count: int = Query(default=20, ge=1, le=100, description="每个会话返回的最近消息数量"),
    limit: int = Query(default=20, ge=1, le=100, description="每页返回的会话数量"),
    offset: int = Query(default=0, ge=0, description="跳过的会话数量"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> WuKongIMConversationPaginatedResponse:
    """
    获取当前客服服务过的所有访客会话（支持分页）。
    
    查询 VisitorSession 表中 staff_id 为当前客服的所有会话（包括已关闭的），
    对访客进行去重后，从 WuKongIM 获取这些会话的最近消息。
    
    如果当前用户是 admin 角色，则返回项目下所有的会话。
    """
    # Check if current user is admin
    is_admin = current_user.role == StaffRole.ADMIN.value
    
    # 1. Query unique visitor_ids from sessions
    # Admin sees all sessions in the project, others see only their own
    # Only include sessions with assigned staff (staff_id is not null)
    base_query = db.query(VisitorSession.visitor_id).filter(
        VisitorSession.visitor_id.isnot(None),
        VisitorSession.staff_id.isnot(None),
    )
    
    if is_admin:
        # Admin: filter by project_id
        base_query = base_query.filter(VisitorSession.project_id == current_user.project_id)
    else:
        # Non-admin: filter by staff_id
        base_query = base_query.filter(VisitorSession.staff_id == current_user.id)
    
    unique_visitors_query = base_query.distinct()
    
    # Get total count of unique visitors
    total_count = unique_visitors_query.count()
    
    if total_count == 0:
        logger.debug(f"No sessions found for staff {current_user.username}")
        return WuKongIMConversationPaginatedResponse(
            conversations=[],
            pagination=PaginationMetadata(
                total=0,
                limit=limit,
                offset=offset,
                has_next=False,
                has_prev=False,
            )
        )
    
    # 2. Get paginated unique visitor_ids (ordered by latest session created time)
    # Subquery to get the latest created_at for each visitor_id
    subquery_base = db.query(
        VisitorSession.visitor_id,
        func.max(VisitorSession.created_at).label("latest_created_at")
    ).filter(
        VisitorSession.visitor_id.isnot(None),
        VisitorSession.staff_id.isnot(None),
    )
    
    if is_admin:
        subquery_base = subquery_base.filter(VisitorSession.project_id == current_user.project_id)
    else:
        subquery_base = subquery_base.filter(VisitorSession.staff_id == current_user.id)
    
    latest_session_subquery = subquery_base.group_by(VisitorSession.visitor_id).subquery()
    
    # Get paginated visitor_ids ordered by latest session created time (newest first)
    paginated_visitor_ids = (
        db.query(latest_session_subquery.c.visitor_id)
        .order_by(latest_session_subquery.c.latest_created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    visitor_ids = [row[0] for row in paginated_visitor_ids]
    
    if not visitor_ids:
        logger.debug("No valid visitor IDs found after pagination")
        return WuKongIMConversationPaginatedResponse(
            conversations=[],
            pagination=PaginationMetadata(
                total=total_count,
                limit=limit,
                offset=offset,
                has_next=False,
                has_prev=offset > 0,
            )
        )
    
    # 3. Build channel list for WuKongIM
    channels: List[dict] = []
    for visitor_id in visitor_ids:
        channel_id = build_visitor_channel_id(visitor_id)
        channels.append({
            "channel_id": channel_id,
            "channel_type": CHANNEL_TYPE_CUSTOMER_SERVICE,
        })
    
    logger.info(
        f"Fetching {'all project' if is_admin else 'staff'} conversations for {len(channels)} visitors (page offset={offset}, limit={limit})",
        extra={
            "staff_id": str(current_user.id),
            "staff_username": current_user.username,
            "is_admin": is_admin,
            "total_unique_visitors": total_count,
            "page_visitor_count": len(channels),
            "msg_count": msg_count,
            "offset": offset,
            "limit": limit,
        }
    )
    
    # 4. Call WuKongIM to sync conversations by channels
    staff_uid = f"{current_user.id}-staff"
    
    try:
        raw_conversations = await wukongim_client.sync_conversations_by_channels(
            uid=staff_uid,
            channels=channels,
            msg_count=msg_count,
        )
        
        # 5. Reset unread to 0 for all conversations
        conversations = [
            conv.model_copy(update={"unread": 0}) for conv in raw_conversations
        ]
        
        logger.info(
            f"Successfully fetched {len(conversations)} conversations for staff {current_user.username}",
            extra={
                "staff_id": str(current_user.id),
                "conversation_count": len(conversations),
            }
        )
        
        # 6. Build pagination metadata
        has_next = (offset + limit) < total_count
        has_prev = offset > 0
        
        return WuKongIMConversationPaginatedResponse(
            conversations=conversations,
            pagination=PaginationMetadata(
                total=total_count,
                limit=limit,
                offset=offset,
                has_next=has_next,
                has_prev=has_prev,
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch conversations for staff {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations",
        )


@router.post(
    "/waiting",
    response_model=WuKongIMConversationPaginatedResponse,
    summary="获取等待中访客的会话",
    description="获取所有等待中（未分配）访客的 WuKongIM 会话列表，用于客服查看待接入访客的对话内容，支持分页。",
)
async def sync_waiting_conversations(
    msg_count: int = Query(default=20, ge=1, le=100, description="每个会话返回的最近消息数量"),
    limit: int = Query(default=20, ge=1, le=100, description="每页返回的会话数量"),
    offset: int = Query(default=0, ge=0, description="跳过的会话数量"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(require_permission("visitors:read")),
) -> WuKongIMConversationPaginatedResponse:
    """
    获取等待中访客的会话列表（支持分页）。
    
    此接口获取当前项目中所有状态为 WAITING 的访客的 WuKongIM 会话信息，
    包括最近的消息记录。用于客服人员查看待接入访客的对话内容。
    """
    # 1. Get total count of waiting entries
    total_count = (
        db.query(VisitorWaitingQueue)
        .filter(
            VisitorWaitingQueue.project_id == current_user.project_id,
            VisitorWaitingQueue.status == WaitingStatus.WAITING.value,
            VisitorWaitingQueue.visitor_id.isnot(None),
        )
        .count()
    )
    
    if total_count == 0:
        logger.debug("No waiting visitors found")
        return WuKongIMConversationPaginatedResponse(
            conversations=[],
            pagination=PaginationMetadata(
                total=0,
                limit=limit,
                offset=offset,
                has_next=False,
                has_prev=False,
            )
        )
    
    # 2. Query paginated waiting visitors from queue (ordered by created_at desc, newest first)
    waiting_entries = (
        db.query(VisitorWaitingQueue)
        .filter(
            VisitorWaitingQueue.project_id == current_user.project_id,
            VisitorWaitingQueue.status == WaitingStatus.WAITING.value,
            VisitorWaitingQueue.visitor_id.isnot(None),
        )
        .order_by(VisitorWaitingQueue.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    if not waiting_entries:
        logger.debug("No waiting visitors found after pagination")
        return WuKongIMConversationPaginatedResponse(
            conversations=[],
            pagination=PaginationMetadata(
                total=total_count,
                limit=limit,
                offset=offset,
                has_next=False,
                has_prev=offset > 0,
            )
        )
    
    # 3. Build channel list for WuKongIM
    channels: List[dict] = []
    for entry in waiting_entries:
        channel_id = build_visitor_channel_id(entry.visitor_id)
        channels.append({
            "channel_id": channel_id,
            "channel_type": CHANNEL_TYPE_CUSTOMER_SERVICE,
        })
    
    logger.info(
        f"Fetching conversations for {len(channels)} waiting visitors (page offset={offset}, limit={limit})",
        extra={
            "staff_id": str(current_user.id),
            "total_waiting": total_count,
            "page_count": len(channels),
            "msg_count": msg_count,
            "offset": offset,
            "limit": limit,
        }
    )
    
    # 4. Call WuKongIM to sync conversations by channels
    staff_uid = f"{current_user.id}-staff"
    
    try:
        raw_conversations = await wukongim_client.sync_conversations_by_channels(
            uid=staff_uid,
            channels=channels,
            msg_count=msg_count,
        )
        
        # 5. Reset unread to 0 for all conversations
        conversations = [
            conv.model_copy(update={"unread": 0}) for conv in raw_conversations
        ]
        
        logger.info(
            f"Successfully fetched {len(conversations)} conversations for waiting visitors",
            extra={
                "staff_id": str(current_user.id),
                "conversation_count": len(conversations),
            }
        )
        
        # 6. Build pagination metadata
        has_next = (offset + limit) < total_count
        has_prev = offset > 0
        
        return WuKongIMConversationPaginatedResponse(
            conversations=conversations,
            pagination=PaginationMetadata(
                total=total_count,
                limit=limit,
                offset=offset,
                has_next=has_next,
                has_prev=has_prev,
            )
        )
        
    except Exception as e:
        logger.error(f"Failed to fetch waiting visitors conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch waiting visitors conversations",
        )


@router.put(
    "/unread",
    summary="设置会话未读数",
    description="设置指定会话的未读消息数量。",
)
async def set_conversation_unread(
    request: WuKongIMSetUnreadRequest,
    current_user: Staff = Depends(get_current_active_user),
) -> Dict[str, str]:
    """设置会话的未读消息数量。"""
    staff_uid = f"{current_user.id}-staff"

    logger.info(
        f"Staff {current_user.username} setting unread count for conversation",
        extra={
            "staff_username": current_user.username,
            "staff_uid": staff_uid,
            "channel_id": request.channel_id,
            "channel_type": request.channel_type,
            "unread": request.unread,
        }
    )

    try:
        await wukongim_client.set_conversation_unread(
            uid=staff_uid,
            channel_id=request.channel_id,
            channel_type=request.channel_type,
            unread=request.unread,
        )

        logger.info(f"Successfully set unread count for staff {current_user.username}")

        return {"message": "Unread count updated successfully"}

    except Exception as e:
        logger.error(f"Failed to set unread count for staff {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set unread count"
        )


@router.delete(
    "",
    summary="删除会话",
    description="从会话列表中删除指定的会话。",
)
async def delete_conversation(
    request: WuKongIMDeleteConversationRequest,
    current_user: Staff = Depends(get_current_active_user),
) -> Dict[str, str]:
    """从会话列表中删除指定的会话。"""
    staff_uid = f"{current_user.id}-staff"

    logger.info(
        f"Staff {current_user.username} deleting conversation",
        extra={
            "staff_username": current_user.username,
            "staff_uid": staff_uid,
            "channel_id": request.channel_id,
            "channel_type": request.channel_type,
        }
    )

    try:
        await wukongim_client.delete_conversation(
            uid=staff_uid,
            channel_id=request.channel_id,
            channel_type=request.channel_type,
        )

        logger.info(f"Successfully deleted conversation for staff {current_user.username}")

        return {"message": "Conversation deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete conversation for staff {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete conversation"
        )


@router.post(
    "/messages",
    response_model=WuKongIMChannelMessageSyncResponse,
    summary="同步频道消息",
    description="同步指定频道的历史消息记录。",
)
async def sync_channel_messages(
    request: WuKongIMChannelMessageSyncRequest,
    current_user: Staff = Depends(get_current_active_user),
) -> WuKongIMChannelMessageSyncResponse:
    """同步指定频道的历史消息记录。"""
    staff_uid = f"{current_user.id}-staff"

    logger.info(
        f"Staff {current_user.username} syncing channel messages",
        extra={
            "staff_username": current_user.username,
            "staff_uid": staff_uid,
            "channel_id": request.channel_id,
            "channel_type": request.channel_type,
            "start_message_seq": request.start_message_seq,
            "end_message_seq": request.end_message_seq,
            "limit": request.limit,
            "pull_mode": request.pull_mode,
        }
    )

    try:
        result = await wukongim_client.sync_channel_messages(
            login_uid=staff_uid,
            channel_id=request.channel_id,
            channel_type=request.channel_type,
            start_message_seq=request.start_message_seq,
            end_message_seq=request.end_message_seq,
            limit=request.limit,
            pull_mode=request.pull_mode,
        )

        message_count = len(result.messages)
        logger.info(f"Successfully synced {message_count} channel messages for staff {current_user.username}")

        return result

    except Exception as e:
        logger.error(f"Failed to sync channel messages for staff {current_user.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync channel messages"
        )
