"""avatar columns

Revision ID: 0007
Revises: 0006
Create Date: 2024-01-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('students', sa.Column('avatar', sa.String(), nullable=True))
    op.add_column('parents', sa.Column('avatar', sa.String(), nullable=True))


def downgrade():
    op.drop_column('students', 'avatar')
    op.drop_column('parents', 'avatar')
