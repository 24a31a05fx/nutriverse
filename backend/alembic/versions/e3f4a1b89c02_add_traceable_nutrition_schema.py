"""add_traceable_nutrition_schema

Revision ID: e3f4a1b89c02
Revises: d2b7e192a001
Create Date: 2026-10-12 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f4a1b89c02'
down_revision: Union[str, None] = 'd2b7e192a001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    # 1. data_sources
    if 'data_sources' not in existing_tables:
        op.create_table(
            'data_sources',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(120), nullable=False),
            sa.Column('publisher', sa.String(200), nullable=False),
            sa.Column('url', sa.String(500), nullable=True),
            sa.Column('license', sa.String(120), nullable=False),
            sa.Column('license_url', sa.String(500), nullable=True),
            sa.Column('version', sa.String(40), nullable=True),
            sa.Column('terms_notes', sa.Text(), nullable=True),
            sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_data_sources_name', 'data_sources', ['name'], unique=True)

    # 2. source_records
    if 'source_records' not in existing_tables:
        op.create_table(
            'source_records',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('source_id', sa.String(36), sa.ForeignKey('data_sources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('external_id', sa.String(120), nullable=False),
            sa.Column('external_name', sa.String(255), nullable=False),
            sa.Column('raw_payload', sa.Text(), nullable=False, server_default='{}'),
            sa.Column('raw_checksum', sa.String(64), nullable=True),
            sa.Column('retrieval_date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_source_records_source_external', 'source_records', ['source_id', 'external_id'], unique=True)
        op.create_index('ix_source_records_source_id', 'source_records', ['source_id'])
        op.create_index('ix_source_records_external_id', 'source_records', ['external_id'])

    # 3. nutrients
    if 'nutrients' not in existing_tables:
        op.create_table(
            'nutrients',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('canonical_code', sa.String(50), nullable=False),
            sa.Column('unit', sa.String(20), nullable=False),
            sa.Column('category', sa.String(50), nullable=False, server_default='macronutrient'),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('applicable_basis', sa.String(50), nullable=False, server_default='per_100g_edible'),
            sa.Column('icmr_rda_adult_male', sa.Float(), nullable=True),
            sa.Column('icmr_rda_adult_female', sa.Float(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_nutrients_name', 'nutrients', ['name'], unique=True)
        op.create_index('ix_nutrients_canonical_code', 'nutrients', ['canonical_code'], unique=True)
        op.create_index('ix_nutrients_category', 'nutrients', ['category'])

    # 4. food_nutrients
    if 'food_nutrients' not in existing_tables:
        op.create_table(
            'food_nutrients',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('nutrient_id', sa.String(36), sa.ForeignKey('nutrients.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('source_record_id', sa.String(36), sa.ForeignKey('source_records.id', ondelete='SET NULL'), nullable=True),
            sa.Column('value', sa.Float(), nullable=True),
            sa.Column('unit', sa.String(20), nullable=False),
            sa.Column('basis', sa.String(50), nullable=False, server_default='per_100g_edible'),
            sa.Column('food_state', sa.String(50), nullable=False, server_default='raw'),
            sa.Column('verification_status', sa.String(40), nullable=False, server_default='pending_review'),
            sa.Column('is_unknown', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('unknown_reason', sa.String(255), nullable=True),
            sa.Column('confidence_score', sa.Float(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index(
            'ix_food_nutrients_food_nutrient_state',
            'food_nutrients',
            ['food_id', 'nutrient_id', 'food_state', 'basis'],
            unique=True,
        )
        op.create_index('ix_food_nutrients_food_id', 'food_nutrients', ['food_id'])
        op.create_index('ix_food_nutrients_nutrient_id', 'food_nutrients', ['nutrient_id'])
        op.create_index('ix_food_nutrients_source_record_id', 'food_nutrients', ['source_record_id'])
        op.create_index('ix_food_nutrients_verification_status', 'food_nutrients', ['verification_status'])
        op.create_index('ix_food_nutrients_is_unknown', 'food_nutrients', ['is_unknown'])

    # 5. verification_records
    if 'verification_records' not in existing_tables:
        op.create_table(
            'verification_records',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('food_nutrient_id', sa.String(36), sa.ForeignKey('food_nutrients.id', ondelete='CASCADE'), nullable=False),
            sa.Column('reviewer_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reviewer_name', sa.String(120), nullable=False),
            sa.Column('status', sa.String(40), nullable=False),
            sa.Column('evidence', sa.Text(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('previous_status', sa.String(40), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_verification_records_food_nutrient', 'verification_records', ['food_nutrient_id'])
        op.create_index('ix_verification_records_reviewer', 'verification_records', ['reviewer_id'])

    # 6. calin_pack_items
    if 'calin_pack_items' not in existing_tables:
        op.create_table(
            'calin_pack_items',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('pack_tier_id', sa.String(36), sa.ForeignKey('calin_pack_tiers.id', ondelete='CASCADE'), nullable=False),
            sa.Column('food_id', sa.String(36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False),
            sa.Column('quantity', sa.Float(), nullable=False, server_default='1.0'),
            sa.Column('unit', sa.String(40), nullable=False, server_default='unit'),
            sa.Column('role_in_pack', sa.String(60), nullable=True),
            sa.Column('is_essential', sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_calin_pack_items_tier_food', 'calin_pack_items', ['pack_tier_id', 'food_id'], unique=True)
        op.create_index('ix_calin_pack_items_pack_tier_id', 'calin_pack_items', ['pack_tier_id'])
        op.create_index('ix_calin_pack_items_food_id', 'calin_pack_items', ['food_id'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    if 'calin_pack_items' in existing_tables:
        op.drop_table('calin_pack_items')

    if 'verification_records' in existing_tables:
        op.drop_table('verification_records')

    if 'food_nutrients' in existing_tables:
        op.drop_table('food_nutrients')

    if 'nutrients' in existing_tables:
        op.drop_table('nutrients')

    if 'source_records' in existing_tables:
        op.drop_table('source_records')

    if 'data_sources' in existing_tables:
        op.drop_table('data_sources')
