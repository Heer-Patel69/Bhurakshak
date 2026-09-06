"""reporting media and frontend contract fields

Revision ID: d7a3e821c490
Revises: b51739103ca3
"""
from alembic import op
import sqlalchemy as sa


revision = "d7a3e821c490"
down_revision = "b51739103ca3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("citizen_reports")}
    columns = (
        sa.Column("reporter_type", sa.String(32), nullable=False, server_default="citizen"),
        sa.Column("place_name", sa.String(240)), sa.Column("landmark", sa.String(500)),
        sa.Column("road_name", sa.String(240)), sa.Column("district", sa.String(128)),
        sa.Column("severity_observed", sa.String(32)), sa.Column("ai_suggested_category", sa.String(64)),
        sa.Column("ai_model", sa.String(128)), sa.Column("ai_generated_at", sa.DateTime(timezone=True)),
        sa.Column("translated_text", sa.Text()), sa.Column("translated_language", sa.String(8)),
        sa.Column("verification_note", sa.Text()), sa.Column("affected_road_id", sa.String(128)),
        sa.Column("authority_action_id", sa.String(36)), sa.Column("created_offline", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("client_created_at", sa.DateTime(timezone=True)), sa.Column("sync_status", sa.String(32), nullable=False, server_default="synced"),
    )
    for column in columns:
        if column.name not in existing_columns:
            op.add_column("citizen_reports", column)
    existing_indexes = {index["name"] for index in inspector.get_indexes("citizen_reports")}
    if "ix_citizen_reports_reporter_type" not in existing_indexes:
        op.create_index("ix_citizen_reports_reporter_type", "citizen_reports", ["reporter_type"])
    if "ix_citizen_reports_affected_road_id" not in existing_indexes:
        op.create_index("ix_citizen_reports_affected_road_id", "citizen_reports", ["affected_road_id"])
    if "report_media" in inspector.get_table_names():
        if bind.dialect.name == "postgresql":
            op.execute('ALTER TABLE "report_media" ENABLE ROW LEVEL SECURITY')
            op.execute('REVOKE ALL PRIVILEGES ON TABLE "report_media" FROM anon')
            op.execute('REVOKE ALL PRIVILEGES ON TABLE "report_media" FROM authenticated')
            op.execute("INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('hazard-reports', 'hazard-reports', false, 20000000, ARRAY['image/jpeg','image/png','image/webp','video/mp4']) ON CONFLICT (id) DO NOTHING")
        return
    op.create_table(
        "report_media",
        sa.Column("media_id", sa.String(36), primary_key=True),
        sa.Column("report_id", sa.String(36), sa.ForeignKey("citizen_reports.report_id"), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False, unique=True),
        sa.Column("media_type", sa.String(16), nullable=False), sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False), sa.Column("source", sa.String(32), nullable=False),
        sa.Column("original_filename", sa.String(255)), sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_report_media_report_id", "report_media", ["report_id"])
    op.create_index("ix_report_media_uploaded_at", "report_media", ["uploaded_at"])
    if op.get_bind().dialect.name == "postgresql":
        op.execute('ALTER TABLE "report_media" ENABLE ROW LEVEL SECURITY')
        op.execute('REVOKE ALL PRIVILEGES ON TABLE "report_media" FROM anon')
        op.execute('REVOKE ALL PRIVILEGES ON TABLE "report_media" FROM authenticated')
        op.execute("INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('hazard-reports', 'hazard-reports', false, 20000000, ARRAY['image/jpeg','image/png','image/webp','video/mp4']) ON CONFLICT (id) DO NOTHING")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DELETE FROM storage.buckets WHERE id = 'hazard-reports' AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'hazard-reports')")
    op.drop_table("report_media")
    for name in ("sync_status", "client_created_at", "created_offline", "authority_action_id", "affected_road_id", "verification_note", "translated_language", "translated_text", "ai_generated_at", "ai_model", "ai_suggested_category", "severity_observed", "district", "road_name", "landmark", "place_name", "reporter_type"):
        op.drop_column("citizen_reports", name)
