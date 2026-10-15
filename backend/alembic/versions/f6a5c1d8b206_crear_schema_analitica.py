"""crear schema analitica (modelo en estrella)

Revision ID: f6a5c1d8b206
Revises: e5f4b0c7a105
Create Date: 2026-10-15 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
from app.analitica.sql import CREAR, ELIMINAR

# revision identifiers, used by Alembic.
revision: str = "f6a5c1d8b206"
down_revision: str | Sequence[str] | None = "e5f4b0c7a105"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQL compartido con tests/conftest.py: create_all no crea vistas materializadas.
    # Las vistas nacen pobladas con los datos actuales de `citas`.
    for sentencia in CREAR:
        op.execute(sentencia)


def downgrade() -> None:
    """Downgrade schema."""
    for sentencia in ELIMINAR:
        op.execute(sentencia)
