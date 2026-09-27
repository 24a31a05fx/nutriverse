from fastapi.testclient import TestClient
from backend.app.main import app

def test_health():
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "ok"


def test_register_and_profile():
    email = "test@example.com"
    with TestClient(app) as client:
        response = client.post("/api/auth/register", json={"name": "Test User", "email": email, "password": "password123"})
        assert response.status_code in (200, 409)
        token = response.json().get("access_token") if response.status_code == 200 else client.post("/api/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        profile = client.post("/api/profile", headers=headers, json={"age": 28, "sex": "female", "height_cm": 170, "weight_kg": 68, "activity_level": 1.55})
        assert profile.status_code == 200
        assert profile.json()["calorie_target"] == 2234


def test_catalog_and_barcode():
    with TestClient(app) as client:
        response = client.get("/api/foods")
        assert response.status_code == 200
        assert response.json()
        assert client.get("/api/foods/barcode/8901234567890").status_code == 200
