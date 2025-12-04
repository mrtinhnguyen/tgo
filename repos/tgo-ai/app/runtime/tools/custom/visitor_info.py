"""Team-level tool to collect and update visitor information."""

from __future__ import annotations

from typing import Any, Optional

from agno.tools import Function

from .base import EventClient, ToolContext

# Fields that can be updated for visitor info
VISITOR_INFO_FIELDS = (
    "email", "wechat", "phone", "name", "sex",
    "age", "company", "position", "address", "birthday",
)


def create_visitor_info_tool(
    *,
    team_id: str,
    session_id: str | None,
    user_id: str | None,
    project_id: str | None = None,
) -> Function:
    """Create a team-level tool that updates visitor info."""
    ctx = ToolContext(team_id, session_id, user_id, project_id)
    client = EventClient(ctx)

    error_messages = {
        "not_configured": "抱歉，当前无法为您更新访客资料，我们已记录该问题并会尽快处理。请稍后再试或直接联系客服。",
        "api_error": "抱歉，访客资料更新未能成功提交。请稍后重试或联系技术支持。",
        "http_error": "抱歉，网络异常导致访客资料更新未能提交。请稍后重试或联系技术支持。",
        "unexpected_error": "抱歉，出现异常，暂时无法为您更新访客资料。请稍后重试或联系技术支持。",
    }

    async def update_visitor_info(
        *,
        email: Optional[str] = None,
        wechat: Optional[str] = None,
        phone: Optional[str] = None,
        name: Optional[str] = None,
        sex: Optional[str] = None,
        age: Optional[str] = None,
        company: Optional[str] = None,
        position: Optional[str] = None,
        address: Optional[str] = None,
        birthday: Optional[str] = None,
        extra_info: Optional[dict[str, Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """Update visitor information via visitor_info.update event."""
        # Collect provided fields
        local_vars = locals()
        provided = {k: local_vars[k] for k in VISITOR_INFO_FIELDS if local_vars.get(k) not in (None, "")}

        if not provided:
            return "请至少提供一个需要更新的访客信息字段，例如邮箱、电话、微信、姓名等。"

        # Build visitor data
        visitor_data = dict(provided)
        if extra_info:
            visitor_data["extra_info"] = extra_info

        result = await client.post_event(
            "visitor_info.update",
            {"visitor": visitor_data, "metadata": metadata},
            error_messages=error_messages,
        )

        if not result.success:
            return result.message

        updated_keys = ", ".join(provided.keys())
        return f"已提交访客信息更新：{updated_keys}。感谢配合！"

    return Function(
        name="update_visitor_info",
        description=(
            "当访客提供联系方式或个人信息时，调用此工具以记录或更新访客资料。"
            "可收集的信息包括：邮箱、微信、电话、姓名、性别、公司、职位、地址、生日、备注等；"
            "所有字段均为可选，支持部分更新。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "邮箱（可选）"},
                "wechat": {"type": "string", "description": "微信号（可选）"},
                "phone": {"type": "string", "description": "手机号（可选）"},
                "name": {"type": "string", "description": "姓名（可选）"},
                "sex": {"type": "string", "description": "性别（可选）"},
                "age": {"type": "string", "description": "年龄（可选）"},
                "company": {"type": "string", "description": "公司（可选）"},
                "position": {"type": "string", "description": "职位（可选）"},
                "address": {"type": "string", "description": "地址（可选）"},
                "birthday": {"type": "string", "description": "生日（可选）"},
                "extra_info": {"type": "object", "description": "扩展信息：存储其他未预定义的访客信息，如 Telegram、偏好等（可选）"},
                "metadata": {"type": "object", "description": "其他上下文字段（可选）"},
            },
            "required": [],
        },
        entrypoint=update_visitor_info,
        skip_entrypoint_processing=True,
    )
