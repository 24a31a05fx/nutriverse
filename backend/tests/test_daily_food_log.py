import pytest
from fastapi.testclient import TestClient
from backend.app.main import app, SessionLocal, User, Food, DailyFoodLog, PasswordHasher, Role, create_access_token


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture
def user_tokens():
    with SessionLocal() as db:
        user_a = db.query(User).filter_by(email="alex@nutriverse.local").first()
        if not user_a:
            user_a = User(
                name="Alex Mercer",
                email="alex@nutriverse.local",
                password_hash=PasswordHasher.hash("Customer123!"),
                role=Role.user.value,
            )
            db.add(user_a)
            db.commit()
            db.refresh(user_a)

        user_b = db.query(User).filter_by(email="other@nutriverse.local").first()
        if not user_b:
            user_b = User(
                name="Other User",
                email="other@nutriverse.local",
                password_hash=PasswordHasher.hash("Other123!"),
                role=Role.user.value,
            )
            db.add(user_b)
            db.commit()
            db.refresh(user_b)

        token_a = create_access_token(user_a)
        token_b = create_access_token(user_b)
        return {"token_a": token_a, "user_a": user_a, "token_b": token_b, "user_b": user_b}


def test_ai_chat_authenticated(test_client, user_tokens):
    """Verifies that authenticated users can query AI chat and receive grounded database responses."""
    headers = {"Authorization": f"Bearer {user_tokens['token_a']}"}
    res = test_client.post("/api/ai/chat?question=What%20is%20a%20good%20source%20of%20iron?", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "iron" in data["answer"].lower()
    assert "grounded_sources" in data
    assert len(data["grounded_sources"]) > 0


def test_daily_food_log_empty(test_client, user_tokens):
    """Verifies GET daily-log returns empty items and zeroed totals on an unlogged date."""
    headers = {"Authorization": f"Bearer {user_tokens['token_a']}"}
    res = test_client.get("/api/nutrition/daily-log?date=2026-01-01", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["date"] == "2026-01-01"
    assert data["items"] == []
    assert data["consumed_totals"]["calories"] == 0


def test_daily_food_log_lifecycle(test_client, user_tokens):
    """Verifies creating, aggregating, and deleting daily food logs with deterministic nutrient calculation."""
    headers_a = {"Authorization": f"Bearer {user_tokens['token_a']}"}
    headers_b = {"Authorization": f"Bearer {user_tokens['token_b']}"}

    # 1. Fetch a verified food from database
    with SessionLocal() as db:
        food = db.query(Food).filter(Food.active.is_(True)).first()
        assert food is not None
        food_id = food.id
        food_name = food.name

    test_date = "2026-10-15"

    # 2. Log food intake (200g portion)
    payload = {
        "food_id": food_id,
        "meal_type": "breakfast",
        "quantity": 200.0,
        "unit": "g",
        "date": test_date,
    }
    post_res = test_client.post("/api/nutrition/daily-log", json=payload, headers=headers_a)
    assert post_res.status_code == 200, post_res.text
    log_item = post_res.json()
    assert log_item["food_name"] == food_name
    assert log_item["quantity"] == 200.0
    assert log_item["mass_g"] == 200.0
    assert log_item["calories"] > 0
    log_id = log_item["id"]

    # 3. Retrieve daily summary and verify consumed totals
    get_res = test_client.get(f"/api/nutrition/daily-log?date={test_date}", headers=headers_a)
    assert get_res.status_code == 200
    summary = get_res.json()
    assert len(summary["items"]) >= 1
    assert summary["consumed_totals"]["calories"] == log_item["calories"]
    assert summary["consumed_totals"]["protein_g"] == log_item["protein_g"]

    # 4. Cross-user isolation: User B must not see User A's logs
    get_res_b = test_client.get(f"/api/nutrition/daily-log?date={test_date}", headers=headers_b)
    assert get_res_b.status_code == 200
    summary_b = get_res_b.json()
    assert len(summary_b["items"]) == 0
    assert summary_b["consumed_totals"]["calories"] == 0

    # 5. Cross-user isolation: User B cannot delete User A's log
    del_res_b = test_client.delete(f"/api/nutrition/daily-log/{log_id}", headers=headers_b)
    assert del_res_b.status_code == 403

    # 6. User A deletes their own log
    del_res_a = test_client.delete(f"/api/nutrition/daily-log/{log_id}", headers=headers_a)
    assert del_res_a.status_code == 200

    # 7. Confirm log is deleted
    get_res_after = test_client.get(f"/api/nutrition/daily-log?date={test_date}", headers=headers_a)
    assert get_res_after.status_code == 200
    assert len(get_res_after.json()["items"]) == 0
