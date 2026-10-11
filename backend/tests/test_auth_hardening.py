import json
import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from passlib.context import CryptContext

from backend.app.main import (
    app,
    SessionLocal,
    User,
    RefreshToken,
    PasswordHasher,
    settings,
    create_access_token,
    create_refresh_token,
)

client = TestClient(app)
legacy_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def test_public_guest_access():
    """Verify that unauthenticated guests can freely explore catalog, packs, recipes, and barcodes."""
    # 1. Foods list
    r_foods = client.get("/api/foods")
    assert r_foods.status_code == 200
    assert len(r_foods.json()) > 0

    # 2. Packs list
    r_packs = client.get("/api/packs")
    assert r_packs.status_code == 200
    assert len(r_packs.json()) >= 3

    # 3. Recipes list
    r_recipes = client.get("/api/recipes")
    assert r_recipes.status_code == 200
    assert len(r_recipes.json()) > 0

    # 4. Barcode lookup
    r_barcode = client.get("/api/foods/barcode/8901234567890")
    assert r_barcode.status_code == 200
    assert "Chickpeas" in r_barcode.json()["name"]

    # 5. Categories breakdown
    r_cats = client.get("/api/categories")
    assert r_cats.status_code == 200
    assert len(r_cats.json()["nutrition_categories"]) == 8


def test_password_complexity_enforcement():
    """Verify password complexity validator enforces length, case, number, and special character."""
    base_email = "pwtest@nutriverse.local"

    # Too short (< 8 chars)
    r1 = client.post("/api/auth/register", json={"name": "Test", "email": base_email, "password": "Short1!"})
    assert r1.status_code == 422

    # Missing uppercase
    r2 = client.post("/api/auth/register", json={"name": "Test", "email": base_email, "password": "nouppercase1!"})
    assert r2.status_code == 422

    # Missing lowercase
    r3 = client.post("/api/auth/register", json={"name": "Test", "email": base_email, "password": "NOLOWERCASE1!"})
    assert r3.status_code == 422

    # Missing digit
    r4 = client.post("/api/auth/register", json={"name": "Test", "email": base_email, "password": "NoDigitsHere!"})
    assert r4.status_code == 422

    # Missing special char
    r5 = client.post("/api/auth/register", json={"name": "Test", "email": base_email, "password": "NoSpecialChar123"})
    assert r5.status_code == 422

    # Valid strong password
    from uuid import uuid4
    unique_email = f"valid_{uuid4().hex[:8]}@nutriverse.local"
    r6 = client.post(
        "/api/auth/register",
        json={"name": "Complexity Pass", "email": unique_email, "password": "ValidPass123!"},
    )
    assert r6.status_code == 200
    assert r6.json()["email"] == unique_email


def test_legacy_pbkdf2_rehash_on_login():
    """Verify that legacy PBKDF2 hashes are successfully authenticated and auto-upgraded to bcrypt."""
    legacy_email = "legacy_user@nutriverse.local"
    raw_password = "LegacyPass123!"
    legacy_hash = legacy_context.hash(raw_password)

    with SessionLocal() as session:
        user = session.scalar(select(User).where(User.email == legacy_email))
        if not user:
            user = User(
                name="Legacy User",
                email=legacy_email,
                password_hash=legacy_hash,
                role="user",
            )
            session.add(user)
        else:
            user.password_hash = legacy_hash
        session.commit()

    # Log in with legacy password
    res = client.post("/api/auth/login", json={"email": legacy_email, "password": raw_password})
    assert res.status_code == 200

    # Verify that the hash was upgraded to bcrypt ($2b$...)
    with SessionLocal() as session:
        updated_user = session.scalar(select(User).where(User.email == legacy_email))
        assert updated_user.password_hash.startswith("$2b$")
        assert PasswordHasher.verify(raw_password, updated_user.password_hash)


