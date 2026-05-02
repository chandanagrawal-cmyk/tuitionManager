"""user theme

Revision ID: 0008
Revises: 0007
Create Date: 2024-01-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('theme', sa.String(), nullable=True, server_default='violet'))


def downgrade():
    op.drop_column('users', 'theme')
