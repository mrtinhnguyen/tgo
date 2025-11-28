"""Add default_team_id to api_projects table.

Revision ID: api_0002_add_default_team_id
Revises: api_0001_baseline
Create Date: 2025-01-27

This migration adds the default_team_id field to the api_projects table
for storing the default AI team ID from the AI service.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "api_0002_add_default_team_id"
down_revision = "api_0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add default_team_id column to api_projects table.

    Uses conditional check to avoid conflicts with dynamic baseline
    that may have already created the column from current models.
    """
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("api_projects")]

    if "default_team_id" not in columns:
        op.add_column(
            "api_projects",
            sa.Column(
                "default_team_id",
                sa.String(64),
                nullable=True,
                comment="Default AI team ID from AI service",
            ),
        )


def downgrade() -> None:
    """Remove default_team_id column from api_projects table."""
    op.drop_column("api_projects", "default_team_id")

