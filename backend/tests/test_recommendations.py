"""Nutriverse — Phase 6.0: Personalized Nutrition Recommendations Engine Test Suite.

Verifies:
1. Mathematical correctness of portion calculations and target contribution percentages.
2. Deterministic and stable ranking rules (target contribution %, nutrient density, alphabetical tie-breaking).
3. Non-zero preservation: missing/unknown nutrients are never coerced to zero.
4. Exclusion of foods with unanalyzed or unverified target nutrients in strict mode.
5. Food-state integrity: raw vs cooked state handling without yield conversions.
6. Allergen safety filtering based on declared user allergies.
7. Rejection of unsupported micronutrient targets (no invented clinical targets).
8. Validation of portion overrides (positive finite bounds, rejection of NaN/inf/negatives).
9. Authentication, authorization, and tenant isolation (cross-user boundary enforcement).
10. Biometric consent lifecycle enforcement (revocation blocks recommendations).
11. Stale-target detection and freshness metadata propagation.
12. Full provenance, licensing, and clinical disclaimer attachment.
13. Stateless calculation endpoint (POST /api/recommendations/calculate) with CSRF protection.
"""

from datetime import datetime, timezone
import json
import math
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from backend.app.main import (
    app,
    SessionLocal,
    User,
    NutritionProfile,
    Food,
    FoodNutrient,
    Nutrient,
    DataSource,
    SourceRecord,
    Role,
    PasswordHasher,
    create_access_token,
    generate_csrf_token,
    VerificationStatus,
)
from backend.app.services.recommendations import (
    generate_recommendations,
    extract_target_value_from_estimate,
    check_food_allergen_conflict,
    check_food_preparation_state_mismatch,
    SUPPORTED_RECOMMENDATION_NUTRIENTS,
    UnsupportedTargetNutrientError,
    TargetEligibilityError,
    InvalidPortionError,
)
from backend.app.nutrition_targets import calculate_nutrition_targets

client = TestClient(app)


# ============================================================================
# Helpers & Fixtures
# ============================================================================

def create_test_user_and_profile(
    email: str = None,
    consent_given: bool = True,
    allergies: str = "None",
    goal: str = "maintain",
    calc_version: str = "mifflin_st_jeor",
    calorie_target: int = 2000,
    weight_kg: float = 60.0,
) -> tuple[User, NutritionProfile, str]:
    """Creates a test user with a persistent nutrition profile and returns (user, profile, token)."""
    session = SessionLocal()
    try:
        user_email = email or f"rec_user_{uuid4().hex[:8]}@example.com"
        user = User(
            id=str(uuid4()),
            name="Recommendation Test User",
            email=user_email,
            password_hash=PasswordHasher.hash("SecurePass123!"),
            role=Role.user.value,
        )
        session.add(user)
        session.flush()

        profile = NutritionProfile(
            id=str(uuid4()),
            user_id=user.id,
            age=30,
            sex="female",
            height_cm=165.0,
            weight_kg=weight_kg,
            activity_level=1.375,
            calorie_target=calorie_target,
            bmr=1330,
            goal=goal,
            food_preferences="Plant-forward balanced",
            allergies=allergies,
            budget_paise=150000,
            calculation_version=calc_version,
            consent_revoked_at=None if consent_given else datetime.now(timezone.utc),
        )
        session.add(profile)
        session.commit()
        session.refresh(user)
        session.refresh(profile)

        token = create_access_token(user)
        return user, profile, token
    finally:
        session.close()


# ============================================================================
# Test Suite 1: Mathematical Correctness & Engine Functions
# ============================================================================

def test_extract_target_value_supported_nutrients():
    """Verify target extraction for all officially supported recommendation nutrients."""
    dummy_estimate = {
        "energy_targets": {"daily_energy_target_kcal": 2150.0},
        "macronutrient_targets": {
            "protein": {"target_g_day": 72.0},
            "dietary_fiber": {"target_g_day": 32.2},
            "fat": {"target_g_day": 59.7},
            "carbohydrates": {"target_g_day": 268.8},
        },
    }

    # Protein
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "protein")
    assert val == 72.0
    assert unit == "g"
    assert code == "PROTCNT"

    # Dietary Fiber
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "dietary_fiber")
    assert val == 32.2
    assert unit == "g"
    assert code == "FIBTG"

    # Fiber alias
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "fiber")
    assert val == 32.2
    assert code == "FIBTG"

    # Energy
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "energy")
    assert val == 2150.0
    assert unit == "kcal"
    assert code == "ENERC_KCAL"

    # Fat
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "fat")
    assert val == 59.7
    assert unit == "g"
    assert code == "FATCE"

    # Carbohydrates and carbs alias
    val, unit, code, src = extract_target_value_from_estimate(dummy_estimate, "carbohydrates")
    assert val == 268.8
    assert unit == "g"
    assert code == "CHOAVLDF"

    val_alias, _, code_alias, _ = extract_target_value_from_estimate(dummy_estimate, "carbs")
    assert val_alias == 268.8
    assert code_alias == "CHOAVLDF"


def test_reject_unsupported_micronutrient_targets():
    """Strictly reject recommendations for nutrients lacking verified individual targets."""
    dummy_estimate = {
        "energy_targets": {"daily_energy_target_kcal": 2000.0},
        "macronutrient_targets": {"protein": {"target_g_day": 60.0}},
    }

    for unsupported in ["iron", "calcium", "vitamin_c", "sodium", "potassium", "vitamin_d"]:
        with pytest.raises(UnsupportedTargetNutrientError) as exc_info:
            extract_target_value_from_estimate(dummy_estimate, unsupported)
        assert f"'{unsupported}' are not supported" in str(exc_info.value)
        assert "prevent fabricating unverified clinical requirements" in str(exc_info.value)


def test_allergen_conflict_detection():
    """Verify deterministic detection of declared allergen conflicts."""
    session = SessionLocal()
    try:
        # Malai Paneer (Dairy)
        paneer = session.query(Food).filter(Food.name.ilike("%paneer%")).first()
        if paneer:
            assert check_food_allergen_conflict(paneer, "Dairy") == "dairy"
            assert check_food_allergen_conflict(paneer, "Milk, Eggs") == "milk"
            assert check_food_allergen_conflict(paneer, "Lactose intolerance") == "lactose"
            assert check_food_allergen_conflict(paneer, "None") is None
            assert check_food_allergen_conflict(paneer, "Peanuts") is None

        # Spinach (No common allergens)
        spinach = session.query(Food).filter(Food.name.ilike("%spinach%")).first()
        if spinach:
            assert check_food_allergen_conflict(spinach, "Dairy, Nuts") is None
            assert check_food_allergen_conflict(spinach, "None") is None
    finally:
        session.close()


def test_portion_override_validation():
    """Verify strict validation and rejection of invalid or non-finite portion masses."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=25, sex="male", height=175.0, weight=70.0, activity_level=1.55
        )

        for invalid_portion in [-10.0, 0.0, -1.0, float("nan"), float("inf"), float("-inf"), 2500.0]:
            with pytest.raises(InvalidPortionError):
                generate_recommendations(
                    session=session,
                    target_nutrient="protein",
                    target_estimate=estimate,
                    portion_override_g=invalid_portion,
                )
    finally:
        session.close()


def test_recommendation_ranking_determinism():
    """Verify that recommendation ranking is strictly deterministic, reproducible, and transparent."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=28, sex="female", height=162.0, weight=58.0, activity_level=1.375
        )

        # Call twice with identical parameters
        res1 = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            limit=5,
            strict_verified=True,
        )
        res2 = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            limit=5,
            strict_verified=True,
        )

        assert res1["counts"]["recommendations_returned"] > 0
        assert res1["counts"]["recommendations_returned"] == res2["counts"]["recommendations_returned"]

        # Check exact ordering and items
        recs1 = res1["recommendations"]
        recs2 = res2["recommendations"]

        assert len(recs1) == len(recs2)
        for r1, r2 in zip(recs1, recs2):
            assert r1["food_id"] == r2["food_id"]
            assert r1["food_name"] == r2["food_name"]
            assert r1["nutrient_contribution"]["amount"] == r2["nutrient_contribution"]["amount"]
            assert r1["nutrient_contribution"]["target_contribution_pct"] == r2["nutrient_contribution"]["target_contribution_pct"]
            assert r1["nutrient_contribution"]["remaining_target"] == r2["nutrient_contribution"]["remaining_target"]

        # Verify descending order of contribution percentage
        for i in range(len(recs1) - 1):
            pct_curr = recs1[i]["nutrient_contribution"]["target_contribution_pct"]
            pct_next = recs1[i + 1]["nutrient_contribution"]["target_contribution_pct"]
            assert pct_curr >= pct_next
    finally:
        session.close()


def test_target_contribution_and_remaining_gap_arithmetic():
    """Verify mathematical precision of portion contribution and remaining daily gap."""
    session = SessionLocal()
    try:
        # Female, 60kg, lightly active -> protein target is 60.0 * 0.8 = 48.0 g (clamped within AMDR)
        estimate = calculate_nutrition_targets(
            age=30, sex="female", height=165.0, weight=60.0, activity_level=1.375
        )
        user_protein_target = estimate["macronutrient_targets"]["protein"]["target_g_day"]

        res = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            portion_override_g=100.0,
            strict_verified=True,
        )

        for rec in res["recommendations"]:
            contrib = rec["nutrient_contribution"]
            amount = contrib["amount"]
            target = contrib["user_target"]
            pct = contrib["target_contribution_pct"]
            rem = contrib["remaining_target"]

            assert target == user_protein_target
            # Verify pct = round(amount / target * 100, 1)
            expected_pct = round((amount / target) * 100.0, 1)
            assert pct == expected_pct

            # Verify remaining = max(0.0, round(target - amount, 1))
            expected_rem = max(0.0, round(target - amount, 1))
            assert rem == expected_rem
    finally:
        session.close()


def test_missing_nutrient_never_coerced_to_zero():
    """Verify that foods missing target nutrients are excluded rather than assigned 0.0 contribution."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=25, sex="male", height=170.0, weight=70.0, activity_level=1.375
        )

        # Dietary fiber recommendations
        res = generate_recommendations(
            session=session,
            target_nutrient="dietary_fiber",
            target_estimate=estimate,
            strict_verified=True,
        )

        # Paneer has 0 or unanalyzed dietary fiber; verify it is not recommended as a fiber source
        rec_names = [r["food_name"] for r in res["recommendations"]]
        assert not any("paneer" in name.lower() for name in rec_names)

        # Verify excluded candidate logs reason
        paneer_excluded = any(
            "paneer" in exc["food_name"].lower() and ("fiber" in exc["reason"].lower() or "fibtg" in exc["reason"].lower() or "negligible" in exc["reason"].lower())
            for exc in res["excluded_candidates"]
        )
        assert paneer_excluded
    finally:
        session.close()


def test_food_state_compatibility_enforcement():
    """Verify that raw foods cannot be claimed as cooked without an explicit conversion factor."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=25, sex="male", height=170.0, weight=70.0, activity_level=1.375
        )

        # In strict verified mode with food_state="cooked" and no yield conversion factor
        res = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            food_state="cooked",
            conversion_yield_factor=None,
            strict_verified=True,
        )

        # Because all IFCT foods are raw, none can be presented as cooked without explicit conversion
        assert res["counts"]["recommendations_returned"] == 0
        assert any("incompatible" in exc["reason"].lower() or "raw" in exc["reason"].lower() or "food state" in exc["reason"].lower()
                   for exc in res["excluded_candidates_summary"])
    finally:
        session.close()


# ============================================================================
# Test Suite 2: API Endpoints, Auth, Safety, and Privacy
# ============================================================================

def test_api_get_recommendations_me_authenticated_success():
    """Verify GET /api/recommendations/me returns structured recommendations for authenticated user."""
    user, profile, token = create_test_user_and_profile(
        allergies="None", goal="maintain", calorie_target=1950
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/recommendations/me?target_nutrient=protein&limit=4", headers=headers)

    assert response.status_code == 200
    data = response.json()

    assert data["engine_version"] == "nutriverse-recs-v1"
    assert data["target_nutrient"]["canonical_code"] == "PROTCNT"
    assert data["target_nutrient"]["unit"] == "g"
    assert data["user_id"] == user.id
    assert data["profile_id"] == profile.id
    assert len(data["recommendations"]) <= 4
    assert len(data["recommendations"]) > 0

    first = data["recommendations"][0]
    assert "food_id" in first
    assert "food_name" in first
    assert "portion" in first
    assert "nutrient_contribution" in first
    assert "source_provenance" in first
    assert "explanation" in first
    assert "disclaimer" in data
    assert "Consult a qualified healthcare provider" in data["disclaimer"]


def test_api_get_recommendations_unauthenticated_rejected():
    """Verify unauthenticated requests to /api/recommendations/me receive 401."""
    response = client.get("/api/recommendations/me")
    assert response.status_code == 401


def test_api_get_recommendations_revoked_consent_rejected():
    """Verify users with revoked biometric consent cannot receive recommendations (403)."""
    user, profile, token = create_test_user_and_profile(consent_given=False)

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/recommendations/me", headers=headers)
    assert response.status_code == 403
    assert "biometric consent" in response.json()["detail"].lower()


def test_api_get_recommendations_user_without_profile_rejected():
    """Verify users without a saved profile receive 403 / clear configuration prompt."""
    session = SessionLocal()
    try:
        user = User(
            id=str(uuid4()),
            name="No Profile User",
            email=f"noprofile_{uuid4().hex[:6]}@example.com",
            password_hash=PasswordHasher.hash("Pass123!"),
            role=Role.user.value,
        )
        session.add(user)
        session.commit()
        token = create_access_token(user)
    finally:
        session.close()

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/recommendations/me", headers=headers)
    assert response.status_code == 403
    assert "active profile" in response.json()["detail"].lower()


def test_api_cross_user_tenant_isolation():
    """Verify User A's recommendations are strictly computed from User A's targets, not User B's."""
    user_a, profile_a, token_a = create_test_user_and_profile(
        email=f"user_a_{uuid4().hex[:6]}@example.com", calorie_target=1400, weight_kg=48.0
    )
    user_b, profile_b, token_b = create_test_user_and_profile(
        email=f"user_b_{uuid4().hex[:6]}@example.com", calorie_target=2600, weight_kg=85.0
    )

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res_a = client.get("/api/recommendations/me?target_nutrient=energy", headers=headers_a)
    res_b = client.get("/api/recommendations/me?target_nutrient=energy", headers=headers_b)

    assert res_a.status_code == 200
    assert res_b.status_code == 200

    data_a = res_a.json()
    data_b = res_b.json()

    assert data_a["user_id"] == user_a.id
    assert data_b["user_id"] == user_b.id
    assert data_a["profile_id"] == profile_a.id
    assert data_b["profile_id"] == profile_b.id

    # Energy target reflects respective profiles
    assert data_a["target_nutrient"]["user_target"] != data_b["target_nutrient"]["user_target"]


def test_api_stale_target_freshness_warning():
    """Verify that stale persisted targets include an explicit warning banner."""
    # Persisted calorie target 1200 while fresh calculation yields >1600
    user, profile, token = create_test_user_and_profile(calorie_target=1200)

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/recommendations/me", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["target_freshness"]["is_stale"] is True
    assert any("Target freshness notice" in w for w in data["warnings"])


def test_api_unsupported_nutrient_rejected_with_400():
    """Verify GET /api/recommendations/me rejects unsupported nutrient requests with 400."""
    user, profile, token = create_test_user_and_profile()

    headers = {"Authorization": f"Bearer {token}"}
    for bad_nut in ["zinc", "iron", "copper", "magnesium", "invented_nutrient"]:
        response = client.get(f"/api/recommendations/me?target_nutrient={bad_nut}", headers=headers)
        assert response.status_code == 400
        assert f"'{bad_nut}' are not supported" in response.json()["detail"]


def test_api_stateless_recommendations_calculate_endpoint():
    """Verify POST /api/recommendations/calculate generates recommendations statelessly."""
    user, _, token = create_test_user_and_profile()

    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "target_nutrient": "dietary_fiber",
        "age": 32,
        "sex": "female",
        "height": 160.0,
        "height_unit": "cm",
        "weight": 55.0,
        "weight_unit": "kg",
        "activity_level": 1.375,
        "goal": "maintain",
        "method": "mifflin_st_jeor",
        "limit": 3,
    }

    response = client.post("/api/recommendations/calculate", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["target_nutrient"]["canonical_code"] == "FIBTG"
    assert data["target_nutrient"]["unit"] == "g"
    assert len(data["recommendations"]) <= 3
    assert len(data["recommendations"]) > 0

    first = data["recommendations"][0]
    assert "explanation" in first
    assert "Fibre" in first["explanation"] or "Fiber" in first["explanation"] or "dietary" in first["explanation"].lower()


def test_api_stateless_recommendations_ineligible_population_rejected():
    """Verify POST /api/recommendations/calculate rejects pediatric (<18) inputs with 422."""
    user, _, token = create_test_user_and_profile()
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "target_nutrient": "protein",
        "age": 15,  # Under 18
        "sex": "male",
        "height": 160.0,
        "weight": 50.0,
        "activity_level": 1.5,
    }

    response = client.post("/api/recommendations/calculate", json=payload, headers=headers)
    assert response.status_code == 422
    assert "pediatric" in response.json()["detail"].lower() or "adult" in response.json()["detail"].lower()


def test_api_stateless_recommendations_csrf_protection_for_cookie_auth():
    """Verify CSRF token mismatch is rejected for cookie-authenticated POST /api/recommendations/calculate."""
    user, _, token = create_test_user_and_profile()
    csrf_cookie = generate_csrf_token()

    client.cookies.set("nutriverse_access", token)
    client.cookies.set("nutriverse_csrf", csrf_cookie)

    payload = {
        "target_nutrient": "protein",
        "age": 28,
        "sex": "female",
        "height": 165.0,
        "weight": 60.0,
        "activity_level": 1.4,
    }

    # Header has invalid CSRF
    headers = {"X-CSRF-Token": "invalid-token"}
    response = client.post("/api/recommendations/calculate", json=payload, headers=headers)
    assert response.status_code == 403
    assert "csrf" in response.json()["detail"].lower()


# ============================================================================
# Test Suite 3: Phase 6.0.1 Integrity & Ranking Audit Checks
# ============================================================================

def test_portion_distinction_documented_vs_standardized_100g_fallback():
    """Verify distinction between documented serving, standardized 100g fallback, and explicit override."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=28, sex="female", height=165.0, weight=60.0, activity_level=1.375
        )

        # 1. Documented serving size (e.g. Raw Almonds: 30g)
        almonds = session.query(Food).filter(Food.name.ilike("%almond%")).first()
        if almonds and almonds.serving_size and almonds.serving_size != "100g":
            res_almonds = generate_recommendations(
                session=session,
                target_nutrient="protein",
                target_estimate=estimate,
                strict_verified=False,  # Almonds may be catalog rather than IFCT
            )
            for rec in res_almonds["recommendations"]:
                if "almond" in rec["food_name"].lower():
                    assert rec["portion"]["portion_type"] == "documented_serving"
                    assert rec["portion"]["is_standardized_100g_fallback"] is False
                    assert rec["portion"]["mass_g"] == 30.0
                    assert "Documented serving size" in rec["portion"]["basis_notes"]
                    assert "100% edible portion" in rec["portion"]["edible_weight_assumption"]

        # 2. Standardized 100g fallback for ambiguous or unspecified serving size
        ambiguous_id = str(uuid4())
        ambiguous_food = Food(
            id=ambiguous_id,
            name="Audit Ambiguous Food",
            barcode=f"8909{uuid4().hex[:9]}",
            category="Snacks",
            serving_size="1 medium bowl",  # Ambiguous unit with no gram mass
            calories=200,
            protein_g=50.0,
            active=True,
        )
        session.add(ambiguous_food)
        session.flush()

        try:
            sample_sr = session.query(SourceRecord).first()
            fn_protein = FoodNutrient(
                id=str(uuid4()),
                food_id=ambiguous_food.id,
                nutrient_id=(session.query(Nutrient).filter(Nutrient.canonical_code == "PROTCNT").first()).id,
                source_record_id=sample_sr.id if sample_sr else None,
                value=50.0,
                unit="g",
                basis="per_100g_edible",
                food_state="raw",
                verification_status="verified_reference",
                is_unknown=False,
            )
            fn_energy = FoodNutrient(
                id=str(uuid4()),
                food_id=ambiguous_food.id,
                nutrient_id=(session.query(Nutrient).filter(Nutrient.canonical_code == "ENERC_KCAL").first()).id,
                source_record_id=sample_sr.id if sample_sr else None,
                value=200.0,
                unit="kcal",
                basis="per_100g_edible",
                food_state="raw",
                verification_status="verified_reference",
                is_unknown=False,
            )
            session.add_all([fn_protein, fn_energy])
            session.commit()

            res_ambiguous = generate_recommendations(
                session=session,
                target_nutrient="protein",
                target_estimate=estimate,
                limit=10,
                strict_verified=False,
            )
            matched_ambiguous = next(
                (r for r in res_ambiguous["recommendations"] if r["food_id"] == ambiguous_food.id),
                None,
            )
            assert matched_ambiguous is not None
            portion_info = matched_ambiguous["portion"]
            assert portion_info["portion_type"] == "standardized_comparison_100g"
            assert portion_info["is_standardized_100g_fallback"] is True
            assert portion_info["mass_g"] == 100.0
            assert "Standardized 100.0 g edible comparison portion used" in portion_info["basis_notes"]
            assert "not a verified typical serving size" in portion_info["basis_notes"]
            assert "100% edible portion basis" in portion_info["edible_weight_assumption"]

            # 3. Explicit portion override (e.g. 75g)
            res_override = generate_recommendations(
                session=session,
                target_nutrient="protein",
                target_estimate=estimate,
                portion_override_g=75.0,
                strict_verified=False,
            )
            for rec in res_override["recommendations"]:
                assert rec["portion"]["portion_type"] == "explicit_override"
                assert rec["portion"]["is_standardized_100g_fallback"] is False
                assert rec["portion"]["mass_g"] == 75.0
                assert "Explicit comparison portion override: 75.0 g" in rec["portion"]["basis_notes"]
        finally:
            # Guarantee cleanup even on failure
            session.query(FoodNutrient).filter(FoodNutrient.food_id == ambiguous_id).delete()
            session.query(Food).filter(Food.id == ambiguous_id).delete()
            session.commit()
    finally:
        session.close()


def test_nutrient_density_compatible_units_and_energy_targets():
    """Verify nutrient density calculation uses compatible units and distinguishes energy from macronutrients."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=30, sex="female", height=160.0, weight=55.0, activity_level=1.375
        )

        # 1. Macronutrient target (Protein): density is g/100 kcal energy
        res_protein = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            strict_verified=True,
        )
        assert len(res_protein["recommendations"]) > 0
        first_protein = res_protein["recommendations"][0]["nutrient_contribution"]
        assert "100 kcal energy" in first_protein["density_label"]
        assert first_protein["nutrient_density_per_100kcal"] is not None
        assert first_protein["nutrient_density"] == first_protein["nutrient_density_per_100kcal"]
        expected_dens = round((first_protein["amount"] / first_protein["portion_energy_kcal"]) * 100.0, 2)
        assert first_protein["nutrient_density"] == expected_dens

        # 2. Energy target: density is kcal/100g portion mass
        res_energy = generate_recommendations(
            session=session,
            target_nutrient="energy",
            target_estimate=estimate,
            strict_verified=True,
        )
        assert len(res_energy["recommendations"]) > 0
        first_energy = res_energy["recommendations"][0]["nutrient_contribution"]
        portion_g = res_energy["recommendations"][0]["portion"]["mass_g"]
        assert first_energy["density_label"] == "kcal / 100g portion mass"
        assert first_energy["nutrient_density_per_100kcal"] is None  # Not applicable to energy target
        assert first_energy["nutrient_density"] is not None
        expected_energy_dens = round((first_energy["amount"] / portion_g) * 100.0, 1)
        assert first_energy["nutrient_density"] == expected_energy_dens
    finally:
        session.close()


def test_non_prescriptive_wording_and_ranking_disclosures():
    """Verify deterministic ranking rules and non-prescriptive daily contribution explanations."""
    session = SessionLocal()
    try:
        estimate = calculate_nutrition_targets(
            age=28, sex="male", height=175.0, weight=72.0, activity_level=1.55
        )

        res = generate_recommendations(
            session=session,
            target_nutrient="dietary_fiber",
            target_estimate=estimate,
            strict_verified=True,
        )

        # 1. Ranking semantics disclosure is present and transparent
        assert "ranking_semantics" in res
        rs = res["ranking_semantics"]
        assert "primary_criterion" in rs
        assert "secondary_criterion" in rs
        assert "tertiary_criterion" in rs
        assert "not an algorithmic health score" in rs["disclaimer"].lower()

        # 2. Target comparison disclosure is present
        assert "target_comparison_disclosure" in res
        assert "varied intake of diverse whole foods is required" in res["target_comparison_disclosure"]

        # 3. Non-prescriptive wording in each recommendation explanation
        for rec in res["recommendations"]:
            contrib = rec["nutrient_contribution"]
            expl = rec["explanation"]

            assert "uncovered daily target balance is" in expl or "exceeds the 24-hour target reference" in expl
            assert "does not account for other daily meals" in expl or "exceeds" in expl
            assert "no single food is expected to meet 100% of daily intake" in expl or "exceeds" in expl
            assert contrib["uncovered_target_difference"] is not None
            assert contrib["uncovered_target_difference"] == contrib["remaining_target"]
    finally:
        session.close()


def test_ten_ifct_reference_records_provenance_and_licensing():
    """Verify all 10 IFCT reference records possess verified laboratory nutrients, metadata, and citation attribution."""
    session = SessionLocal()
    try:
        ifct_ids = ["A010", "A013", "B002", "B011", "B014", "C009", "C033", "F006", "F013", "L003"]
        records = (
            session.query(SourceRecord)
            .filter(SourceRecord.external_id.in_(ifct_ids))
            .order_by(SourceRecord.external_id)
            .all()
        )
        assert len(records) == 10, f"Expected 10 IFCT reference records, found {len(records)}"

        for r in records:
            # Check DataSource
            ds = r.data_source
            assert ds is not None
            assert "ICMR-NIN IFCT 2017" in ds.name
            assert "National Institute of Nutrition (ICMR), Hyderabad" in ds.publisher
            assert ds.license == "Scientific Reference (ICMR-NIN Copyright 2017)"
            assert ds.license_url == "https://www.nin.res.in/downloads/IFCT2017.pdf"

            # Check linked FoodNutrient records
            fns = session.query(FoodNutrient).filter(FoodNutrient.source_record_id == r.id).all()
            assert len(fns) == 16, f"Record {r.external_id} expected 16 nutrients, found {len(fns)}"

            for fn in fns:
                assert fn.verification_status == "verified_reference"
                assert fn.basis == "per_100g_edible"
                assert fn.food_state == "raw"
                # Non-zero preservation: unanalyzed nutrients have is_unknown=True and value=None (never coerced to 0.0)
                if fn.is_unknown:
                    assert fn.value is None
                    assert fn.unknown_reason is not None
                else:
                    assert fn.value is not None
                    assert fn.unit in {"g", "mg", "ug", "kcal", "kJ"}

        # Check provenance attached during recommendation generation
        estimate = calculate_nutrition_targets(
            age=25, sex="male", height=170.0, weight=65.0, activity_level=1.375
        )
        res = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            strict_verified=True,
        )

        for rec in res["recommendations"]:
            prov_list = rec["source_provenance"]
            assert len(prov_list) > 0
            for prov in prov_list:
                assert "ICMR-NIN IFCT 2017" in prov["data_source_name"]
                assert "National Institute of Nutrition" in prov["publisher"]
                assert "Scientific Reference (ICMR-NIN Copyright 2017)" in prov["license"]
                assert "Longvah" in prov["scholarly_citation"]
                assert "© 2017 National Institute of Nutrition (ICMR)" in prov["copyright_notice"]
                assert "Laboratory analytical chemistry per 100g edible portion" in prov["analytical_basis"]
    finally:
        session.close()


def test_preparation_state_mismatch_cannot_be_bypassed_by_renaming():
    """Verifies that preparation state mismatches are controlled by explicit, reliable data fields

    and enforced by the recommendation engine—not fragile display-name matching.
    Renaming the three affected products (Sprouted Chickpeas, Sprouted Green Moong,
    Roasted Sweet Potato) must NOT bypass the restriction.
    """
    session = SessionLocal()
    original_names: dict = {}
    chickpea = None
    moong = None
    sweet_pot = None

    try:
        # Pre-check: Ensure the 3 foods exist and have explicit mismatch markers
        chickpea = session.query(Food).filter(Food.name == "Sprouted Chickpeas").first()
        moong = session.query(Food).filter(Food.name == "Sprouted Green Moong").first()
        sweet_pot = session.query(Food).filter(Food.name == "Roasted Sweet Potato").first()

        assert chickpea is not None
        assert moong is not None
        assert sweet_pot is not None

        # Verify initial exclusion via explicit helper
        assert check_food_preparation_state_mismatch(chickpea, session) is not None
        assert check_food_preparation_state_mismatch(moong, session) is not None
        assert check_food_preparation_state_mismatch(sweet_pot, session) is not None

        # TEST RENAMING: Change display names to arbitrary retail-marketing strings
        original_names = {
            chickpea.id: chickpea.name,
            moong.id: moong.name,
            sweet_pot.id: sweet_pot.name,
        }

        chickpea.name = "Artisan Desi Protein Chickpea Snack"
        moong.name = "Crunchy Whole Moong Supergrain"
        sweet_pot.name = "Golden Roasted Yams Organic"
        session.flush()

        # Verify that explicit helper STILL detects the mismatch despite rename
        chickpea_mismatch = check_food_preparation_state_mismatch(chickpea, session)
        moong_mismatch = check_food_preparation_state_mismatch(moong, session)
        sweet_pot_mismatch = check_food_preparation_state_mismatch(sweet_pot, session)

        assert chickpea_mismatch is not None
        assert "Preparation state mismatch" in chickpea_mismatch
        assert moong_mismatch is not None
        assert "Preparation state mismatch" in moong_mismatch
        assert sweet_pot_mismatch is not None
        assert "Preparation state mismatch" in sweet_pot_mismatch

        # Verify engine exclusion: generate recommendations for protein
        estimate = calculate_nutrition_targets(
            age=28, sex="female", height=162.0, weight=56.0, activity_level=1.375
        )
        protein_res = generate_recommendations(
            session=session,
            target_nutrient="protein",
            target_estimate=estimate,
            strict_verified=True,
        )

        rec_names = [r["food_name"] for r in protein_res["recommendations"]]
        excluded_dict = {e["food_id"]: e["reason"] for e in protein_res["excluded_candidates"]}

        # Neither renamed chickpea nor renamed moong should be recommended
        assert "Artisan Desi Protein Chickpea Snack" not in rec_names
        assert "Crunchy Whole Moong Supergrain" not in rec_names

        # Both MUST be excluded with explicit preparation state mismatch reason
        assert chickpea.id in excluded_dict
        assert "Preparation state mismatch" in excluded_dict[chickpea.id]
        assert moong.id in excluded_dict
        assert "Preparation state mismatch" in excluded_dict[moong.id]

        # Verify engine exclusion: generate recommendations for carbohydrates
        carbs_res = generate_recommendations(
            session=session,
            target_nutrient="carbohydrates",
            target_estimate=estimate,
            strict_verified=True,
        )
        carb_rec_names = [r["food_name"] for r in carbs_res["recommendations"]]
        carb_excluded_dict = {e["food_id"]: e["reason"] for e in carbs_res["excluded_candidates"]}

        assert "Golden Roasted Yams Organic" not in carb_rec_names
        assert sweet_pot.id in carb_excluded_dict
        assert "Preparation state mismatch" in carb_excluded_dict[sweet_pot.id]

    finally:
        # Revert names
        if original_names:
            if chickpea and chickpea.id in original_names:
                chickpea.name = original_names[chickpea.id]
            if moong and moong.id in original_names:
                moong.name = original_names[moong.id]
            if sweet_pot and sweet_pot.id in original_names:
                sweet_pot.name = original_names[sweet_pot.id]
            session.commit()
        session.close()