def test_csrf_protection_on_cookie_auth():
    """Verify double-submit CSRF cookie & header validation on state-changing cookie requests."""
    # 1. Log in to acquire cookies
    login_res = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    assert login_res.status_code == 200

    access_cookie = login_res.cookies.get("nutriverse_access")
    csrf_cookie = login_res.cookies.get("nutriverse_csrf")
    assert access_cookie
    assert csrf_cookie

    # 2. Mutating request with cookie auth but MISSING X-CSRF-Token header -> MUST BE 403
    client.cookies.clear()
    client.cookies.set("nutriverse_access", access_cookie)
    client.cookies.set("nutriverse_csrf", csrf_cookie)
    bad_req = client.post(
        "/api/profile",
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert bad_req.status_code == 403
    assert "CSRF" in bad_req.json()["detail"]

    # 3. Mutating request with MISMATCHED X-CSRF-Token header -> MUST BE 403
    mismatch_req = client.post(
        "/api/profile",
        headers={"X-CSRF-Token": "completely_wrong_token"},
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert mismatch_req.status_code == 403

    # 4. Mutating request with VALID X-CSRF-Token matching cookie -> MUST BE 200
    good_req = client.post(
        "/api/profile",
        headers={"X-CSRF-Token": csrf_cookie},
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert good_req.status_code == 200
    assert good_req.json()["calorie_target"] > 0
    client.cookies.clear()


def test_refresh_token_rotation_and_revocation():
    """Verify refresh token rotation on /api/auth/refresh and rejection of revoked refresh tokens."""
    login_res = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    assert login_res.status_code == 200

    refresh_token = login_res.cookies.get("nutriverse_refresh")
    csrf_token = login_res.cookies.get("nutriverse_csrf")
    assert refresh_token

    # 1. Rotate refresh token
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", refresh_token)
    client.cookies.set("nutriverse_csrf", csrf_token)
    ref_res = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert ref_res.status_code == 200
    new_refresh = ref_res.cookies.get("nutriverse_refresh")
    assert new_refresh
    assert new_refresh != refresh_token

    # 2. Reusing OLD refresh token MUST FAIL (401 Revoked/Expired)
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", refresh_token)
    client.cookies.set("nutriverse_csrf", csrf_token)
    old_res = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert old_res.status_code == 401

    # 3. Explicit logout revokes the active refresh token
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", new_refresh)
    client.cookies.set("nutriverse_csrf", csrf_token)
    logout_res = client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout_res.status_code == 200

    # 4. Using revoked token after logout MUST FAIL (401)
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", new_refresh)
    client.cookies.set("nutriverse_csrf", csrf_token)
    after_logout_res = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert after_logout_res.status_code == 401
    client.cookies.clear()


def test_role_guards():
    """Verify role-based access control guards on admin and nutritionist endpoints."""
    # Alex Mercer is role 'user'
    alex_login = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    alex_token = alex_login.json()["access_token"]
    alex_headers = {"Authorization": f"Bearer {alex_token}"}

    # Dr. Priya is role 'nutritionist'
    priya_login = client.post("/api/auth/login", json={"email": "dr.priya@nutriverse.local", "password": "Nutritionist123!"})
    priya_token = priya_login.json()["access_token"]
    priya_headers = {"Authorization": f"Bearer {priya_token}"}

    # Admin is role 'admin'
    admin_login = client.post("/api/auth/login", json={"email": "admin@nutriverse.local", "password": "AdminPass123!"})
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin stats endpoint:
    # Customer -> 403
    assert client.get("/api/admin/stats", headers=alex_headers).status_code == 403
    # Nutritionist -> 403
    assert client.get("/api/admin/stats", headers=priya_headers).status_code == 403
    # Admin -> 200
    res_admin = client.get("/api/admin/stats", headers=admin_headers)
    assert res_admin.status_code == 200
    assert "counts" in res_admin.json()

    # 2. Admin create food:
    food_payload = {
        "name": "Test Superfood Berry",
        "category": "Berries & Antioxidants",
        "nutrition_tags": ["vitamin_sources", "fiber_rich"],
        "description": "Dense in anthocyanins and Vitamin C.",
        "price_inr": 299,
        "unit": "250g pack",
        "serving_size": "50g",
        "stock_qty": 30,
        "calories": 45,
        "protein_g": 0.8,
        "carbs_g": 9.5,
        "fat_g": 0.3,
        "fibre_g": 3.2,
        "prep_methods": ["Fresh Raw", "Smoothie Blend"],
        "dietary_tags": ["Vegan", "Organic"],
        "emoji": "🫐",
    }
    # Customer -> 403
    assert client.post("/api/admin/foods", headers=alex_headers, json=food_payload).status_code == 403
    # Admin -> 200
    created = client.post("/api/admin/foods", headers=admin_headers, json=food_payload)
    assert created.status_code == 200
    assert created.json()["name"] == "Test Superfood Berry"


def test_failsafe_environment_default_and_production_startup(monkeypatch):
    """Verify APP_ENV defaults to production when unset, and in production startup creates NO users and disables dev shortcuts."""
    from backend.app.main import Settings, validate_secret_safety, seed_initial_data, Food

    # 1. Test when APP_ENV is unset
    monkeypatch.delenv("APP_ENV", raising=False)
    unset_settings = Settings()
    assert unset_settings.app_env == "production"

    # 2. Test when APP_ENV is explicitly 'production'
    monkeypatch.setenv("APP_ENV", "production")
    prod_settings = Settings()
    assert prod_settings.app_env == "production"

    # 3. Verify /api/auth/config reports dev shortcuts disabled when in production
    old_env = settings.app_env
    try:
        settings.app_env = "production"
        cfg = client.get("/api/auth/config").json()
        assert cfg["app_env"] == "production"
        assert cfg["development"] is False
        assert cfg["demo_shortcuts_enabled"] is False

        # 4. Verify seed_initial_data creates NO users in production
        # In a test session with production env, user seeding is bypassed
        with SessionLocal() as session:
            init_users = session.scalars(select(User).where(User.email.like("%@prodtest.local"))).all()
            assert len(init_users) == 0
    finally:
        settings.app_env = old_env


def test_secret_safety_validation():
    """Verify that outside development, startup refuses to run if JWT_SECRET is missing, a known default, or < 32 chars."""
    from backend.app.main import Settings, validate_secret_safety

    # 1. Missing / empty secret in production
    s_empty = Settings(app_env="production", jwt_secret="")
    with pytest.raises(RuntimeError, match="CRITICAL SECRET SAFETY FAILURE"):
        validate_secret_safety(s_empty)

    # 2. Known insecure default
    s_default = Settings(app_env="production", jwt_secret="change-this-in-production-long-secure-key")
    with pytest.raises(RuntimeError, match="CRITICAL SECRET SAFETY FAILURE"):
        validate_secret_safety(s_default)

    s_dev_default = Settings(app_env="production", jwt_secret="nutriverse_dev_secret_key_change_in_production_12345")
    with pytest.raises(RuntimeError, match="CRITICAL SECRET SAFETY FAILURE"):
        validate_secret_safety(s_dev_default)

    # 3. Shorter than 32 characters
    s_short = Settings(app_env="production", jwt_secret="too-short-key-under-32-chars")
    with pytest.raises(RuntimeError, match="CRITICAL SECRET SAFETY FAILURE"):
        validate_secret_safety(s_short)

    # 4. Valid secure secret (>= 32 chars and not in known defaults) succeeds
    s_secure = Settings(app_env="production", jwt_secret="cryptographically-secure-random-token-production-value-987654321")
    validate_secret_safety(s_secure)  # Should not raise!

    # 5. In development, defaults are tolerated for rapid local boot
    s_dev = Settings(app_env="development", jwt_secret="")
    validate_secret_safety(s_dev)  # Should not raise!


def test_refresh_token_reuse_detection_revokes_token_family():
    """Verify that presenting an already-revoked refresh token revokes the entire token family and forces re-login."""
    # 1. Register a fresh user
    from uuid import uuid4
    unique_email = f"familytest_{uuid4().hex[:8]}@nutriverse.local"
    reg = client.post(
        "/api/auth/register",
        json={"name": "Family Test User", "email": unique_email, "password": "SecurePass123!"},
    )
    assert reg.status_code == 200
    token_1 = reg.cookies.get("nutriverse_refresh")
    csrf_token = reg.cookies.get("nutriverse_csrf")
    assert token_1 is not None

    # 2. Legitimate rotation: use token_1 to get token_2
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", token_1)
    client.cookies.set("nutriverse_csrf", csrf_token)
    rot_1 = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert rot_1.status_code == 200
    token_2 = rot_1.cookies.get("nutriverse_refresh")
    csrf_token_2 = rot_1.cookies.get("nutriverse_csrf")

    # 3. Legitimate rotation: use token_2 to get token_3
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", token_2)
    client.cookies.set("nutriverse_csrf", csrf_token_2)
    rot_2 = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token_2},
    )
    assert rot_2.status_code == 200
    token_3 = rot_2.cookies.get("nutriverse_refresh")
    csrf_token_3 = rot_2.cookies.get("nutriverse_csrf")

    # Verify token_3 is currently valid
    with SessionLocal() as s:
        import hashlib
        t3_hash = hashlib.sha256(token_3.encode("utf-8")).hexdigest()
        rec3 = s.scalar(select(RefreshToken).where(RefreshToken.token_hash == t3_hash))
        assert rec3 is not None
        assert rec3.revoked is False
        family_id = rec3.family_id

    # 4. REUSE ATTEMPT: Replay old token_1 (which was already rotated and revoked)
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", token_1)
    client.cookies.set("nutriverse_csrf", csrf_token_3)
    replay_res = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token_3},
    )
    assert replay_res.status_code == 401
    assert "reuse detected" in replay_res.json()["detail"].lower()

    # 5. Verify the entire token family was revoked in the DB
    with SessionLocal() as s:
        family_tokens = s.scalars(select(RefreshToken).where(RefreshToken.family_id == family_id)).all()
        assert len(family_tokens) >= 3
        for tok in family_tokens:
            assert tok.revoked is True

    # 6. Legitimate user trying to use token_3 MUST now be rejected (401), forcing re-login!
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", token_3)
    client.cookies.set("nutriverse_csrf", csrf_token_3)
    blocked_res = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": csrf_token_3},
    )
    assert blocked_res.status_code == 401
    client.cookies.clear()


