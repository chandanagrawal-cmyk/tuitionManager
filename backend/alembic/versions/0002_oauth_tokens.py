"""oauth tokens table

Revision ID: 0002
Revises: 0001
Create Date: 2024-01-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('oauth_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('provider', sa.String(), nullable=False, unique=True),
        sa.Column('token_json', sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table('oauth_tokens')
