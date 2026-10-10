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
    cookies = {"nutriverse_access": access_cookie, "nutriverse_csrf": csrf_cookie}
    bad_req = client.post(
        "/api/profile",
        cookies=cookies,
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert bad_req.status_code == 403
    assert "CSRF" in bad_req.json()["detail"]

    # 3. Mutating request with MISMATCHED X-CSRF-Token header -> MUST BE 403
    mismatch_req = client.post(
        "/api/profile",
        cookies=cookies,
        headers={"X-CSRF-Token": "completely_wrong_token"},
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert mismatch_req.status_code == 403

    # 4. Mutating request with VALID X-CSRF-Token matching cookie -> MUST BE 200
    good_req = client.post(
        "/api/profile",
        cookies=cookies,
        headers={"X-CSRF-Token": csrf_cookie},
        json={"age": 30, "sex": "male", "height_cm": 175, "weight_kg": 72, "activity_level": 1.4},
    )
    assert good_req.status_code == 200
    assert good_req.json()["calorie_target"] > 0


def test_refresh_token_rotation_and_revocation():
    """Verify refresh token rotation on /api/auth/refresh and rejection of revoked refresh tokens."""
    login_res = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    assert login_res.status_code == 200

    refresh_token = login_res.cookies.get("nutriverse_refresh")
    csrf_token = login_res.cookies.get("nutriverse_csrf")
    assert refresh_token

    # 1. Rotate refresh token
    ref_res = client.post(
        "/api/auth/refresh",
        cookies={"nutriverse_refresh": refresh_token, "nutriverse_csrf": csrf_token},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert ref_res.status_code == 200
    new_refresh = ref_res.cookies.get("nutriverse_refresh")
    assert new_refresh
    assert new_refresh != refresh_token

    # 2. Reusing OLD refresh token MUST FAIL (401 Revoked/Expired)
    old_res = client.post(
        "/api/auth/refresh",
        cookies={"nutriverse_refresh": refresh_token, "nutriverse_csrf": csrf_token},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert old_res.status_code == 401

    # 3. Explicit logout revokes the active refresh token
    logout_res = client.post(
        "/api/auth/logout",
        cookies={"nutriverse_refresh": new_refresh, "nutriverse_csrf": csrf_token},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout_res.status_code == 200

    # 4. Using revoked token after logout MUST FAIL (401)
    after_logout_res = client.post(
        "/api/auth/refresh",
        cookies={"nutriverse_refresh": new_refresh, "nutriverse_csrf": csrf_token},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert after_logout_res.status_code == 401


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