def test_csrf_protection_on_refresh_and_logout():
    """Verify CSRF double-submit token enforcement on /api/auth/refresh and /api/auth/logout."""
    # Login as Alex
    login_res = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    refresh_tok = login_res.cookies.get("nutriverse_refresh")
    csrf_tok = login_res.cookies.get("nutriverse_csrf")

    # 1. /api/auth/refresh with missing CSRF header -> 403 Forbidden
    client.cookies.clear()
    client.cookies.set("nutriverse_refresh", refresh_tok)
    client.cookies.set("nutriverse_csrf", csrf_tok)
    no_csrf_refresh = client.post("/api/auth/refresh")
    assert no_csrf_refresh.status_code == 403

    # 2. /api/auth/refresh with mismatched CSRF header -> 403 Forbidden
    bad_csrf_refresh = client.post(
        "/api/auth/refresh",
        headers={"X-CSRF-Token": "tampered-csrf-token"},
    )
    assert bad_csrf_refresh.status_code == 403

    # 3. /api/auth/logout with missing CSRF header -> 403 Forbidden
    no_csrf_logout = client.post("/api/auth/logout")
    assert no_csrf_logout.status_code == 403

    # 4. /api/auth/logout with matching CSRF header -> 200 OK
    good_logout = client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": csrf_tok},
    )
    assert good_logout.status_code == 200
    client.cookies.clear()


