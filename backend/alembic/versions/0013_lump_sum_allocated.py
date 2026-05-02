"""add allocated_amount to lump_sum_payments

Revision ID: 0013_lump_sum_allocated
Revises: 0012
Branch Labels: None
Depends On: None
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('lump_sum_payments', sa.Column('allocated_amount', sa.Float(), server_default='0', nullable=False))

def downgrade():
    op.drop_column('lump_sum_payments', 'allocated_amount')
