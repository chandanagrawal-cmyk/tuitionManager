"""full schema

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
    )

    op.create_table('parents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('phone', sa.String()),
        sa.Column('email', sa.String()),
        sa.Column('notes', sa.String()),
        sa.Column('receive_calendar_invites', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.create_table('students',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('subject', sa.String()),
        sa.Column('default_day', sa.Integer(), nullable=False),
        sa.Column('default_time', sa.String(), nullable=False),
        sa.Column('fee_per_session', sa.Float(), server_default='35.0'),
        sa.Column('phone', sa.String()),
        sa.Column('email', sa.String()),
        sa.Column('birth_month', sa.Integer()),
        sa.Column('birth_year', sa.Integer()),
        sa.Column('school_year', sa.String()),
    )

    op.create_table('student_parents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('parents.id'), nullable=False),
        sa.Column('relationship_type', sa.String(), nullable=False, server_default='Guardian'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.create_table('session_series',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('time', sa.String(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date()),
        sa.Column('notes', sa.String()),
    )

    op.create_table('sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False),
        sa.Column('series_id', sa.Integer(), sa.ForeignKey('session_series.id'), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('time', sa.String(), nullable=False),
        sa.Column('status', sa.Enum('scheduled', 'completed', 'cancelled', name='sessionstatus'), server_default='scheduled'),
        sa.Column('notes', sa.String()),
        sa.Column('google_event_id', sa.String()),
    )

    op.create_table('payments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('sessions.id'), nullable=False, unique=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'received', name='paymentstatus'), server_default='pending'),
        sa.Column('received_date', sa.Date()),
        sa.Column('notes', sa.String()),
    )

    op.create_table('messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('contact_number', sa.String(), nullable=False),
        sa.Column('contact_name', sa.String()),
        sa.Column('direction', sa.Enum('inbound', 'outbound', name='messagedirection'), nullable=False),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('whatsapp_message_id', sa.String()),
    )


def downgrade():
    op.drop_table('messages')
    op.drop_table('payments')
    op.drop_table('sessions')
    op.drop_table('session_series')
    op.drop_table('student_parents')
    op.drop_table('students')
    op.drop_table('parents')
    op.drop_table('users')
    op.execute('DROP TYPE IF EXISTS sessionstatus')
    op.execute('DROP TYPE IF EXISTS paymentstatus')
    op.execute('DROP TYPE IF EXISTS messagedirection')
