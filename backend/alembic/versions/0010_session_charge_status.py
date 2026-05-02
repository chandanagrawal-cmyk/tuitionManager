"""session charge status

Revision ID: 0010
Revises: 0009
Create Date: 2024-01-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sessions', sa.Column('charge_status', sa.String(), nullable=True))


def downgrade():
    op.drop_column('sessions', 'charge_status')
