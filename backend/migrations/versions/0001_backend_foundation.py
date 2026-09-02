"""Create the TerraWatch backend foundation schema.

Revision ID: 0001_backend_foundation
Revises: None
"""
from __future__ import annotations

from alembic import op

from backend.app.models.database import Base


revision = "0001_backend_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        for table in Base.metadata.sorted_tables:
            op.execute(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())

