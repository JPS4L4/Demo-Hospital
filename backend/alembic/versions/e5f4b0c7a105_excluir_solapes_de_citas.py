"""excluir solapes de citas

Revision ID: e5f4b0c7a105
Revises: d4e3a9b6f004
Create Date: 2026-10-15 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f4b0c7a105"
down_revision: str | Sequence[str] | None = "d4e3a9b6f004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # btree_gist permite mezclar la igualdad de un entero con el solape de un rango en un índice GiST
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    # SQL directo: create_exclude_constraint no admite expresiones como tstzrange(inicio, fin)
    for nombre, columna in (
        ("ex_citas_profesional_solape", "profesional_id"),
        ("ex_citas_paciente_solape", "paciente_id"),
    ):
        op.execute(
            f"ALTER TABLE citas ADD CONSTRAINT {nombre} EXCLUDE USING gist "
            f"({columna} WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado <> 'cancelada')"
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Una EXCLUDE se elimina como cualquier otra restricción; drop_constraint no admite ese tipo
    op.execute("ALTER TABLE citas DROP CONSTRAINT ex_citas_paciente_solape")
    op.execute("ALTER TABLE citas DROP CONSTRAINT ex_citas_profesional_solape")
    # La extensión se deja instalada a propósito: crearla exige privilegios elevados, no estorba
    # y otras bases de datos o migraciones pueden depender de ella.
