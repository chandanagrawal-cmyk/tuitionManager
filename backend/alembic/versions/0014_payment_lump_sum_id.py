"""add lump_sum_id to payments

Revision ID: 0014_payment_lump_sum_id
Revises: 0013
Branch Labels: None
Depends On: None
"""
from alembic import op
import sqlalchemy as sa

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('payments', sa.Column('lump_sum_id', sa.Integer(), sa.ForeignKey('lump_sum_payments.id', ondelete='SET NULL'), nullable=True))

def downgrade():
    op.drop_column('payments', 'lump_sum_id')