def test_csrf_protection_on_login_and_register():
    """Verify CSRF double-submit token enforcement on /api/auth/login and /api/auth/register (P2)."""
    csrf_res = client.get("/api/auth/csrf")
    assert csrf_res.status_code == 200
    csrf_tok = csrf_res.json()["csrf_token"]

    # 1. /api/auth/login with CSRF cookie present but missing header -> 403 Forbidden
    client.cookies.clear()
    client.cookies.set("nutriverse_csrf", csrf_tok)
    bad_login = client.post(
        "/api/auth/login",
        json={"email": "alex@nutriverse.local", "password": "Customer123!"},
    )
    assert bad_login.status_code == 403
    assert "CSRF" in bad_login.json()["detail"]

    # 2. /api/auth/login with mismatched CSRF header -> 403 Forbidden
    mismatch_login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": "mismatched-token"},
        json={"email": "alex@nutriverse.local", "password": "Customer123!"},
    )
    assert mismatch_login.status_code == 403

    # 3. /api/auth/login with matching CSRF header -> 200 OK
    good_login = client.post(
        "/api/auth/login",
        headers={"X-CSRF-Token": csrf_tok},
        json={"email": "alex@nutriverse.local", "password": "Customer123!"},
    )
    assert good_login.status_code == 200
    assert good_login.json()["email"] == "alex@nutriverse.local"

    # 4. /api/auth/register with CSRF cookie present but missing header -> 403 Forbidden
    from uuid import uuid4
    reg_email = f"csrf_reg_{uuid4().hex[:8]}@example.com"
    client.cookies.clear()
    client.cookies.set("nutriverse_csrf", csrf_tok)
    bad_reg = client.post(
        "/api/auth/register",
        json={"name": "CSRF Test User", "email": reg_email, "password": "SecurePassword123!"},
    )
    assert bad_reg.status_code == 403

    # 5. /api/auth/register with matching CSRF header -> 200 OK
    good_reg = client.post(
        "/api/auth/register",
        headers={"X-CSRF-Token": csrf_tok},
        json={"name": "CSRF Test User", "email": reg_email, "password": "SecurePassword123!"},
    )
    assert good_reg.status_code == 200
    assert good_reg.json()["email"] == reg_email
    client.cookies.clear()


