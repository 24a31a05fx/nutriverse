"""paise_migration

Revision ID: c0a2e9def992
Revises: a5d2dd3a04f9
Create Date: 2026-10-11 10:54:22.557985

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0a2e9def992'
down_revision: Union[str, None] = 'a5d2dd3a04f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: migrate price_inr to price_paise (integer, x100) and add gst_rate_percent."""
    # 1. foods: rename price_inr -> price_paise, add gst_rate_percent, multiply by 100
    with op.batch_alter_table("foods", schema=None) as batch_op:
        batch_op.alter_column("price_inr", new_column_name="price_paise", existing_type=sa.Integer())
        batch_op.add_column(sa.Column("gst_rate_percent", sa.Float(), nullable=True))
    op.execute("UPDATE foods SET price_paise = price_paise * 100")

    # 2. calin_pack_tiers: rename base_price_inr -> base_price_paise, multiply by 100
    with op.batch_alter_table("calin_pack_tiers", schema=None) as batch_op:
        batch_op.alter_column("base_price_inr", new_column_name="base_price_paise", existing_type=sa.Integer())
    op.execute("UPDATE calin_pack_tiers SET base_price_paise = base_price_paise * 100")

    # 3. cart_items: rename unit_price_inr -> unit_price_paise, multiply by 100
    with op.batch_alter_table("cart_items", schema=None) as batch_op:
        batch_op.alter_column("unit_price_inr", new_column_name="unit_price_paise", existing_type=sa.Integer())
    op.execute("UPDATE cart_items SET unit_price_paise = unit_price_paise * 100")

    # 4. orders: rename subtotal_inr -> subtotal_paise, delivery_fee_inr -> delivery_fee_paise, total_inr -> total_paise, multiply by 100
    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.alter_column("subtotal_inr", new_column_name="subtotal_paise", existing_type=sa.Integer())
        batch_op.alter_column("delivery_fee_inr", new_column_name="delivery_fee_paise", existing_type=sa.Integer())
        batch_op.alter_column("total_inr", new_column_name="total_paise", existing_type=sa.Integer())
    op.execute("UPDATE orders SET subtotal_paise = subtotal_paise * 100, delivery_fee_paise = delivery_fee_paise * 100, total_paise = total_paise * 100")

    # Migrate embedded JSON line-item prices in orders.items_json
    conn = op.get_bind()
    order_rows = conn.execute(sa.text("SELECT id, items_json FROM orders")).fetchall()
    for o_id, raw_items in order_rows:
        if raw_items:
            try:
                items = json.loads(raw_items)
                updated = False
                for it in items:
                    if "unit_price_inr" in it:
                        it["unit_price_paise"] = int(it.pop("unit_price_inr")) * 100
                        updated = True
                    elif "unit_price_paise" in it:
                        it["unit_price_paise"] = int(it["unit_price_paise"]) * 100
                        updated = True
                    if "total_inr" in it:
                        it["total_paise"] = int(it.pop("total_inr")) * 100
                        updated = True
                    elif "total_paise" in it:
                        it["total_paise"] = int(it["total_paise"]) * 100
                        updated = True
                if updated:
                    conn.execute(
                        sa.text("UPDATE orders SET items_json = :items WHERE id = :id"),
                        {"items": json.dumps(items), "id": o_id},
                    )
            except Exception:
                pass

    # 5. subscriptions: rename price_per_delivery_inr -> price_per_delivery_paise, multiply by 100
    with op.batch_alter_table("subscriptions", schema=None) as batch_op:
        batch_op.alter_column("price_per_delivery_inr", new_column_name="price_per_delivery_paise", existing_type=sa.Integer())
    op.execute("UPDATE subscriptions SET price_per_delivery_paise = price_per_delivery_paise * 100")

    # 6. nutrition_profiles: rename budget_inr -> budget_paise, multiply by 100
    with op.batch_alter_table("nutrition_profiles", schema=None) as batch_op:
        batch_op.alter_column("budget_inr", new_column_name="budget_paise", existing_type=sa.Integer())
    op.execute("UPDATE nutrition_profiles SET budget_paise = budget_paise * 100")


def downgrade() -> None:
    """Downgrade schema: revert price_paise to price_inr (integer, /100) and drop gst_rate_percent."""
    # 0. nutrition_profiles: divide by 100, rename back
    op.execute("UPDATE nutrition_profiles SET budget_paise = CAST(budget_paise / 100 AS INTEGER)")
    with op.batch_alter_table("nutrition_profiles", schema=None) as batch_op:
        batch_op.alter_column("budget_paise", new_column_name="budget_inr", existing_type=sa.Integer())

    # 1. subscriptions: divide by 100, rename back
    op.execute("UPDATE subscriptions SET price_per_delivery_paise = CAST(price_per_delivery_paise / 100 AS INTEGER)")
    with op.batch_alter_table("subscriptions", schema=None) as batch_op:
        batch_op.alter_column("price_per_delivery_paise", new_column_name="price_per_delivery_inr", existing_type=sa.Integer())

    # 2. orders: divide by 100, revert embedded JSON line-item prices, rename back
    conn = op.get_bind()
    order_rows = conn.execute(sa.text("SELECT id, items_json FROM orders")).fetchall()
    for o_id, raw_items in order_rows:
        if raw_items:
            try:
                items = json.loads(raw_items)
                updated = False
                for it in items:
                    if "unit_price_paise" in it:
                        it["unit_price_inr"] = int(it.pop("unit_price_paise")) // 100
                        updated = True
                    if "total_paise" in it:
                        it["total_inr"] = int(it.pop("total_paise")) // 100
                        updated = True
                if updated:
                    conn.execute(
                        sa.text("UPDATE orders SET items_json = :items WHERE id = :id"),
                        {"items": json.dumps(items), "id": o_id},
                    )
            except Exception:
                pass

    op.execute("UPDATE orders SET subtotal_paise = CAST(subtotal_paise / 100 AS INTEGER), delivery_fee_paise = CAST(delivery_fee_paise / 100 AS INTEGER), total_paise = CAST(total_paise / 100 AS INTEGER)")
    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.alter_column("subtotal_paise", new_column_name="subtotal_inr", existing_type=sa.Integer())
        batch_op.alter_column("delivery_fee_paise", new_column_name="delivery_fee_inr", existing_type=sa.Integer())
        batch_op.alter_column("total_paise", new_column_name="total_inr", existing_type=sa.Integer())

    # 3. cart_items: divide by 100, rename back
    op.execute("UPDATE cart_items SET unit_price_paise = CAST(unit_price_paise / 100 AS INTEGER)")
    with op.batch_alter_table("cart_items", schema=None) as batch_op:
        batch_op.alter_column("unit_price_paise", new_column_name="unit_price_inr", existing_type=sa.Integer())

    # 4. calin_pack_tiers: divide by 100, rename back
    op.execute("UPDATE calin_pack_tiers SET base_price_paise = CAST(base_price_paise / 100 AS INTEGER)")
    with op.batch_alter_table("calin_pack_tiers", schema=None) as batch_op:
        batch_op.alter_column("base_price_paise", new_column_name="base_price_inr", existing_type=sa.Integer())

    # 5. foods: divide by 100, rename back, drop gst_rate_percent
    op.execute("UPDATE foods SET price_paise = CAST(price_paise / 100 AS INTEGER)")
    with op.batch_alter_table("foods", schema=None) as batch_op:
        batch_op.alter_column("price_paise", new_column_name="price_inr", existing_type=sa.Integer())
        batch_op.drop_column("gst_rate_percent")
