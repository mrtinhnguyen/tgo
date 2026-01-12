from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import Field, ConfigDict
from app.schemas.base import BaseSchema

class ToolStoreCredentialBase(BaseSchema):
    toolstore_user_id: str
    toolstore_email: str

class ToolStoreCredentialBind(ToolStoreCredentialBase):
    api_key: str
    refresh_token: Optional[str] = None

class ToolStoreCredential(ToolStoreCredentialBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime

class ToolStoreInstallRequest(BaseSchema):
    tool_id: str

class ToolStoreInstallResponse(BaseSchema):
    id: UUID
    name: str
    status: str

class ToolStoreBindRequest(BaseSchema):
    access_token: str
