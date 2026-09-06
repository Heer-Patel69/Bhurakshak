"""Add deduplicated verified training candidates.

Revision ID: 0002_verified_training_candidates
Revises: d7a3e821c490
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_verified_training_candidates"
down_revision = "d7a3e821c490"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
    if "verified_report_count" not in incident_columns:
        op.add_column("incidents", sa.Column("verified_report_count", sa.Integer(), nullable=False, server_default="1"))
    if "verified_training_candidates" in inspector.get_table_names():
        return
    op.create_table(
        "verified_training_candidates",
        sa.Column("candidate_id", sa.String(length=36), primary_key=True),
        sa.Column("incident_id", sa.String(length=36), sa.ForeignKey("incidents.incident_id"), nullable=False, unique=True),
        sa.Column("source_report_id", sa.String(length=36), sa.ForeignKey("citizen_reports.report_id"), nullable=False, unique=True),
        sa.Column("label", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("verification_source", sa.String(length=128), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weather_snapshot", sa.JSON(), nullable=False),
        sa.Column("terrain_values", sa.JSON(), nullable=False),
        sa.Column("data_provenance", sa.JSON(), nullable=False),
        sa.Column("feature_schema_version", sa.String(length=32), nullable=False, server_default="five-feature-v1"),
        sa.Column("dataset_version", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_verified_training_candidates_incident_id", "verified_training_candidates", ["incident_id"], unique=True)
    op.create_index("ix_verified_training_candidates_source_report_id", "verified_training_candidates", ["source_report_id"], unique=True)
    op.create_index("ix_verified_training_candidates_category", "verified_training_candidates", ["category"])
    op.create_index("ix_verified_training_candidates_dataset_version", "verified_training_candidates", ["dataset_version"])
    op.create_index("ix_verified_training_candidates_event_time", "verified_training_candidates", ["event_time"])
    op.create_index("ix_verified_training_candidates_created_at", "verified_training_candidates", ["created_at"])
    if bind.dialect.name == "postgresql":
        op.execute('ALTER TABLE "verified_training_candidates" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "verified_training_candidates" in inspector.get_table_names():
        op.drop_table("verified_training_candidates")
    incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
    if "verified_report_count" in incident_columns:
        op.drop_column("incidents", "verified_report_count")
