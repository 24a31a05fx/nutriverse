"""Committed proof of paise data-migration upgrade and downgrade invariance across SQLite and PostgreSQL."""
import json
import os
import tempfile
from datetime import datetime, timezone
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool


def _run_paise_lifecycle_test_on_url(db_url: str):
    """Executes the full migration lifecycle test against a specific database URL:
    1. Upgrades fresh database to baseline revision a5d2dd3a04f9 (before paise_migration)
    2. Inserts known rows: foods (199, 33), calin_pack_tiers (1099), cart_items, orders with items, subscriptions
    3. Upgrades to head (c0a2e9def992 + 186a6ecddb56) and asserts:
       - Every price/amount column equals old * 100 exactly
       - Order total equals sum of line items + delivery fee
       - foods.gst_rate_percent column exists and is nullable
    4. Downgrades to a5d2dd3a04f9 and asserts:
       - Every price/amount column equals original value exactly
       - Order total still equals sum of line items + delivery fee
       - foods.gst_rate_percent column is dropped
    """
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to revision BEFORE paise_migration (a5d2dd3a04f9)
    command.upgrade(cfg, "a5d2dd3a04f9")

    engine = create_engine(db_url, poolclass=NullPool)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # 2. Insert test fixtures into baseline schema using parameterized types
    with engine.begin() as conn:
        # User
        conn.execute(
            text("INSERT INTO users (id, name, email, password_hash, role, created_at) "
                 "VALUES (:id, :name, :email, :pw, :role, :created_at)"),
            {"id": "u-proof-1", "name": "Proof User", "email": "proof@example.com", "pw": "hash123", "role": "user", "created_at": now}
        )

        # Foods (with unusual prices: 199 and 33 INR)
        conn.execute(
            text("INSERT INTO foods (id, name, barcode, category, nutrition_tags, description, price_inr, unit, "
                 "serving_size, stock_qty, calories, protein_g, carbs_g, fat_g, fibre_g, vitamins_json, "
                 "ingredients, storage_info, prep_methods, dietary_tags, emoji, active) VALUES "
                 "(:id1, :name1, :bc1, :cat1, '[]', 'Bioavailable sprouted grain', 199, '500g', '100g', 50, 120.0, 5.0, 22.0, 1.5, 3.0, '{}', 'Quinoa', 'Cool place', '[]', '[]', '🌾', :active), "
                 "(:id2, :name2, :bc2, :cat2, '[]', 'Mineral rich seasoning', 33, '100g', '5g', 100, 5.0, 0.1, 0.5, 0.0, 0.0, '{}', 'Herb Salt', 'Airtight container', '[]', '[]', '🧂', :active)"),
            {
                "id1": "f-199", "name1": "Sprouted Quinoa Special", "bc1": "8901111222333", "cat1": "Grains",
                "id2": "f-33", "name2": "Himalayan Rock Salt Herb", "bc2": "8901111222444", "cat2": "Spices",
                "active": True
            }
        )

        # Calin Pack Tier (unusual price: 1099 INR)
        conn.execute(
            text("INSERT INTO calin_pack_tiers (id, tier, name, base_price_inr, description, target_audience, max_substitutions, items_json, active) "
                 "VALUES (:id, :tier, :name, 1099, 'A test pack', 'Audience', 2, '[]', :active)"),
            {"id": "p-1099", "tier": "proof_tier", "name": "Proof Calin Pack", "active": True}
        )

        # Cart Item (2 units of f-199 at 199 INR each)
        conn.execute(
            text("INSERT INTO cart_items (id, user_id, item_type, food_id, pack_tier, pack_name, customization_json, unit_price_inr, quantity) "
                 "VALUES ('c-1', 'u-proof-1', 'food', 'f-199', NULL, NULL, NULL, 199, 2)")
        )

        # Order with items:
        # Line 1: 2 units of f-199 at 199 INR = 398 INR
        # Line 2: 1 unit of f-33 at 33 INR = 33 INR
        # Subtotal: 398 + 33 = 431 INR
        # Delivery Fee: 49 INR
        # Total: 431 + 49 = 480 INR
        order_items_payload = [
            {"food_id": "f-199", "name": "Sprouted Quinoa Special", "quantity": 2, "unit_price_inr": 199, "total_inr": 398},
            {"food_id": "f-33", "name": "Himalayan Rock Salt Herb", "quantity": 1, "unit_price_inr": 33, "total_inr": 33},
        ]
        conn.execute(
            text("INSERT INTO orders (id, user_id, status, subtotal_inr, delivery_fee_inr, total_inr, items_json, delivery_address_json, demo_payment, created_at, updated_at) "
                 "VALUES ('o-proof-1', 'u-proof-1', 'placed', 431, 49, 480, :items, '{}', :demo, :now, :now)"),
            {"items": json.dumps(order_items_payload), "demo": True, "now": now}
        )

        # Subscription (1099 INR per delivery)
        conn.execute(
            text("INSERT INTO subscriptions (id, user_id, pack_tier, pack_name, frequency, status, price_per_delivery_inr, next_delivery_date, created_at) "
                 "VALUES ('s-proof-1', 'u-proof-1', 'proof_tier', 'Proof Calin Pack', 'weekly', 'active', 1099, :now, :now)"),
            {"now": now}
        )

        # Nutrition Profile (1500 INR budget)
        conn.execute(
            text("INSERT INTO nutrition_profiles (id, user_id, age, sex, height_cm, weight_kg, activity_level, calorie_target, bmr, food_preferences, allergies, budget_inr, goal, calculation_version, updated_at) "
                 "VALUES ('np-proof-1', 'u-proof-1', 28, 'female', 168.0, 62.0, 1.375, 2000, 1400, 'Vegan', 'None', 1500, 'Goal', 'v1', :now)"),
            {"now": now}
        )

    # 3. Upgrade to revision with paise_migration + indexes (186a6ecddb56)
    command.upgrade(cfg, "186a6ecddb56")

    # 4. Assert all prices/amounts in the database equal old * 100 exactly
    with engine.connect() as conn:
        # Check foods
        f199 = conn.execute(text("SELECT price_paise, gst_rate_percent FROM foods WHERE id = 'f-199'")).fetchone()
        f33 = conn.execute(text("SELECT price_paise, gst_rate_percent FROM foods WHERE id = 'f-33'")).fetchone()
        assert f199[0] == 199 * 100, f"Expected 19900 paise, got {f199[0]}"
        assert f33[0] == 33 * 100, f"Expected 3300 paise, got {f33[0]}"
        assert f199[1] is None, "gst_rate_percent should be nullable None initially"

        # Check calin_pack_tiers
        tier = conn.execute(text("SELECT base_price_paise FROM calin_pack_tiers WHERE id = 'p-1099'")).fetchone()
        assert tier[0] == 1099 * 100, f"Expected 109900 paise, got {tier[0]}"

        # Check cart_items
        cart = conn.execute(text("SELECT unit_price_paise, quantity FROM cart_items WHERE id = 'c-1'")).fetchone()
        assert cart[0] == 199 * 100, f"Expected 19900 paise, got {cart[0]}"
        assert cart[1] == 2

        # Check orders
        order = conn.execute(text("SELECT subtotal_paise, delivery_fee_paise, total_paise, items_json FROM orders WHERE id = 'o-proof-1'")).fetchone()
        subtotal_paise = order[0]
        delivery_fee_paise = order[1]
        total_paise = order[2]
        items = json.loads(order[3])

        assert subtotal_paise == 431 * 100, f"Expected subtotal 43100 paise, got {subtotal_paise}"
        assert delivery_fee_paise == 49 * 100, f"Expected delivery fee 4900 paise, got {delivery_fee_paise}"
        assert total_paise == 480 * 100, f"Expected total 48000 paise, got {total_paise}"

        # Assert items_json embedded prices
        assert len(items) == 2
        assert items[0]["unit_price_paise"] == 199 * 100
        assert items[0]["total_paise"] == 398 * 100
        assert items[1]["unit_price_paise"] == 33 * 100
        assert items[1]["total_paise"] == 33 * 100

        # Assert order total equals exact sum of item totals + delivery fee
        items_sum = sum(it["total_paise"] for it in items)
        assert items_sum == subtotal_paise
        assert total_paise == items_sum + delivery_fee_paise

        # Check subscriptions
        sub = conn.execute(text("SELECT price_per_delivery_paise FROM subscriptions WHERE id = 's-proof-1'")).fetchone()
        assert sub[0] == 1099 * 100, f"Expected 109900 paise, got {sub[0]}"

        # Check nutrition_profiles
        np = conn.execute(text("SELECT budget_paise FROM nutrition_profiles WHERE id = 'np-proof-1'")).fetchone()
        assert np[0] == 1500 * 100, f"Expected 150000 paise, got {np[0]}"

    # 5. Downgrade back to a5d2dd3a04f9
    command.downgrade(cfg, "a5d2dd3a04f9")

    # 6. Assert all values are restored to original exact values
    with engine.connect() as conn:
        insp = inspect(conn)
        food_columns = [col["name"] for col in insp.get_columns("foods")]
        assert "price_inr" in food_columns, "price_inr column must be restored"
        assert "price_paise" not in food_columns, "price_paise column must be removed"
        assert "gst_rate_percent" not in food_columns, "gst_rate_percent column must be dropped"

        f199_down = conn.execute(text("SELECT price_inr FROM foods WHERE id = 'f-199'")).fetchone()
        f33_down = conn.execute(text("SELECT price_inr FROM foods WHERE id = 'f-33'")).fetchone()
        assert f199_down[0] == 199, f"Expected 199 INR, got {f199_down[0]}"
        assert f33_down[0] == 33, f"Expected 33 INR, got {f33_down[0]}"

        tier_down = conn.execute(text("SELECT base_price_inr FROM calin_pack_tiers WHERE id = 'p-1099'")).fetchone()
        assert tier_down[0] == 1099, f"Expected 1099 INR, got {tier_down[0]}"

        cart_down = conn.execute(text("SELECT unit_price_inr FROM cart_items WHERE id = 'c-1'")).fetchone()
        assert cart_down[0] == 199, f"Expected 199 INR, got {cart_down[0]}"

        order_down = conn.execute(text("SELECT subtotal_inr, delivery_fee_inr, total_inr, items_json FROM orders WHERE id = 'o-proof-1'")).fetchone()
        assert order_down[0] == 431, f"Expected subtotal 431 INR, got {order_down[0]}"
        assert order_down[1] == 49, f"Expected delivery fee 49 INR, got {order_down[1]}"
        assert order_down[2] == 480, f"Expected total 480 INR, got {order_down[2]}"

        items_down = json.loads(order_down[3])
        assert items_down[0]["unit_price_inr"] == 199
        assert items_down[0]["total_inr"] == 398
        assert items_down[1]["unit_price_inr"] == 33
        assert items_down[1]["total_inr"] == 33
        assert sum(it["total_inr"] for it in items_down) + order_down[1] == order_down[2]

        sub_down = conn.execute(text("SELECT price_per_delivery_inr FROM subscriptions WHERE id = 's-proof-1'")).fetchone()
        assert sub_down[0] == 1099, f"Expected 1099 INR, got {sub_down[0]}"

        np_down = conn.execute(text("SELECT budget_inr FROM nutrition_profiles WHERE id = 'np-proof-1'")).fetchone()
        assert np_down[0] == 1500, f"Expected 1500 INR, got {np_down[0]}"

    engine.dispose()


