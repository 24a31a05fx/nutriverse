import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.main import (
    app,
    SessionLocal,
    User,
    Order,
    NutritionProfile,
    NutritionistReviewRequest,
    AuditLog,
    Role,
    PasswordHasher,
    create_access_token,
)

client = TestClient(app)


def test_anon_cannot_read_sensitive_endpoints():
    """Phase 2 Gate: Anon cannot read health_profiles, orders, addresses, or chat."""
    client.cookies.clear()

    # 1. Profile / Health Data
    res_prof = client.get("/api/profile")
    assert res_prof.status_code == 401

    # 2. Orders list
    res_orders = client.get("/api/orders")
    assert res_orders.status_code == 401

    # 3. Order detail
    res_order_detail = client.get("/api/orders/random-order-uuid-12345")
    assert res_order_detail.status_code == 401

    # 4. Cart items
    res_cart = client.get("/api/cart")
    assert res_cart.status_code == 401

    # 5. AI Chat
    res_chat = client.post("/api/ai/chat", json={"message": "What is my calorie target?"})
    assert res_chat.status_code == 401


def test_customer_b_cannot_read_customer_a_data():
    """Phase 2 Gate: Customer B cannot read Customer A's order or health profile."""
    client.cookies.clear()

    with SessionLocal() as s:
        # User A
        email_a = f"cust_a_{uuid4().hex[:8]}@nutriverse.local"
        user_a = User(
            name="Customer Alice",
            email=email_a,
            password_hash=PasswordHasher.hash("Customer123!"),
            role=Role.user.value,
        )
        s.add(user_a)

        # User B
        email_b = f"cust_b_{uuid4().hex[:8]}@nutriverse.local"
        user_b = User(
            name="Customer Bob",
            email=email_b,
            password_hash=PasswordHasher.hash("Customer123!"),
            role=Role.user.value,
        )
        s.add(user_b)
        s.commit()
        s.refresh(user_a)
        s.refresh(user_b)

        # Customer A's Order
        order_a = Order(
            user_id=user_a.id,
            status="placed",
            subtotal_paise=19900,
            delivery_fee_paise=0,
            total_paise=19900,
            items_json='[{"name": "Organic White Quinoa", "quantity": 1}]',
            demo_payment=True,
        )
        s.add(order_a)

        # Customer A's Health Profile
        profile_a = NutritionProfile(
            user_id=user_a.id,
            age=28,
            sex="female",
            height_cm=165,
            weight_kg=60,
            activity_level=1.4,
            calorie_target=1800,
            bmr=1350,
        )
        s.add(profile_a)
        s.commit()
        s.refresh(order_a)

        order_a_id = order_a.id
        token_b = create_access_token(user_b)

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Customer B attempts to read Customer A's order -> 404 Not Found (scoped query)
    res_hack_order = client.get(f"/api/orders/{order_a_id}", headers=headers_b)
    assert res_hack_order.status_code == 404

    # Customer B list orders -> only includes Customer B's orders, NOT Customer A's
    res_b_orders = client.get("/api/orders", headers=headers_b)
    assert res_b_orders.status_code == 200
    returned_ids = [o["id"] for o in res_b_orders.json()]
    assert order_a_id not in returned_ids


