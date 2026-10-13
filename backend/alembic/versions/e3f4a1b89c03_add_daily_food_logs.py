"""add_daily_food_logs

Revision ID: e3f4a1b89c03
Revises: e3f4a1b89c02
Create Date: 2026-10-13 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4a1b89c03'
down_revision: Union[str, None] = 'e3f4a1b89c02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    if 'daily_food_logs' not in existing_tables:
        op.create_table(
            'daily_food_logs',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('date', sa.String(10), nullable=False),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='SET NULL'), nullable=True),
            sa.Column('food_name', sa.String(255), nullable=False),
            sa.Column('meal_type', sa.String(50), nullable=False, server_default='lunch'),
            sa.Column('quantity', sa.Float(), nullable=False, server_default='100.0'),
            sa.Column('unit', sa.String(30), nullable=False, server_default='g'),
            sa.Column('mass_g', sa.Float(), nullable=False, server_default='100.0'),
            sa.Column('calories', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('protein_g', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('carbs_g', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('fat_g', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('fibre_g', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('nutrients_json', sa.Text(), nullable=False, server_default='{}'),
            sa.Column('source_basis', sa.String(100), nullable=False, server_default='catalog'),
            sa.Column('data_completeness', sa.String(50), nullable=False, server_default='verified'),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_daily_food_logs_user_date', 'daily_food_logs', ['user_id', 'date'])
        op.create_index('ix_daily_food_logs_user_id', 'daily_food_logs', ['user_id'])
        op.create_index('ix_daily_food_logs_date', 'daily_food_logs', ['date'])
        op.create_index('ix_daily_food_logs_food_id', 'daily_food_logs', ['food_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    if 'daily_food_logs' in existing_tables:
        op.drop_table('daily_food_logs')
