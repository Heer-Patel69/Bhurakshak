"""revoke public data api access

Revision ID: b51739103ca3
Revises: 0001_backend_foundation
Create Date: 2026-09-02 20:24:22.506172
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b51739103ca3'
down_revision: Union[str, None] = '0001_backend_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    tables = (
        "citizen_reports",
        "incidents",
        "sensor_devices",
        "sensor_readings",
        "risk_snapshots",
        "road_status",
        "alerts",
        "facilities",
        "villages",
        "provider_health",
        "authority_actions",
    )
    for table in tables:
        op.execute(f'REVOKE ALL PRIVILEGES ON TABLE "{table}" FROM anon')
        op.execute(f'REVOKE ALL PRIVILEGES ON TABLE "{table}" FROM authenticated')


def downgrade() -> None:
    # Deliberately do not restore broad Data API grants during a downgrade.
    # Any future client access must be introduced through explicit, reviewed
    # least-privilege grants and matching RLS policies.
    pass