def test_paise_migration_proof_sqlite():
    """Verify paise migration lifecycle (upgrade + downgrade invariance) on SQLite."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        url = f"sqlite:///{tmp_db_path}"
        _run_paise_lifecycle_test_on_url(url)
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except OSError:
                pass


def test_paise_migration_proof_postgres():
    """Verify paise migration lifecycle (upgrade + downgrade invariance) on PostgreSQL."""
    import psycopg2

    base_url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not base_url:
        pytest.skip("PostgreSQL proof requires TEST_DATABASE_URL or DATABASE_URL")

    admin_url = make_url(base_url)
    if not admin_url.drivername.startswith("postgresql"):
        pytest.skip("PostgreSQL proof requires a PostgreSQL database URL")

    pg_host = admin_url.host or "localhost"
    pg_port = admin_url.port or 5432
    pg_user = admin_url.username
    pg_pass = admin_url.password
    pg_database = admin_url.database

    admin_conn = psycopg2.connect(
        host=pg_host, port=pg_port, user=pg_user, password=pg_pass, dbname=pg_database
    )
    admin_conn.autocommit = True
    test_db = f"nutriverse_paise_proof_{os.getpid()}"

    with admin_conn.cursor() as cur:
        try:
            cur.execute(f"DROP DATABASE IF EXISTS {test_db} WITH (FORCE);")
        except Exception:
            cur.execute(f"DROP DATABASE IF EXISTS {test_db};")
        cur.execute(f"CREATE DATABASE {test_db};")

    test_url = admin_url.set(
        drivername="postgresql+psycopg2",
        database=test_db,
    ).render_as_string(hide_password=False)
    try:
        _run_paise_lifecycle_test_on_url(test_url)
    finally:
        try:
            # Terminate any remaining connections to test_db before dropping
            with admin_conn.cursor() as cur:
                cur.execute(f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{test_db}' AND pid <> pg_backend_pid();")
                try:
                    cur.execute(f"DROP DATABASE IF EXISTS {test_db} WITH (FORCE);")
                except Exception:
                    cur.execute(f"DROP DATABASE IF EXISTS {test_db};")
        except Exception:
            pass
        finally:
            admin_conn.close()
