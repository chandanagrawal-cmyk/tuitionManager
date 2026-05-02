"""user roles

Revision ID: 0005
Revises: 0004
Create Date: 2024-01-05 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE TYPE userrole AS ENUM ('admin', 'teacher', 'ledger_keeper', 'receptionist')")
    op.add_column('users', sa.Column('role', sa.Enum('admin', 'teacher', 'ledger_keeper', 'receptionist', name='userrole'), nullable=False, server_default='teacher'))
    # Make the existing admin user an admin
    op.execute("UPDATE users SET role = 'admin' WHERE username = 'admin'")


def downgrade():
    op.drop_column('users', 'role')
    op.execute('DROP TYPE userrole')
