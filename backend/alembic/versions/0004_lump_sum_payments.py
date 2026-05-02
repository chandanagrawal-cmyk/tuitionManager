"""lump sum payments

Revision ID: 0004_lump_sum_payments
Revises: 0003_whatsapp_session
Create Date: 2024-01-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

paymentstatus = ENUM('pending', 'received', name='paymentstatus', create_type=False)

def upgrade():
    op.create_table('lump_sum_payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('status', paymentstatus, server_default='received'),
        sa.Column('notes', sa.String()),
    )

def downgrade():
    op.drop_table('lump_sum_payments')