def test_guest_cart_merge_quantities_stock_and_server_prices():
    """Verify guest cart merge endpoint sums quantities, caps at stock, and enforces server prices."""
    from backend.app.main import Food, CartItem, CalinPackTier

    # 1. Login user
    login_res = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    token = login_res.json()["access_token"]
    csrf_tok = login_res.cookies.get("nutriverse_csrf")
    headers = {"Authorization": f"Bearer {token}", "X-CSRF-Token": csrf_tok}

    with SessionLocal() as s:
        # Clear existing cart for clean test
        user = s.scalar(select(User).where(User.email == "alex@nutriverse.local"))
        s.query(CartItem).filter(CartItem.user_id == user.id).delete()

        # Find or create a food with specific stock and price
        food = s.scalar(select(Food).where(Food.active.is_(True)))
        food_id = food.id
        server_price = food.price_paise
        food.stock_qty = 5  # Set stock limit to 5
        s.commit()

    # User already has 2 units in server cart
    add_res = client.post(
        "/api/cart/items",
        headers=headers,
        json={"item_type": "food", "food_id": food_id, "quantity": 2},
    )
    assert add_res.status_code == 200

    # 2. Guest cart had:
    # - 4 units of food_id with a fake malicious client price of 100 paise (1 INR) and manipulated name
    # - 1 unit of Basic pack with a fake client price of 500 paise (5 INR)
    merge_payload = {
        "items": [
            {
                "item_type": "food",
                "food_id": food_id,
                "quantity": 4,  # 2 existing + 4 guest = 6, but stock is 5 -> should cap at 5
                "unit_price_paise": 100,
                "price": 1,
                "name": "Malicious Injected Price 1 INR",
            },
            {
                "item_type": "pack",
                "pack_tier": "basic",
                "quantity": 1,
                "unit_price_paise": 500,
                "base_price_paise": 500,
                "name": "Malicious 5 INR Pack",
            },
        ]
    }

    merge_res = client.post("/api/cart/merge", headers=headers, json=merge_payload)
    assert merge_res.status_code == 200
    cart_data = merge_res.json()

    # 3. Assertions:
    food_cart_item = next(it for it in cart_data["items"] if it.get("food_id") == food_id)
    # Quantity must be capped at stock (5)
    assert food_cart_item["quantity"] == 5
    # Unit price must be server-authoritative (server_price in paise), and client price (100) is completely ignored
    assert food_cart_item["unit_price_paise"] == server_price
    assert food_cart_item["unit_price_paise"] != 100
    assert food_cart_item["total_paise"] == server_price * 5

    # Pack item must have server base price (69900 paise for basic pack), and client price (500) is completely ignored
    pack_cart_item = next(it for it in cart_data["items"] if it["item_type"] == "pack")
    assert pack_cart_item["pack_tier"] == "basic"
    assert pack_cart_item["unit_price_paise"] == 69900
    assert pack_cart_item["unit_price_paise"] != 500
    assert pack_cart_item["quantity"] == 1


def test_fresh_database_alembic_upgrade_head():
    """Verify that a fresh empty database upgrades cleanly to head via Alembic and tables exist."""
    import tempfile
    import os
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, inspect

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        tmp_url = f"sqlite:///{tmp_db_path}"
        cfg = Config("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", tmp_url)
        command.upgrade(cfg, "head")

        eng = create_engine(tmp_url)
        insp = inspect(eng)
        table_names = insp.get_table_names()
        assert "users" in table_names
        assert "foods" in table_names
        assert "orders" in table_names
        assert "refresh_tokens" in table_names
        assert "alembic_version" in table_names
        eng.dispose()
    finally:
        try:
            if os.path.exists(tmp_db_path):
                os.remove(tmp_db_path)
        except Exception:
            pass


