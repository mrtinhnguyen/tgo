"""Schemas for agent runtime execution requests and responses."""

import uuid
from typing import List, Literal, Optional

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


class SupervisorConfig(BaseSchema):
    """Configuration options for supervisor execution."""

    execution_strategy: Literal["single", "multiple", "auto"] = Field(
        default="auto",
        description="Strategy for agent selection and execution",
    )
    max_agents: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum number of agents to execute",
    )
    timeout: int = Field(
        default=30,
        ge=5,
        le=300,
        description="Timeout for agent execution in seconds",
    )
    require_consensus: bool = Field(
        default=False,
        description="Whether to require consensus among multiple agents",
    )

    model_config = ConfigDict(extra="forbid")


class SupervisorRunRequest(BaseSchema):
    """Request payload for the supervisor agent /run endpoint."""

    team_id: Optional[str] = Field(
        default=None,
        description="UUID of the team to coordinate agents from (defaults to the project's default team if omitted)",
    )
    agent_id: Optional[str] = Field(
        default=None,
        description="UUID of a specific agent to use. If set, the team will only contain this agent",
    )
    message: str = Field(
        description="User message to be processed by the agents",
        min_length=1,
        max_length=10_000,
    )
    system_message: Optional[str] = Field(
        default=None,
        description="Optional custom system message to append to the team's system instructions for this run",
    )

    expected_output: Optional[str] = Field(
        default=None,
        description="Optional expected output format that guides the team response for this run",
    )

    session_id: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Session ID for conversation tracking",
    )
    user_id: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User ID for authentication and token management",
    )
    config: Optional[SupervisorConfig] = Field(
        default=None,
        description="Configuration options for supervisor execution",
    )
    stream: bool = Field(
        default=False,
        description="Enable streaming response with real-time events",
    )
    mcp_url: Optional[str] = Field(
        default=None,
        description="URL of the MCP server for tool integration",
    )
    rag_url: Optional[str] = Field(
        default=None,
        description="URL of the RAG server for retrieval-augmented generation",
    )
    enable_memory: bool = Field(
        default=False,
        description="Enable conversational memory for participating agents",
    )

    model_config = ConfigDict(extra="forbid")


class AgentExecutionResult(BaseSchema):
    """Result from a single agent execution."""

    agent_id: uuid.UUID = Field(description="UUID of the executed agent")
    agent_name: str = Field(description="Name of the executed agent")
    question: str = Field(description="Question asked to the agent")
    content: str = Field(description="Agent's response content")
    tools_used: Optional[List[str]] = Field(
        default=None,
        description="List of tools used by the agent",
    )
    execution_time: float = Field(
        description="Execution time in seconds",
        ge=0,
    )
    success: bool = Field(
        default=True,
        description="Whether execution was successful",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if execution failed",
    )

    model_config = ConfigDict(extra="allow")


class SupervisorMetadata(BaseSchema):
    """Metadata about the supervisor execution."""

    total_execution_time: float = Field(
        description="Total execution time in seconds",
        ge=0,
    )
    agents_consulted: int = Field(
        description="Number of agents that were consulted",
        ge=0,
    )
    strategy_used: str = Field(
        description="Execution strategy that was applied",
    )
    team_id: uuid.UUID = Field(description="Team ID used for coordination")
    consensus_achieved: Optional[bool] = Field(
        default=None,
        description="Whether consensus was achieved (if applicable)",
    )

    model_config = ConfigDict(extra="allow")


class SupervisorRunResponse(BaseSchema):
    """Non-streaming response payload from the supervisor agent /run endpoint."""

    success: bool = Field(
        default=True,
        description="Whether the request was successful",
    )
    message: str = Field(description="Human-readable status message")
    results: Optional[List[AgentExecutionResult]] = Field(
        default=None,
        description="Results from individual agent executions",
    )
    content: str = Field(description="Consolidated response from all agents")
    metadata: SupervisorMetadata = Field(
        description="Metadata about the execution",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if success is false",
    )

    model_config = ConfigDict(extra="allow")
