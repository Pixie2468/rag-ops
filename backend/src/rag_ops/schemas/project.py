"""
Project model.

A Project represents one RAG application or experiment.

Example:
    Customer Support Bot
    Medical QA System
    Legal Document Search

One Project can contain many Traces.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from rag_ops.schemas.base import Base

if TYPE_CHECKING:
    from rag_ops.schemas.trace import Trace


class Project(Base):
    """Database model for projects."""

    __tablename__ = "projects"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Project name
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
    )

    # Automatically generated timestamp (database side)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # One project -> Many traces
    traces: Mapped[list["Trace"]] = relationship(
        "Trace",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}')>"
