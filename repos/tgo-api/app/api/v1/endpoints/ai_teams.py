"""AI Teams proxy endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException

from app.api.common_responses import CREATE_RESPONSES, CRUD_RESPONSES, LIST_RESPONSES, UPDATE_RESPONSES
from app.core.logging import get_logger
from app.core.security import get_authenticated_project
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.schemas.ai import (
    TeamCreateRequest,
    TeamListResponse,
    TeamResponse,
    TeamUpdateRequest,
    TeamWithDetailsResponse,
)
from app.models.ai_provider import AIProvider
from app.services.ai_client import ai_client

logger = get_logger("endpoints.ai_teams")
router = APIRouter()


@router.get(
    "/default",
    response_model=TeamWithDetailsResponse,
    responses=CRUD_RESPONSES,
    summary="Get Default Team",
    description="""
    Get the default team for the authenticated project.
    
    Returns the team marked as default for this project, including associated agents
    with their tools and collections. Returns 404 if no default team is configured.
    """,
)
async def get_default_team(
    include_agents: bool = Query(
        True, description="Include associated agents with tools and collections in the response"
    ),
    project_and_api_key=Depends(get_authenticated_project),
) -> TeamWithDetailsResponse:
    """Get default team for current project."""
    project, _ = project_and_api_key

    # Check if project has a default team configured
    if not project.default_team_id:
        raise HTTPException(
            status_code=404,
            detail="No default team configured for this project"
        )

    logger.info(
        "Getting default AI team",
        extra={
            "project_id": str(project.id),
            "team_id": project.default_team_id,
            "include_agents": include_agents,
        }
    )

    # Get team details directly using the stored default_team_id
    result = await ai_client.get_team(
        project_id=str(project.id),
        team_id=project.default_team_id,
        include_agents=include_agents,
    )

    return TeamWithDetailsResponse.model_validate(result)


@router.get(
    "",
    response_model=TeamListResponse,
    responses=LIST_RESPONSES,
    summary="List Teams",
    description="""
    List teams for the authenticated project with filtering and pagination.
    
    Teams are used to organize AI agents and define shared configurations like LLM models
    and system instructions. All results are automatically scoped to the authenticated project.
    """,
)
async def list_teams(
    is_default: Optional[bool] = Query(
        None, description="Filter by default team status"
    ),
    limit: int = Query(
        20, ge=1, le=100, description="Number of teams to return"
    ),
    offset: int = Query(
        0, ge=0, description="Number of teams to skip"
    ),
    project_and_api_key = Depends(get_authenticated_project),
) -> TeamListResponse:
    """List teams from AI service."""
    project, _ = project_and_api_key
    logger.info(
        "Listing AI teams",
        extra={
            "is_default": is_default,
            "limit": limit,
            "offset": offset,
        }
    )

    result = await ai_client.list_teams(
        project_id=str(project.id),
        is_default=is_default,
        limit=limit,
        offset=offset,
    )

    return TeamListResponse.model_validate(result)


@router.post(
    "",
    response_model=TeamResponse,
    responses=CREATE_RESPONSES,
    status_code=201,
    summary="Create Team",
    description="""
    Create a new team within the authenticated project for organizing AI agents.
    
    Teams define shared configurations like LLM models, system instructions, and expected output formats.
    Only one default team is allowed per project. Team is automatically scoped to the authenticated project.
    """,
)
async def create_team(
    team_data: TeamCreateRequest,
    project_and_api_key = Depends(get_authenticated_project),
    db: Session = Depends(get_db),
) -> TeamResponse:
    """Create team in AI service."""
    project, project_api_key = project_and_api_key
    logger.info(
        "Creating AI team",
        extra={
            "team_name": team_data.name,
            "model": team_data.model,
            "is_default": team_data.is_default,
        }
    )

    payload = team_data.model_dump(exclude_none=True)
    # Normalize model to pure name (strip provider prefix if present)
    model_val = payload.get("model")
    if isinstance(model_val, str) and ":" in model_val:
        payload["model"] = model_val.split(":", 1)[1]

    # Map ai_provider_id -> llm_provider_id and validate ownership
    ai_provider_id = payload.pop("ai_provider_id", None)
    if ai_provider_id is not None:
        provider = db.query(AIProvider).filter(
            AIProvider.id == ai_provider_id,
            AIProvider.project_id == project.id,
            AIProvider.deleted_at.is_(None),
        ).first()
        if not provider:
            raise HTTPException(status_code=404, detail="AIProvider not found for current project")
        payload["llm_provider_id"] = str(ai_provider_id)

    result = await ai_client.create_team(
        project_id=str(project.id),
        team_data=payload,
    )

    return TeamResponse.model_validate(result)


@router.get(
    "/{team_id}",
    response_model=TeamWithDetailsResponse,
    responses=CRUD_RESPONSES,
    summary="Get Team",
    description="""
    Retrieve detailed information about a specific team including associated agents
    with their tools and collections. Team must belong to the authenticated project.
    """,
)
async def get_team(
    team_id: UUID,
    include_agents: bool = Query(
        True, description="Include associated agents with tools and collections in the response"
    ),
    project_and_api_key = Depends(get_authenticated_project),
) -> TeamWithDetailsResponse:
    """Get team from AI service."""
    project, _ = project_and_api_key
    logger.info(
        "Getting AI team",
        extra={
            "team_id": str(team_id),
            "include_agents": include_agents,
        }
    )

    result = await ai_client.get_team(
        project_id=str(project.id),
        team_id=str(team_id),
        include_agents=include_agents,
    )

    return TeamWithDetailsResponse.model_validate(result)


@router.patch(
    "/{team_id}",
    response_model=TeamResponse,
    responses=UPDATE_RESPONSES,
    summary="Update Team",
    description="""
    Update team configuration, instructions, model, or settings.
    
    Setting is_default=true will unset other default teams as only one default team
    is allowed per project. Team must belong to the authenticated project.
    """,
)
async def update_team(
    team_id: UUID,
    team_data: TeamUpdateRequest,
    project_and_api_key = Depends(get_authenticated_project),
    db: Session = Depends(get_db),
) -> TeamResponse:
    """Update team in AI service."""
    project, project_api_key = project_and_api_key
    logger.info(
        "Updating AI team",
        extra={
            "team_id": str(team_id),
            "team_name": team_data.name,
            "model": team_data.model,
            "is_default": team_data.is_default,
        }
    )

    payload = team_data.model_dump(exclude_none=True)

    # Map ai_provider_id -> llm_provider_id and validate ownership
    ai_provider_id = payload.pop("ai_provider_id", None)
    if ai_provider_id is not None:
        provider = db.query(AIProvider).filter(
            AIProvider.id == ai_provider_id,
            AIProvider.project_id == project.id,
            AIProvider.deleted_at.is_(None),
        ).first()
        if not provider:
            raise HTTPException(status_code=404, detail="AIProvider not found for current project")
        payload["llm_provider_id"] = str(ai_provider_id)

    result = await ai_client.update_team(
        project_id=str(project.id),
        team_id=str(team_id),
        team_data=payload,
    )

    return TeamResponse.model_validate(result)


@router.delete(
    "/{team_id}",
    responses=CRUD_RESPONSES,
    status_code=204,
    summary="Delete Team",
    description="""
    Soft delete a team by its UUID. Associated agents will have their team_id set to null
    but will remain active. Team must belong to the authenticated project.
    """,
)
async def delete_team(
    team_id: UUID,
    project_and_api_key = Depends(get_authenticated_project),
) -> None:
    """Delete team from AI service."""
    project, _ = project_and_api_key
    logger.info(
        "Deleting AI team",
        extra={"team_id": str(team_id)}
    )

    await ai_client.delete_team(
        project_id=str(project.id),
        team_id=str(team_id),
    )
