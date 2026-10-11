"""add_performance_and_security_indexes

Revision ID: 186a6ecddb56
Revises: c0a2e9def992
Create Date: 2026-10-11 11:18:59.809572

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '186a6ecddb56'
down_revision: Union[str, None] = 'c0a2e9def992'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: add performance and security indexes."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. foods: barcode UNIQUE, category index
    foods_indexes = {idx['name'] for idx in insp.get_indexes('foods')}
    with op.batch_alter_table('foods', schema=None) as batch_op:
        if 'ix_foods_barcode' in foods_indexes:
            batch_op.drop_index('ix_foods_barcode')
        batch_op.create_index('ix_foods_barcode', ['barcode'], unique=True)
        if 'ix_foods_category' not in foods_indexes:
            batch_op.create_index('ix_foods_category', ['category'], unique=False)

    # 2. orders(user_id, status)
    orders_indexes = {idx['name'] for idx in insp.get_indexes('orders')}
    with op.batch_alter_table('orders', schema=None) as batch_op:
        if 'ix_orders_user_id_status' not in orders_indexes:
            batch_op.create_index('ix_orders_user_id_status', ['user_id', 'status'], unique=False)

    # 3. cart_items.user_id
    cart_indexes = {idx['name'] for idx in insp.get_indexes('cart_items')}
    with op.batch_alter_table('cart_items', schema=None) as batch_op:
        if 'ix_cart_items_user_id' not in cart_indexes:
            batch_op.create_index('ix_cart_items_user_id', ['user_id'], unique=False)

    # 4. subscriptions.user_id
    sub_indexes = {idx['name'] for idx in insp.get_indexes('subscriptions')}
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        if 'ix_subscriptions_user_id' not in sub_indexes:
            batch_op.create_index('ix_subscriptions_user_id', ['user_id'], unique=False)

    # 5. refresh_tokens(user_id, family_id, token_hash)
    rt_indexes = {idx['name'] for idx in insp.get_indexes('refresh_tokens')}
    with op.batch_alter_table('refresh_tokens', schema=None) as batch_op:
        if 'ix_refresh_tokens_user_family_hash' not in rt_indexes:
            batch_op.create_index('ix_refresh_tokens_user_family_hash', ['user_id', 'family_id', 'token_hash'], unique=False)

    # 6. audit_logs.created_at
    al_indexes = {idx['name'] for idx in insp.get_indexes('audit_logs')}
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        if 'ix_audit_logs_created_at' not in al_indexes:
            batch_op.create_index('ix_audit_logs_created_at', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema: drop added indexes."""
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 6. audit_logs.created_at
    al_indexes = {idx['name'] for idx in insp.get_indexes('audit_logs')}
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        if 'ix_audit_logs_created_at' in al_indexes:
            batch_op.drop_index('ix_audit_logs_created_at')

    # 5. refresh_tokens(user_id, family_id, token_hash)
    rt_indexes = {idx['name'] for idx in insp.get_indexes('refresh_tokens')}
    with op.batch_alter_table('refresh_tokens', schema=None) as batch_op:
        if 'ix_refresh_tokens_user_family_hash' in rt_indexes:
            batch_op.drop_index('ix_refresh_tokens_user_family_hash')

    # 2. orders(user_id, status)
    orders_indexes = {idx['name'] for idx in insp.get_indexes('orders')}
    with op.batch_alter_table('orders', schema=None) as batch_op:
        if 'ix_orders_user_id_status' in orders_indexes:
            batch_op.drop_index('ix_orders_user_id_status')

    # 1. foods.barcode UNIQUE -> revert to non-unique
    foods_indexes = {idx['name'] for idx in insp.get_indexes('foods')}
    with op.batch_alter_table('foods', schema=None) as batch_op:
        if 'ix_foods_barcode' in foods_indexes:
            batch_op.drop_index('ix_foods_barcode')
        batch_op.create_index('ix_foods_barcode', ['barcode'], unique=False)
