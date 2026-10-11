"""phase2_schema_alignment

Revision ID: d2b7e192a001
Revises: 186a6ecddb56
Create Date: 2026-10-11 18:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2b7e192a001'
down_revision: Union[str, None] = '186a6ecddb56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. foods table additions
    foods_cols = {col['name'] for col in insp.get_columns('foods')}
    with op.batch_alter_table('foods', schema=None) as batch_op:
        if 'image_alt' not in foods_cols:
            batch_op.add_column(sa.Column('image_alt', sa.String(200), nullable=True))
        if 'image_source_url' not in foods_cols:
            batch_op.add_column(sa.Column('image_source_url', sa.String(500), nullable=True))
        if 'image_license' not in foods_cols:
            batch_op.add_column(sa.Column('image_license', sa.String(100), nullable=True))
        if 'image_verified_at' not in foods_cols:
            batch_op.add_column(sa.Column('image_verified_at', sa.DateTime(), nullable=True))
        if 'approval_status' not in foods_cols:
            batch_op.add_column(sa.Column('approval_status', sa.String(30), nullable=True, server_default='pending'))

    # 2. orders table additions
    orders_cols = {col['name'] for col in insp.get_columns('orders')}
    with op.batch_alter_table('orders', schema=None) as batch_op:
        if 'is_demo' not in orders_cols:
            batch_op.add_column(sa.Column('is_demo', sa.Boolean(), nullable=True, server_default=sa.true()))

    # 3. nutritionist_review_requests table additions
    review_cols = {col['name'] for col in insp.get_columns('nutritionist_review_requests')}
    with op.batch_alter_table('nutritionist_review_requests', schema=None) as batch_op:
        if 'proposed_changes' not in review_cols:
            batch_op.add_column(sa.Column('proposed_changes', sa.Text(), nullable=True))
        if 'consent_snapshot' not in review_cols:
            batch_op.add_column(sa.Column('consent_snapshot', sa.Text(), nullable=True))

    # 4. nutrition_profiles table additions
    prof_cols = {col['name'] for col in insp.get_columns('nutrition_profiles')}
    with op.batch_alter_table('nutrition_profiles', schema=None) as batch_op:
        if 'consent_revoked_at' not in prof_cols:
            batch_op.add_column(sa.Column('consent_revoked_at', sa.DateTime(), nullable=True))

    # 5. notify_requests table
    if 'notify_requests' not in existing_tables:
        op.create_table(
            'notify_requests',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('email', sa.String(255), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index('ix_notify_requests_food_email', 'notify_requests', ['food_id', 'email'])

    # 6. recipe_ingredients table
    if 'recipe_ingredients' not in existing_tables:
        op.create_table(
            'recipe_ingredients',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('recipe_id', sa.String(36), sa.ForeignKey('recipes.id', ondelete='CASCADE'), nullable=False),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False, server_default='1.0'),
            sa.Column('unit', sa.String(40), nullable=False, server_default='serving'),
        )
        op.create_index('ix_recipe_ingredients_recipe', 'recipe_ingredients', ['recipe_id'])

    # 7. product_pairings table
    if 'product_pairings' not in existing_tables:
        op.create_table(
            'product_pairings',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('paired_food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('reason', sa.String(255), nullable=True),
        )
        op.create_index('ix_product_pairings_pair', 'product_pairings', ['food_id', 'paired_food_id'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    if 'product_pairings' in existing_tables:
        op.drop_table('product_pairings')

    if 'recipe_ingredients' in existing_tables:
        op.drop_table('recipe_ingredients')

    if 'notify_requests' in existing_tables:
        op.drop_table('notify_requests')

    with op.batch_alter_table('nutrition_profiles', schema=None) as batch_op:
        batch_op.drop_column('consent_revoked_at')

    with op.batch_alter_table('nutritionist_review_requests', schema=None) as batch_op:
        batch_op.drop_column('consent_snapshot')
        batch_op.drop_column('proposed_changes')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('is_demo')

    with op.batch_alter_table('foods', schema=None) as batch_op:
        batch_op.drop_column('approval_status')
        batch_op.drop_column('image_verified_at')
        batch_op.drop_column('image_license')
        batch_op.drop_column('image_source_url')
        batch_op.drop_column('image_alt')
