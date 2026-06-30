"""
Base class for all SQLAlchemy ORM models.

Every table in the project should inherit from this class.
SQLAlchemy uses this declarative base to keep track of all models.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass
