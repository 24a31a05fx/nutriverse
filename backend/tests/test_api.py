from fastapi.testclient import TestClient
from backend.app.main import Food, SessionLocal, app

client = TestClient(app)


def test_health_and_ready():
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/ready").json()["status"] == "ready"


def test_auth_and_roles():
    # Register customer
    email = "customer_test@example.com"
    reg = client.post("/api/auth/register", json={"name": "Test Customer", "email": email, "password": "Password123!"})
    assert reg.status_code in (200, 409)

    client.cookies.clear()
    login = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    assert token

    # Check /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_nutrition_profile_mifflin():
    email = "alex@nutriverse.local"
    login = client.post("/api/auth/login", json={"email": email, "password": "Customer123!"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Female, 28 years, 170cm, 68kg, 1.55 activity
    # BMR = 10*68 + 6.25*170 - 5*28 - 161 = 680 + 1062.5 - 140 - 161 = 1441.5
    # TDEE = 1441.5 * 1.55 = 2234.325 -> 2234
    res = client.post(
        "/api/profile",
        headers=headers,
        json={"age": 28, "sex": "female", "height_cm": 170, "weight_kg": 68, "activity_level": 1.55},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["calorie_target"] == 2234
    assert data["bmr"] == 1442

    get_prof = client.get("/api/profile", headers=headers)
    assert get_prof.status_code == 200
    assert get_prof.json()["calorie_target"] == 2234


def test_food_catalog_and_filters():
    # All foods
    res = client.get("/api/foods")
    assert res.status_code == 200
    foods = res.json()
    assert len(foods) >= 4

    # Multi-nutrient tag filtering
    protein_foods = client.get("/api/foods?nutrition_tag=protein_rich").json()
    assert len(protein_foods) > 0
    assert any("Chickpeas" in f["name"] for f in protein_foods)

    iron_foods = client.get("/api/foods?nutrition_tag=iron_rich").json()
    assert len(iron_foods) > 0
    assert any("Spinach" in f["name"] or "Chickpeas" in f["name"] for f in iron_foods)

    # Search
    search_res = client.get("/api/foods?q=Quinoa").json()
    assert any("Quinoa" in f["name"] for f in search_res)


def test_barcode_lookup():
    # Known barcode
    res = client.get("/api/foods/barcode/8901234567890")
    assert res.status_code == 200
    assert "Chickpeas" in res.json()["name"]

    # Unknown barcode returns 404
    missing = client.get("/api/foods/barcode/0000000000000")
    assert missing.status_code == 404


def test_recipes_and_combinations():
    # Recipes
    recipes = client.get("/api/recipes").json()
    assert len(recipes) >= 1
    rec_id = recipes[0]["id"]
    single_rec = client.get(f"/api/recipes/{rec_id}").json()
    assert single_rec["name"] == recipes[0]["name"]

    # Combinations calculation
    foods = client.get("/api/foods").json()
    f1 = next(f["id"] for f in foods if f["protein_g"] > 0)
    f2 = next(f["id"] for f in foods if f["id"] != f1)
    combo_res = client.post(
        "/api/combinations/calculate",
        json={"items": [{"food_id": f1, "quantity": 1}, {"food_id": f2, "quantity": 1}]},
    )
    assert combo_res.status_code == 200
    combo_data = combo_res.json()
    assert combo_data["total_calories"] > 0
    assert combo_data["total_protein_g"] > 0
    assert len(combo_data["contributing_nutrients"]) > 0


def test_calin_packs_and_customization():
    packs = client.get("/api/packs").json()
    assert len(packs) == 3
    basic_pack = next(p for p in packs if p["tier"] == "basic")
    assert basic_pack["base_price_paise"] == 69900

    # Customization endpoint
    foods = client.get("/api/foods").json()
    food_ids = [f["id"] for f in foods[:4]]
    cust_res = client.post("/api/packs/customize", json={"tier": "basic", "selected_food_ids": food_ids})
    assert cust_res.status_code == 200
    assert cust_res.json()["item_count"] == 4
    assert cust_res.json()["customized_price_paise"] > 0


def test_cart_and_demo_checkout():
    # Login customer
    login = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Ensure cart is clean before test
    cart_init = client.get("/api/cart", headers=headers).json()
    for item in cart_init.get("items", []):
        client.delete(f"/api/cart/items/{item['id']}", headers=headers)

    foods = client.get("/api/foods").json()
    food = next((f for f in foods if f.get("stock_qty", 0) >= 5), foods[0])
    food_id = food["id"]

    with SessionLocal() as session:
        f_record = session.get(Food, food_id)
        if f_record and f_record.stock_qty < 10:
            f_record.stock_qty = 50
            session.commit()

    # Add food to cart
    add_food = client.post("/api/cart/items", headers=headers, json={"item_type": "food", "food_id": food_id, "quantity": 2})
    assert add_food.status_code == 200

    # Add Calin pack to cart
    add_pack = client.post("/api/cart/items", headers=headers, json={"item_type": "pack", "pack_tier": "basic", "quantity": 1})
    assert add_pack.status_code == 200

    # View Cart
    cart = client.get("/api/cart", headers=headers).json()
    assert len(cart["items"]) == 2
    assert cart["total_paise"] > 0

    # Checkout Demo Order
    checkout_payload = {
        "address": {
            "label": "Apartment",
            "line1": "42 Indiranagar 100ft Road",
            "city": "Bangalore",
            "state": "Karnataka",
            "postal_code": "560038",
            "is_default": True,
        },
        "delivery_notes": "Leave at front desk",
    }
    order_res = client.post("/api/orders/checkout", headers=headers, json=checkout_payload)
    assert order_res.status_code == 200
    order_id = order_res.json()["order_id"]
    assert order_id
    assert order_res.json()["status"] == "placed"

    # Cart should now be empty
    cart_after = client.get("/api/cart", headers=headers).json()
    assert len(cart_after["items"]) == 0

    # View Orders
    orders = client.get("/api/orders", headers=headers).json()
    assert any(o["id"] == order_id for o in orders)


def test_subscription_lifecycle():
    login = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Create subscription
    sub_res = client.post("/api/subscriptions", headers=headers, json={"pack_tier": "minimal_plus", "frequency": "weekly"})
    assert sub_res.status_code == 200
    sub_id = sub_res.json()["id"]

    # Pause subscription
    pause = client.put(f"/api/subscriptions/{sub_id}/status?status_val=paused", headers=headers)
    assert pause.status_code == 200
    assert pause.json()["status"] == "paused"

    # Cancel subscription
    cancel = client.put(f"/api/subscriptions/{sub_id}/status?status_val=cancelled", headers=headers)
    assert cancel.status_code == 200
    assert cancel.json()["status"] == "cancelled"


def test_nutritionist_workflow():
    # Customer creates review request
    cust_login = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    cust_headers = {"Authorization": f"Bearer {cust_login.json()['access_token']}"}

    req_res = client.post(
        "/api/nutritionist/requests",
        headers=cust_headers,
        json={"pack_tier": "premium", "customer_notes": "Please verify if this pack has sufficient zinc and plant protein for heavy gym workouts."},
    )
    assert req_res.status_code == 200
    req_id = req_res.json()["id"]

    # Nutritionist logs in and reviews
    client.cookies.clear()
    nutri_login = client.post("/api/auth/login", json={"email": "dr.priya@nutriverse.local", "password": "Nutritionist123!"})
    nutri_headers = {"Authorization": f"Bearer {nutri_login.json()['access_token']}"}

    all_reqs = client.get("/api/nutritionist/requests", headers=nutri_headers).json()
    assert any(r["id"] == req_id for r in all_reqs)

    review_res = client.post(
        f"/api/nutritionist/requests/{req_id}/review",
        headers=nutri_headers,
        json={"guidance_notes": "Approved! The Sprouted Chickpeas and Raw Almonds supply ~3.8mg zinc and 45g+ daily bioavailable protein. Perfect balance."},
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "reviewed"


def test_admin_operations():
    # Admin logs in
    admin_login = client.post("/api/auth/login", json={"email": "admin@nutriverse.local", "password": "AdminPass123!"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Stats
    stats = client.get("/api/admin/stats", headers=admin_headers).json()
    assert stats["counts"]["products"] >= 4
    assert stats["counts"]["orders"] >= 1

    # Update order status
    order_id = stats["recent_orders"][0]["id"]
    status_update = client.put(f"/api/admin/orders/{order_id}/status", headers=admin_headers, json={"status": "out_for_delivery"})
    assert status_update.status_code == 200
    assert status_update.json()["new_status"] == "out_for_delivery"


def test_grounded_ai_assistant():
    login = client.post("/api/auth/login", json={"email": "alex@nutriverse.local", "password": "Customer123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    chat = client.post("/api/ai/chat?question=What are the best iron rich foods in the store?", headers=headers).json()
    assert "Chickpeas" in chat["answer"] or "Spinach" in chat["answer"]
    assert len(chat["grounded_sources"]) > 0
    assert "disclaimer" in chat
