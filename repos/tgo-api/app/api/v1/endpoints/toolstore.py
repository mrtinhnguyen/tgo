from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_active_user
from app.models.toolstore_credential import ToolStoreCredential
from app.models.staff import Staff
from app.schemas.toolstore import (
    ToolStoreCredential as ToolStoreCredentialSchema, 
    ToolStoreInstallRequest,
    ToolStoreBindRequest
)
from app.schemas.tools import ToolCreateRequest, ToolType, ToolSourceType
from app.utils.crypto import encrypt_str, decrypt_str
from app.services.toolstore_client import toolstore_client
from app.services.ai_client import ai_client

router = APIRouter()


@router.post("/bind", response_model=ToolStoreCredentialSchema)
async def bind_toolstore(
    bind_in: ToolStoreBindRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """
    绑定工具商店到当前项目
    1. 用 access_token 调用商店 /auth/api-key 获取 api_key
    2. 存储到 api_toolstore_credentials
    """
    project_id = current_user.project_id
    # 1. 调用商店获取 api_key
    try:
        result = await toolstore_client.get_api_key(bind_in.access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch API Key from ToolStore: {str(e)}"
        )

    # 2. 检查是否已存在凭证
    credential = db.scalar(
        select(ToolStoreCredential).where(ToolStoreCredential.project_id == project_id)
    )
    
    if credential:
        credential.toolstore_user_id = result["user_id"]
        credential.toolstore_email = result["email"]
        credential.api_key_encrypted = encrypt_str(result["api_key"])
    else:
        credential = ToolStoreCredential(
            project_id=project_id,
            toolstore_user_id=result["user_id"],
            toolstore_email=result["email"],
            api_key_encrypted=encrypt_str(result["api_key"]),
        )
        db.add(credential)
    
    db.commit()
    db.refresh(credential)
    return credential


@router.post("/install", response_model=Any)
async def install_from_toolstore(
    install_in: ToolStoreInstallRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """从工具商店安装工具到项目"""
    project_id = current_user.project_id
    # 1. 获取项目绑定的商店凭证
    credential = db.scalar(
        select(ToolStoreCredential).where(ToolStoreCredential.project_id == project_id)
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project not bound to ToolStore. Please bind credentials first."
        )
    
    api_key = decrypt_str(credential.api_key_encrypted)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt ToolStore API Key"
        )

    # 2. 调用商店 API 获取工具详情
    try:
        tool_detail = await toolstore_client.get_tool(install_in.tool_id, api_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch tool from ToolStore: {str(e)}"
        )

    # 3. 构造本地工具创建请求
    tool_create = ToolCreateRequest(
        name=tool_detail["name"],
        description=tool_detail.get("description_zh") or tool_detail.get("description"),
        tool_type=ToolType.MCP,
        transport_type="http",
        endpoint=f"{settings.TOOLSTORE_SERVICE_URL.rstrip('/')}/api/v1/mcp/{install_in.tool_id}",
        tool_source_type=ToolSourceType.TOOLSTORE,
        toolstore_tool_id=install_in.tool_id,
        config=tool_detail.get("config", {})
    )

    # 4. 在 tgo-ai 创建 ai_tools 记录
    try:
        tool_data_dict = tool_create.model_dump(exclude_none=True)
        tool_data_dict["project_id"] = str(project_id)
        
        result = await ai_client.create_tool(tool_data=tool_data_dict)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create tool in AI service: {str(e)}"
        )


@router.delete("/uninstall/{toolstore_tool_id}")
async def uninstall_from_toolstore(
    toolstore_tool_id: str,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_active_user),
) -> Any:
    """从本地项目卸载商店工具"""
    project_id = current_user.project_id
    # 1. 查找本地匹配的商店工具
    local_tools = await ai_client.list_tools(project_id=str(project_id))
    target_tool = next((t for t in local_tools if t.get("toolstore_tool_id") == toolstore_tool_id), None)
    
    if not target_tool:
        raise HTTPException(status_code=404, detail="Tool not found in this project")

    # 2. 调用商店 API 记录卸载
    credential = db.scalar(
        select(ToolStoreCredential).where(ToolStoreCredential.project_id == project_id)
    )
    if credential:
        api_key = decrypt_str(credential.api_key_encrypted)
        if api_key:
            try:
                await toolstore_client.uninstall_tool(toolstore_tool_id, api_key)
            except Exception:
                # 商店卸载失败不影响本地卸载
                pass

    # 3. 在 tgo-ai 删除 ai_tools 记录
    try:
        await ai_client.delete_tool(
            project_id=str(project_id),
            tool_id=target_tool["id"]
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tool in AI service: {str(e)}"
        )
