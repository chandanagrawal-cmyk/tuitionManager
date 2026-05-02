"""user email

Revision ID: 0012_user_email
Revises: 0011_session_rsvp
Create Date: 2026-05-02 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012_user_email'
down_revision = '0011_session_rsvp'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('email', sa.String(), nullable=True))


def downgrade():
    op.drop_column('users', 'email')
