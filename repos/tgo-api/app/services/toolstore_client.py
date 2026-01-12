import httpx
from typing import Any, Dict, Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("toolstore_client")

class ToolStoreClient:
    """Client for interacting with the ToolStore API."""

    def __init__(self):
        self.base_url = f"{settings.TOOLSTORE_SERVICE_URL.rstrip('/')}/api/v1"
        self.timeout = settings.TOOLSTORE_TIMEOUT

    async def get_tool(self, tool_id: str, api_key: str) -> Dict[str, Any]:
        """Fetch tool details from ToolStore."""
        url = f"{self.base_url}/tools/{tool_id}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    url,
                    headers={"X-API-Key": api_key}
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"ToolStore API error: {e.response.status_code} {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"ToolStore connection error: {str(e)}")
                raise

    async def install_tool(self, tool_id: str, api_key: str) -> Dict[str, Any]:
        """Mark tool as installed in ToolStore."""
        url = f"{self.base_url}/tools/{tool_id}/install"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    url,
                    headers={"X-API-Key": api_key}
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"ToolStore API error: {e.response.status_code} {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"ToolStore connection error: {str(e)}")
                raise

    async def uninstall_tool(self, tool_id: str, api_key: str) -> Dict[str, Any]:
        """Mark tool as uninstalled in ToolStore."""
        url = f"{self.base_url}/tools/{tool_id}/uninstall"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.request(
                    "DELETE",
                    url,
                    headers={"X-API-Key": api_key}
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"ToolStore API error: {e.response.status_code} {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"ToolStore connection error: {str(e)}")
                raise

    async def get_api_key(self, access_token: str) -> Dict[str, Any]:
        """Fetch user's API key from ToolStore using access token."""
        url = f"{self.base_url}/auth/api-key"
        print(f"Getting API key from {url}")
        print(f"Access token: {access_token}")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"ToolStore API error: {e.response.status_code} {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"ToolStore connection error: {str(e)}")
                raise

toolstore_client = ToolStoreClient()
