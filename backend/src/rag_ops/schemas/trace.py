"""
Trace and EvaluationScore models.

Trace:
    Stores one complete LLM interaction.

EvaluationScore:
    Stores evaluation metrics for a trace.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    ForeignKey,
    Text,
    Integer,
    Float,
    String,
    DateTime,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rag_ops.schemas.base import Base

if TYPE_CHECKING:
    from rag_ops.schemas.project import Project


class Trace(Base):
    """
    Represents one LLM interaction.

    Example:
        User Query
        ↓
        Retrieved Context
        ↓
        Prompt
        ↓
        LLM Response
        ↓
        Evaluation Scores
    """

    __tablename__ = "traces"

    # Unique trace ID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Foreign key to Project
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User's original question
    user_query: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Prompt sent to the LLM
    llm_prompt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Final LLM response
    llm_response: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Retrieved RAG documents/chunks
    retrieved_contexts: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Model latency in milliseconds
    latency_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # Token usage and additional metadata
    usage_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Many traces belong to one project
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="traces",
    )

    # One trace can have many evaluation metrics
    evaluations: Mapped[list["EvaluationScore"]] = relationship(
        "EvaluationScore",
        back_populates="trace",
        cascade="all, delete-orphan",
    )

    # Database indexes for faster lookups
    __table_args__ = (
        Index("ix_traces_project_id", "project_id"),
        Index("ix_traces_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Trace(id={self.id}, " f"project_id={self.project_id})>"


class EvaluationScore(Base):
    """
    Stores one evaluation metric for a trace.

    Examples:
        Faithfulness
        Answer Relevancy
        Context Precision
        Context Recall
    """

    __tablename__ = "evaluation_scores"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Parent trace
    trace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("traces.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Metric name
    metric_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    # Metric score
    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    # Why the evaluator gave this score
    reasoning: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Model used for evaluation
    evaluator_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Parent Trace relationship
    trace: Mapped["Trace"] = relationship(
        "Trace",
        back_populates="evaluations",
    )

    def __repr__(self) -> str:
        return (
            f"<EvaluationScore("
            f"metric='{self.metric_name}', "
            f"score={self.score})>"
        )
