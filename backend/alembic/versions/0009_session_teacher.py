"""session teacher

Revision ID: 0009
Revises: 0008
Create Date: 2024-01-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sessions', sa.Column('teacher_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('sessions', 'teacher_id')