def test_nutritionist_sees_only_assigned_or_unassigned_consultations():
    """Phase 2 Gate: Nutritionist 1 cannot see consultations assigned to Nutritionist 2."""
    client.cookies.clear()

    with SessionLocal() as s:
        # Nutritionist 1
        nutri_1 = User(
            name="Dr. Nutri One",
            email=f"dr1_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("Nutritionist123!"),
            role=Role.nutritionist.value,
        )
        s.add(nutri_1)

        # Nutritionist 2
        nutri_2 = User(
            name="Dr. Nutri Two",
            email=f"dr2_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("Nutritionist123!"),
            role=Role.nutritionist.value,
        )
        s.add(nutri_2)

        # Customer
        cust = User(
            name="Patient Person",
            email=f"patient_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("Customer123!"),
            role=Role.user.value,
        )
        s.add(cust)
        s.commit()
        s.refresh(nutri_1)
        s.refresh(nutri_2)
        s.refresh(cust)

        # Consultation assigned to Nutritionist 2
        assigned_to_2 = NutritionistReviewRequest(
            user_id=cust.id,
            user_name=cust.name,
            pack_tier="premium",
            customer_notes="Personal review request for Dr. Two only",
            nutritionist_id=nutri_2.id,
            nutritionist_name=nutri_2.name,
            status="pending",
        )
        s.add(assigned_to_2)
        s.commit()
        s.refresh(assigned_to_2)
        req_2_id = assigned_to_2.id

        token_nutri_1 = create_access_token(nutri_1)

    headers_nutri_1 = {"Authorization": f"Bearer {token_nutri_1}"}

    # Nutritionist 1 lists requests: MUST NOT see consultation assigned to Dr. Two
    res_list = client.get("/api/nutritionist/requests", headers=headers_nutri_1)
    assert res_list.status_code == 200
    returned_ids = [r["id"] for r in res_list.json()]
    assert req_2_id not in returned_ids


def test_users_cannot_self_grant_privileged_roles():
    """Phase 2 Gate: Public registration attempts with role='admin' or 'nutritionist' are forced to 'user'."""
    client.cookies.clear()

    # 1. Attempt admin self-grant
    email_admin_attempt = f"escalate_admin_{uuid4().hex[:8]}@nutriverse.local"
    res_admin_attempt = client.post(
        "/api/auth/register",
        json={
            "name": "Attacker Trying Admin",
            "email": email_admin_attempt,
            "password": "SecurePassword123!",
            "role": "admin",
        },
    )
    assert res_admin_attempt.status_code == 200
    assert res_admin_attempt.json()["role"] == Role.user.value

    # Verify persisted row in DB
    with SessionLocal() as s:
        db_user = s.scalar(select(User).where(User.email == email_admin_attempt))
        assert db_user is not None
        assert db_user.role == Role.user.value
        assert db_user.role != Role.admin.value

    # 2. Attempt nutritionist self-grant
    client.cookies.clear()
    email_nutri_attempt = f"escalate_nutri_{uuid4().hex[:8]}@nutriverse.local"
    res_nutri_attempt = client.post(
        "/api/auth/register",
        json={
            "name": "Attacker Trying Nutri",
            "email": email_nutri_attempt,
            "password": "SecurePassword123!",
            "role": "nutritionist",
        },
    )
    assert res_nutri_attempt.status_code == 200
    assert res_nutri_attempt.json()["role"] == Role.user.value

    with SessionLocal() as s:
        db_nutri = s.scalar(select(User).where(User.email == email_nutri_attempt))
        assert db_nutri is not None
        assert db_nutri.role == Role.user.value
        assert db_nutri.role != Role.nutritionist.value


def test_audit_log_is_append_only():
    """Phase 2 Gate: Audit log records are append-only; update/delete operations are disallowed."""
    client.cookies.clear()

    # Login as Admin
    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@nutriverse.local", "password": "AdminPass123!"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    with SessionLocal() as s:
        log = AuditLog(
            user_id="admin-id",
            action="stock_adjustment",
            entity_type="food",
            entity_id="test-food-id",
            details='{"old": 10, "new": 20}',
        )
        s.add(log)
        s.commit()
        s.refresh(log)
        log_id = log.id

    # 1. Verify GET /api/admin/audit-logs succeeds for Admin
    res_get = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert res_get.status_code == 200

    # 2. Verify DELETE on audit log is blocked (405 Method Not Allowed or 404)
    res_del = client.delete(f"/api/admin/audit-logs/{log_id}", headers=admin_headers)
    assert res_del.status_code in (404, 405)

    # 3. Verify PUT/PATCH on audit log is blocked (405 Method Not Allowed or 404)
    res_put = client.put(f"/api/admin/audit-logs/{log_id}", headers=admin_headers, json={"action": "tampered"})
    assert res_put.status_code in (404, 405)
