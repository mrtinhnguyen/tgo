"""Tool schemas for AI service integration."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class ToolType(str, Enum):
    """Tool type enumeration."""
    MCP = "MCP"
    FUNCTION = "FUNCTION"
    ALL = "ALL"


class ToolSourceType(str, Enum):
    """Tool source type enumeration."""
    LOCAL = "LOCAL"
    TOOLSTORE = "TOOLSTORE"


class ToolCreateRequest(BaseSchema):
    """Schema for creating a tool."""

    name: str = Field(..., description="Tool name")
    description: Optional[str] = Field(None, description="Optional tool description")
    tool_type: ToolType = Field(..., description="Tool type (MCP | FUNCTION)")
    transport_type: Optional[str] = Field(None, description="Transport type (e.g., http, stdio, sse)")
    endpoint: Optional[str] = Field(None, description="Endpoint URL or path")
    tool_source_type: ToolSourceType = Field(ToolSourceType.LOCAL, description="Tool source (LOCAL or TOOLSTORE)")
    toolstore_tool_id: Optional[str] = Field(None, description="Associated ToolStore tool ID")
    config: Optional[Dict[str, Any]] = Field(None, description="Tool configuration JSON object")


class ToolUpdateRequest(BaseSchema):
    """Schema for updating an existing tool."""

    name: Optional[str] = Field(None, description="Updated tool name")
    description: Optional[str] = Field(None, description="Updated tool description")
    tool_type: Optional[ToolType] = Field(None, description="Updated tool type (MCP | FUNCTION)")
    transport_type: Optional[str] = Field(None, description="Updated transport type (e.g., http, stdio, sse)")
    endpoint: Optional[str] = Field(None, description="Updated endpoint URL or path")
    config: Optional[Dict[str, Any]] = Field(None, description="Updated tool configuration JSON object")


class ToolResponse(BaseSchema):
    """Schema for Tool API responses."""
    
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: datetime = Field(..., description="Record last update timestamp")
    deleted_at: Optional[datetime] = Field(None, description="Soft delete timestamp")
    id: UUID = Field(..., description="Unique identifier")
    project_id: UUID = Field(..., description="Project ID that owns the tool")
    name: str = Field(..., description="Tool name")
    description: Optional[str] = Field(None, description="Optional tool description")
    tool_type: ToolType = Field(..., description="Tool type (MCP | FUNCTION)")
    transport_type: Optional[str] = Field(None, description="Transport type (e.g., http, stdio, sse)")
    endpoint: Optional[str] = Field(None, description="Endpoint URL or path")
    tool_source_type: ToolSourceType = Field(ToolSourceType.LOCAL, description="Tool source (LOCAL or TOOLSTORE)")
    toolstore_tool_id: Optional[str] = Field(None, description="Associated ToolStore tool ID")
    config: Optional[Dict[str, Any]] = Field(None, description="Tool configuration JSON object")

