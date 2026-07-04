"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-07-04

Creates the initial tables:
  - projects
  - traces
  - evaluation_scores
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # projects
    # ------------------------------------------------------------------
    op.create_table(
        "projects",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_projects_name"),
    )

    # ------------------------------------------------------------------
    # traces
    # ------------------------------------------------------------------
    op.create_table(
        "traces",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("project_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_query", sa.Text, nullable=False),
        sa.Column("llm_prompt", sa.Text, nullable=True),
        sa.Column("llm_response", sa.Text, nullable=True),
        sa.Column("retrieved_contexts", JSONB, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("usage_metadata", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
            name="fk_traces_project_id",
        ),
    )
    op.create_index("ix_traces_project_id", "traces", ["project_id"])
    op.create_index("ix_traces_created_at", "traces", ["created_at"])

    # ------------------------------------------------------------------
    # evaluation_scores
    # ------------------------------------------------------------------
    op.create_table(
        "evaluation_scores",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("trace_id", UUID(as_uuid=True), nullable=False),
        sa.Column("metric_name", sa.String(100), nullable=False, index=True),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("reasoning", sa.Text, nullable=True),
        sa.Column("evaluator_model", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["trace_id"],
            ["traces.id"],
            ondelete="CASCADE",
            name="fk_evaluation_scores_trace_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("evaluation_scores")
    op.drop_index("ix_traces_created_at", table_name="traces")
    op.drop_index("ix_traces_project_id", table_name="traces")
    op.drop_table("traces")
    op.drop_table("projects")
