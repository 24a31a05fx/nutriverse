"""Nutriverse — Phase 5.1: Nutrition Calculation Accuracy, Safety and Privacy Audit Test Suite.

Comprehensive audit test suite verifying:
1. Exact mathematical correctness of reference formulas:
   - Mifflin-St Jeor (1990)
   - ICMR-NIN (2020) Reference Equations for Indian reference adults (with -10% M / -9% F adjustment)
   - Schofield / FAO/WHO/UNU (1985) unadjusted baseline
2. Unit normalization and conversion across all supported metrics.
3. Strict rejection of NaN, infinity, negatives, zeros, and out-of-bounds inputs.
4. Population eligibility enforcement (pediatric <18 rejected with 422; >100 rejected with 400).
5. Energy calculations with independently hand-calculated expected values.
6. Programmatic software guardrails (1200 kcal female, 1500 kcal male), clear non-clinical disclosures,
   and warnings for aggressive deficits (>25% TDEE).
7. Macronutrient arithmetic consistency: Atwater factors (4, 9, 4 kcal/g), AMDR boundaries,
   energy balance reconciliation, and fiber standards (IOM 14g/1000 kcal vs. ICMR 30g/day floor).
8. Strict separation between target estimates and food composition records.
9. Authentication, CSRF token verification for cookie-authenticated mutating requests, and tenant isolation.
10. Consent lifecycle, audit log privacy verification, and data deletion.
"""

import math
import json
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.main import (
    app,
    SessionLocal,
    User,
    NutritionProfile,
    AuditLog,
    Food,
    FoodNutrient,
    Order,
    Role,
    PasswordHasher,
    create_access_token,
    generate_csrf_token,
)
from backend.app.nutrition_targets import (
    calculate_nutrition_targets,
    calculate_bmr_mifflin_st_jeor,
    calculate_bmr_icmr_nin_2020,
    calculate_bmr_schofield_1985,
    calculate_macronutrient_distribution,
    normalize_height_to_cm,
    normalize_weight_to_kg,
    validate_age_years,
    validate_sex,
    validate_activity_level,
    validate_goal,
    resolve_method_identifier,
    TargetEstimationValidationError,
    TargetIneligiblePopulationError,
    GUARDRAIL_THRESHOLDS,
)

client = TestClient(app)


# ============================================================================
# Audit 1 — Reference Equations and Population Eligibility
# ============================================================================

def test_mifflin_st_jeor_formula_independent_verification():
    """Verify exact Mifflin-St Jeor (1990) equation with hand-calculated expected results.

    Male: 10 * W(kg) + 6.25 * H(cm) - 5 * Age(y) + 5
    Female: 10 * W(kg) + 6.25 * H(cm) - 5 * Age(y) - 161
    """
    # Male: 82.5 kg, 182.0 cm, 35 years
    # 10 * 82.5 + 6.25 * 182.0 - 5 * 35 + 5 = 825.0 + 1137.5 - 175.0 + 5 = 1792.5 kcal
    bmr_m = calculate_bmr_mifflin_st_jeor(weight_kg=82.5, height_cm=182.0, age_years=35, sex="male")
    assert bmr_m == 1792.5

    # Female: 58.0 kg, 163.0 cm, 29 years
    # 10 * 58.0 + 6.25 * 163.0 - 5 * 29 - 161 = 580.0 + 1018.75 - 145.0 - 161 = 1292.75 -> 1292.8 kcal
    bmr_f = calculate_bmr_mifflin_st_jeor(weight_kg=58.0, height_cm=163.0, age_years=29, sex="female")
    assert bmr_f == 1292.8


def test_schofield_1985_unadjusted_baseline_formula():
    """Verify unadjusted Schofield (1985) / FAO/WHO/UNU weight equations across all age brackets."""
    # Male 18–29: 15.057 * W + 692.2 -> for 70 kg: 15.057 * 70 + 692.2 = 1053.99 + 692.2 = 1746.19 -> 1746.2
    assert calculate_bmr_schofield_1985(weight_kg=70.0, age_years=25, sex="male") == 1746.2

    # Male 30–59: 11.472 * W + 873.1 -> for 70 kg: 11.472 * 70 + 873.1 = 803.04 + 873.1 = 1676.14 -> 1676.1
    assert calculate_bmr_schofield_1985(weight_kg=70.0, age_years=45, sex="male") == 1676.1

    # Male 60+: 11.711 * W + 587.7 -> for 70 kg: 11.711 * 70 + 587.7 = 819.77 + 587.7 = 1407.47 -> 1407.5
    assert calculate_bmr_schofield_1985(weight_kg=70.0, age_years=68, sex="male") == 1407.5

    # Female 18–29: 14.818 * W + 486.6 -> for 55 kg: 14.818 * 55 + 486.6 = 814.99 + 486.6 = 1301.59 -> 1301.6
    assert calculate_bmr_schofield_1985(weight_kg=55.0, age_years=22, sex="female") == 1301.6

    # Female 30–59: 8.126 * W + 845.6 -> for 55 kg: 8.126 * 55 + 845.6 = 446.93 + 845.6 = 1292.53 -> 1292.5
    assert calculate_bmr_schofield_1985(weight_kg=55.0, age_years=40, sex="female") == 1292.5

    # Female 60+: 9.082 * W + 658.5 -> for 55 kg: 9.082 * 55 + 658.5 = 499.51 + 658.5 = 1158.01 -> 1158.0
    assert calculate_bmr_schofield_1985(weight_kg=55.0, age_years=65, sex="female") == 1158.0


def test_icmr_nin_2020_formula_with_authoritative_adjustment():
    """Verify ICMR-NIN (2020) applies -10% (males) and -9% (females) body-composition adjustments to Schofield base."""
    # Male 18–29, 65 kg:
    # Schofield base = 15.057 * 65 + 692.2 = 978.705 + 692.2 = 1670.905 -> 1670.9
    # ICMR adjusted = 1670.9 * 0.90 = 1503.81 -> 1503.8 kcal
    bmr_m = calculate_bmr_icmr_nin_2020(weight_kg=65.0, age_years=25, sex="male")
    assert bmr_m == 1503.8

    # Female 18–29, 55 kg:
    # Schofield base = 14.818 * 55 + 486.6 = 814.99 + 486.6 = 1301.59 -> 1301.6
    # ICMR adjusted = 1301.6 * 0.91 = 1184.456 -> 1184.5 kcal
    bmr_f = calculate_bmr_icmr_nin_2020(weight_kg=55.0, age_years=25, sex="female")
    assert bmr_f == 1184.5


def test_method_resolution_and_unsupported_rejection():
    """Verify resolve_method_identifier handles aliases and strictly rejects unsupported methods without silent fallback."""
    assert resolve_method_identifier("mifflin") == "mifflin_st_jeor"
    assert resolve_method_identifier("mifflin_st_jeor_1990") == "mifflin_st_jeor"
    assert resolve_method_identifier("icmr") == "icmr_nin_2020"
    assert resolve_method_identifier("schofield") == "schofield_1985"

    with pytest.raises(TargetEstimationValidationError, match="Unsupported estimation method 'harris_benedict'"):
        resolve_method_identifier("harris_benedict")

    with pytest.raises(TargetEstimationValidationError, match="Unsupported estimation method 'katch_mcardle'"):
        resolve_method_identifier("katch_mcardle")


# ============================================================================
# Audit 2 — Energy Calculation and Activity Adjustments
# ============================================================================

def test_energy_calculation_order_of_operations():
    """Verify BMR -> TDEE (BMR * PAL) -> Raw Target (TDEE + Goal) -> Final Target (max with Guardrail)."""
    # 70 kg, 175 cm, 30 y, male -> Mifflin BMR = 10*70 + 6.25*175 - 5*30 + 5 = 1648.8 kcal
    # Moderately active (PAL 1.55) -> TDEE = 1648.8 * 1.55 = 2555.64 -> 2555.6 kcal
    # Goal: weight_loss (-500 kcal) -> Raw Target = 2555.6 - 500 = 2055.6 kcal
    # Final Target = max(2055.6, 1500) = 2055.6 kcal (guardrail not applied)
    res = calculate_nutrition_targets(
        age=30,
        sex="male",
        height=175,
        height_unit="cm",
        weight=70,
        weight_unit="kg",
        activity_level="moderately_active",
        goal="weight_loss",
        method="mifflin_st_jeor",
    )
    energy = res["energy_targets"]
    assert energy["bmr_kcal_day"] == 1648.8
    assert energy["tdee_kcal_day"] == 2555.6
    assert energy["raw_daily_target_kcal"] == 2055.6
    assert energy["daily_energy_target_kcal"] == 2055.6
    assert energy["guardrail_applied"] is False


def test_high_activity_athletic_calculation():
    """Verify high physical activity multipliers (PAL 1.90) correctly scale energy without overflow."""
    res = calculate_nutrition_targets(
        age=25,
        sex="male",
        height=185,
        weight=85,
        activity_level="extra_active",
        goal="weight_gain",
    )
    energy = res["energy_targets"]
    assert energy["bmr_kcal_day"] == 1886.2
    assert energy["tdee_kcal_day"] == round(1886.2 * 1.90, 1)
    assert energy["daily_energy_target_kcal"] == round(energy["tdee_kcal_day"] + 500, 1)


# ============================================================================
# Audit 3 — Safety Guardrails and Goal Handling
# ============================================================================

def test_programmatic_guardrail_applied_with_explicit_warning():
    """Verify guardrail is applied when goal adjustment produces an intake below 1200 kcal for women.

    Confirms the raw estimate, threshold, final value, and explicit non-clinical warning are returned.
    """
    # Small sedentary older woman on weight loss: 40 kg, 148 cm, 55 years, sedentary (PAL 1.20), weight_loss (-500)
    # BMR = 10*40 + 6.25*148 - 5*55 - 161 = 400 + 925 - 275 - 161 = 889.0 kcal
    # TDEE = 889.0 * 1.20 = 1066.8 kcal
    # Raw target = 1066.8 - 500 = 566.8 kcal -> CLAMPED to 1200.0 kcal guardrail
    res = calculate_nutrition_targets(
        age=55,
        sex="female",
        height=148,
        height_unit="cm",
        weight=40,
        weight_unit="kg",
        activity_level="sedentary",
        goal="weight_loss",
    )
    energy = res["energy_targets"]
    assert energy["guardrail_applied"] is True
    assert energy["guardrail_threshold_kcal"] == 1200.0
    assert energy["raw_daily_target_kcal"] == 566.8
    assert energy["daily_energy_target_kcal"] == 1200.0

    warnings = res["warnings"]
    assert any("Programmatic guardrail applied" in w for w in warnings)
    assert any("does NOT guarantee individual safety" in w for w in warnings)
    assert any("Deficits exceeding 25%" in w for w in warnings)


def test_severe_deficit_warning_emitted():
    """Verify deficits exceeding 25% of maintenance expenditure trigger an explicit warning."""
    # TDEE ~1800, weight_loss (-500 kcal) -> deficit = 500 / 1800 = 27.8% (>25%)
    res = calculate_nutrition_targets(
        age=30,
        sex="female",
        height=160,
        weight=55,
        activity_level="sedentary",
        goal="weight_loss",
    )
    warnings = res["warnings"]
    assert any("Caution: Requested deficit is" in w and "Deficits exceeding 25%" in w for w in warnings)


# ============================================================================
# Audit 4 — Macronutrient Arithmetic and Reference Integrity
# ============================================================================

def test_macronutrient_energy_reconciliation_and_amdr():
    """Verify protein, fat, and carbs match Atwater conversion factors and reconcile to daily energy."""
    res = calculate_nutrition_targets(
        age=28,
        sex="male",
        height=175,
        weight=70,
        activity_level="moderately_active",
        goal="maintain",
    )
    macros = res["macronutrient_targets"]
    prot = macros["protein"]
    fat = macros["fat"]
    carb = macros["carbohydrates"]

    # Atwater factors
    assert prot["target_kcal_day"] == round(prot["target_g_day"] * 4.0, 1)
    assert fat["target_kcal_day"] == round(fat["target_g_day"] * 9.0, 1)
    assert carb["target_kcal_day"] == round(carb["target_g_day"] * 4.0, 1)

    # Reconciled energy sum within ±3 kcal of target
    target_kcal = res["energy_targets"]["daily_energy_target_kcal"]
    reconciled_sum = macros["macro_energy_accounting"]["total_reported_macro_kcal_day"]
    assert abs(reconciled_sum - target_kcal) <= 3.0

    # AMDR checks
    assert 10.0 <= prot["energy_percentage"] <= 35.0
    assert 20.0 <= fat["energy_percentage"] <= 35.0
    assert 45.0 <= carb["energy_percentage"] <= 65.0


def test_dietary_fiber_standards_distinction():
    """Verify fiber standard defaults: 30g/day floor for ICMR-NIN Indian adult targets vs. 25g/day for standard."""
    res_mifflin = calculate_nutrition_targets(
        age=25, sex="male", height=170, weight=65, activity_level="sedentary", method="mifflin_st_jeor"
    )
    fiber_mifflin = res_mifflin["macronutrient_targets"]["dietary_fiber"]
    assert fiber_mifflin["target_g_day"] >= 25.0
    assert fiber_mifflin["planning_floor_g_day"] == 25.0
    assert fiber_mifflin["official_reference_g_day"] == round(14.0 * (res_mifflin["energy_targets"]["daily_energy_target_kcal"] / 1000.0), 1)
    assert fiber_mifflin["standard_applied"] == "US IOM 2005 Adequate Intake (14g/1,000 kcal)"

    res_icmr = calculate_nutrition_targets(
        age=25, sex="male", height=170, weight=65, activity_level="sedentary", method="icmr_nin_2020"
    )
    fiber_icmr = res_icmr["macronutrient_targets"]["dietary_fiber"]
    # ICMR floor is strictly 30.0 g/day
    assert fiber_icmr["target_g_day"] >= 30.0
    assert fiber_icmr["planning_floor_g_day"] == 30.0
    assert fiber_icmr["official_reference_g_day"] == round(15.0 * (res_icmr["energy_targets"]["daily_energy_target_kcal"] / 1000.0), 1)
    assert fiber_icmr["standard_applied"] == "ICMR-NIN 2020 (30g/2,000 kcal)"
    assert "30g per 2,000 kcal intake (15g/1,000 kcal)" in fiber_icmr["reference_basis"]
    assert "planning floor of 30g/day" in fiber_icmr["reference_basis"]


# ============================================================================
# Audit 5 — Input Validation and Output Integrity
# ============================================================================

def test_non_finite_and_negative_inputs_rejected():
    """Verify NaN, Inf, -Inf, 0, and negative values are strictly rejected across all normalizers."""
    for bad_val in (float("nan"), float("inf"), float("-inf"), 0, -50):
        with pytest.raises(TargetEstimationValidationError):
            normalize_height_to_cm(bad_val, "cm")
        with pytest.raises(TargetEstimationValidationError):
            normalize_weight_to_kg(bad_val, "kg")

    with pytest.raises(TargetEstimationValidationError):
        validate_age_years(float("nan"))
    with pytest.raises(TargetEstimationValidationError):
        validate_age_years(float("inf"))


def test_unit_normalization_precision():
    """Verify exact height and weight conversions from imperial and metric formats."""
    # 5'11" -> (5*12 + 11) * 2.54 = 71 * 2.54 = 180.34 cm
    assert normalize_height_to_cm("5'11", "ft_in") == 180.34
    assert normalize_height_to_cm({"feet": 5, "inches": 11}, "ft_in") == 180.34
    assert normalize_height_to_cm((5, 11), "ft_in") == 180.34

    # 160 lbs -> 160 * 0.45359237 = 72.5747792 -> 72.57 kg
    assert normalize_weight_to_kg(160, "lbs") == 72.57


def test_pediatric_and_elderly_population_bounds():
    """Verify pediatric inputs (<18) raise TargetIneligiblePopulationError and extreme ages (>100) raise validation error."""
    with pytest.raises(TargetIneligiblePopulationError, match="adults aged 18 and older"):
        validate_age_years(17)

    with pytest.raises(TargetEstimationValidationError, match="exceeds supported predictive range"):
        validate_age_years(102)


def test_bmi_screening_disclaimer_included():
    """Confirm BMI output contains explicit screening note and does not claim medical diagnosis."""
    res = calculate_nutrition_targets(age=30, sex="male", height=175, weight=75, activity_level="sedentary")
    bmi_info = res["biometric_indicators"]
    assert "screening_note" in bmi_info
    assert "does NOT constitute a clinical diagnosis" in bmi_info["screening_note"]


# ============================================================================
# Audit 6 — Consent, Authorization, Audit Logs, and Deletion
# ============================================================================

def test_consent_omission_rejected_with_422():
    """Verify PUT /api/nutrition-targets/me rejects missing or false consent with HTTP 422."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="NoConsent User",
            email=f"noconsent_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        token = create_access_token(user)

    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "age": 28,
        "sex": "female",
        "height": 165,
        "weight": 60,
        "activity_level": "sedentary",
        "consent_given": False,
    }
    res = client.put("/api/nutrition-targets/me", json=payload, headers=headers)
    assert res.status_code == 422
    assert "Explicit user consent is required" in res.json()["detail"]


def test_cookie_auth_mutating_requests_require_csrf_protection():
    """Verify that state-changing requests using cookie authentication without CSRF header are rejected with 403."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="CSRF Audit User",
            email=f"csrf_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        access_token = create_access_token(user)

    csrf_token = generate_csrf_token()

    # 1. Cookie auth with NO X-CSRF-Token header -> MUST BE 403 Forbidden
    client.cookies.set("nutriverse_access", access_token)
    client.cookies.set("nutriverse_csrf", csrf_token)

    bad_res = client.post(
        "/api/nutrition-targets/calculate",
        json={"age": 28, "sex": "female", "height": 165, "weight": 60, "activity_level": "sedentary"},
    )
    assert bad_res.status_code == 403
    assert "CSRF" in bad_res.json()["detail"]

    # 2. Cookie auth with MISMATCHED X-CSRF-Token -> MUST BE 403 Forbidden
    mismatch_res = client.post(
        "/api/nutrition-targets/calculate",
        headers={"X-CSRF-Token": "invalid_csrf_token_value"},
        json={"age": 28, "sex": "female", "height": 165, "weight": 60, "activity_level": "sedentary"},
    )
    assert mismatch_res.status_code == 403

    # 3. Cookie auth with MATCHING X-CSRF-Token -> MUST SUCCEED (200 OK)
    good_res = client.post(
        "/api/nutrition-targets/calculate",
        headers={"X-CSRF-Token": csrf_token},
        json={"age": 28, "sex": "female", "height": 165, "weight": 60, "activity_level": "sedentary"},
    )
    assert good_res.status_code == 200
    assert good_res.json()["energy_targets"]["daily_energy_target_kcal"] > 0


def test_audit_logs_privacy_no_biometrics_leaked():
    """Verify audit log records store method metadata without leaking raw weight, height, or biometrics."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="Privacy Audit User",
            email=f"privacy_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        token = create_access_token(user)
        user_id = user.id

    headers = {"Authorization": f"Bearer {token}"}
    client.put(
        "/api/nutrition-targets/me",
        json={
            "age": 32,
            "sex": "female",
            "height": 167,
            "weight": 64,
            "activity_level": "lightly_active",
            "consent_given": True,
        },
        headers=headers,
    )

    with SessionLocal() as s:
        log = s.scalar(
            select(AuditLog).where(AuditLog.user_id == user_id, AuditLog.action == "nutrition_targets_saved")
        )
        assert log is not None
        details = json.loads(log.details)
        # Verify no biometrics in audit log details
        assert "weight" not in details
        assert "height" not in details
        assert "age" not in details
        assert "allergies" not in details


def test_profile_deletion_preserves_orders_and_cleans_targets():
    """Verify DELETE /api/nutrition-targets/me deletes targets while leaving commercial/order records untouched."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="Order Preserved User",
            email=f"orderdel_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        token = create_access_token(user)
        user_id = user.id

        # Add an Order for this user
        order = Order(
            user_id=user_id,
            status="placed",
            subtotal_paise=29900,
            delivery_fee_paise=0,
            total_paise=29900,
            items_json='[{"name": "Organic Lentils", "quantity": 1}]',
            demo_payment=True,
        )
        s.add(order)
        s.commit()
        order_id = order.id

    headers = {"Authorization": f"Bearer {token}"}

    # Save target profile
    client.put(
        "/api/nutrition-targets/me",
        json={"age": 27, "sex": "male", "height": 175, "weight": 70, "activity_level": "sedentary", "consent_given": True},
        headers=headers,
    )

    # Delete target profile
    res_del = client.delete("/api/nutrition-targets/me", headers=headers)
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True

    # Verify profile is gone
    res_get = client.get("/api/nutrition-targets/me", headers=headers)
    assert res_get.status_code == 404

    # Verify Order is completely preserved
    with SessionLocal() as s:
        saved_order = s.get(Order, order_id)
        assert saved_order is not None
        assert saved_order.user_id == user_id


def test_target_separation_from_food_composition_tables():
    """Verify target calculation does not alter or pollute food composition records."""
    with SessionLocal() as s:
        food_count_before = s.query(Food).count()
        fn_count_before = s.query(FoodNutrient).count()

    calculate_nutrition_targets(
        age=30, sex="female", height=165, weight=60, activity_level="moderately_active"
    )

    with SessionLocal() as s:
        assert s.query(Food).count() == food_count_before
        assert s.query(FoodNutrient).count() == fn_count_before


# ============================================================================
# Phase 5.2 Specific Verification Tests
# ============================================================================

def test_persisted_targets_freshness_and_stale_detection():
    """Verify saved targets identify method/version and detect stale snapshots when formulas or targets differ."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="Freshness Test User",
            email=f"freshness_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        token = create_access_token(user)
        user_id = user.id

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Save profile with valid consent
    res_save = client.put(
        "/api/nutrition-targets/me",
        json={
            "age": 30,
            "sex": "female",
            "height": 165,
            "weight": 60,
            "activity_level": "sedentary",
            "goal": "maintain",
            "method": "mifflin_st_jeor",
            "consent_given": True,
        },
        headers=headers,
    )
    assert res_save.status_code == 200
    save_data = res_save.json()
    assert save_data["target_freshness"]["is_stale"] is False
    assert save_data["target_freshness"]["version_matched"] is True
    assert "persisted_snapshot" in save_data

    # 2. Retrieve immediately: should be fresh
    res_get = client.get("/api/nutrition-targets/me", headers=headers)
    assert res_get.status_code == 200
    get_data = res_get.json()
    assert get_data["target_freshness"]["is_stale"] is False
    assert get_data["target_freshness"]["version_matched"] is True
    assert get_data["persisted_snapshot"]["calorie_target"] == get_data["target_freshness"]["freshly_calculated_daily_energy_target_kcal"]

    # 3. Simulate older stored version or modified persisted calorie target in database
    with SessionLocal() as s:
        prof = s.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user_id))
        assert prof is not None
        prof.calorie_target = 1850  # Different from calculated ~1582 kcal
        prof.calculation_version = "mifflin_legacy_v0"
        s.commit()

    # 4. Retrieve again: must detect stale snapshot and version mismatch
    res_get_stale = client.get("/api/nutrition-targets/me", headers=headers)
    assert res_get_stale.status_code == 200
    stale_data = res_get_stale.json()
    assert stale_data["target_freshness"]["is_stale"] is True
    assert stale_data["target_freshness"]["version_matched"] is False
    assert stale_data["target_freshness"]["persisted_calorie_target"] == 1850
    assert stale_data["target_freshness"]["persisted_calculation_version"] == "mifflin_legacy_v0"
    assert stale_data["target_freshness"]["active_engine_version"] == "mifflin_st_jeor_1990"
    assert "recalibrate" in stale_data["target_freshness"]["note"].lower()


def test_atwater_macro_energy_accounting_and_rounding_disclosure():
    """Verify macro_energy_accounting discloses single-decimal rounding rationale and guarantees discrepancy <= 2 kcal."""
    res = calculate_nutrition_targets(
        age=32,
        sex="male",
        height=180,
        weight=80,
        activity_level="very_active",
        goal="weight_loss",
        method="mifflin_st_jeor",
    )
    accounting = res["macronutrient_targets"]["macro_energy_accounting"]
    assert "accounting_disclosure" in accounting
    assert "Atwater factors" in accounting["accounting_disclosure"]
    assert accounting["discrepancy_kcal"] <= 2.0
    assert round(abs(accounting["total_reported_macro_kcal_day"] - accounting["daily_energy_target_kcal"]), 1) == accounting["discrepancy_kcal"]


def test_hand_calculated_edge_cases_across_equations():
    """Verify hand-calculated target outcomes across edge cases for all 3 supported methods."""
    # Test Case 1: Older female, mild weight gain, ICMR-NIN 2020
    # Age 62, Female, 50 kg, Lightly Active (1.375), mild_weight_gain (+300)
    # Schofield female 60+: 9.082 * 50 + 658.5 = 454.1 + 658.5 = 1112.6 kcal
    # ICMR adjustment (-9%): 1112.6 * 0.91 = 1012.466 -> 1012.5 kcal
    # TDEE: 1012.5 * 1.375 = 1392.1875 -> 1392.2 kcal
    # Goal: 1392.2 + 300 = 1692.2 kcal (above female guardrail 1200)
    res_icmr = calculate_nutrition_targets(
        age=62,
        sex="female",
        height=155,
        weight=50,
        activity_level="lightly_active",
        goal="mild_weight_gain",
        method="icmr_nin_2020",
    )
    assert res_icmr["energy_targets"]["bmr_kcal_day"] == 1012.5
    assert res_icmr["energy_targets"]["tdee_kcal_day"] == 1392.2
    assert res_icmr["energy_targets"]["daily_energy_target_kcal"] == 1692.2
    assert res_icmr["energy_targets"]["guardrail_applied"] is False

    # Test Case 2: Tall athletic young male, unadjusted Schofield 1985
    # Age 24, Male, 85 kg, Extra Active (1.90), maintain
    # Schofield male 18–29: 15.057 * 85 + 692.2 = 1279.845 + 692.2 = 1972.045 -> 1972.0 kcal
    # TDEE: 1972.0 * 1.90 = 3746.8 kcal
    res_schofield = calculate_nutrition_targets(
        age=24,
        sex="male",
        height=195,
        weight=85,
        activity_level="extra_active",
        goal="maintain",
        method="schofield_1985",
    )
    assert res_schofield["energy_targets"]["bmr_kcal_day"] == 1972.0
    assert res_schofield["energy_targets"]["tdee_kcal_day"] == 3746.8
    assert res_schofield["energy_targets"]["daily_energy_target_kcal"] == 3746.8


# ============================================================================
# Phase 5.3 Specific Verification & Release Gate Tests
# ============================================================================

def test_mifflin_st_jeor_population_boundaries():
    """Verify Mifflin-St Jeor emits population notices at age 18 and age > 78, but not at typical ages."""
    # Age 18: Young adulthood clinical extrapolation
    res_18 = calculate_nutrition_targets(
        age=18, sex="male", height=175, weight=70, activity_level="sedentary", method="mifflin_st_jeor"
    )
    assert any("validated in subjects aged 19" in w for w in res_18["warnings"])

    # Age 80: Older adult validation boundary
    res_80 = calculate_nutrition_targets(
        age=80, sex="female", height=160, weight=55, activity_level="sedentary", method="mifflin_st_jeor"
    )
    assert any("validated up to age 78" in w for w in res_80["warnings"])

    # Age 35: Standard adult within 19–78 range (no population notices)
    res_35 = calculate_nutrition_targets(
        age=35, sex="male", height=175, weight=70, activity_level="sedentary", method="mifflin_st_jeor"
    )
    assert not any("Population notice:" in w for w in res_35["warnings"])


def test_guardrail_exact_boundaries_and_extreme_inputs():
    """Verify exact guardrail threshold boundaries and physiological extrema handling."""
    # Extreme valid physiological inputs
    # Min height 100 cm, max height 250 cm
    assert normalize_height_to_cm(100.0) == 100.0
    assert normalize_height_to_cm(250.0) == 250.0

    # Min weight 30 kg, max weight 300 kg
    assert normalize_weight_to_kg(30.0) == 30.0
    assert normalize_weight_to_kg(300.0) == 300.0

    # Beyond boundary inputs must fail
    with pytest.raises(TargetEstimationValidationError):
        normalize_height_to_cm(99.9)
    with pytest.raises(TargetEstimationValidationError):
        normalize_height_to_cm(250.1)
    with pytest.raises(TargetEstimationValidationError):
        normalize_weight_to_kg(29.9)
    with pytest.raises(TargetEstimationValidationError):
        normalize_weight_to_kg(300.1)

    # Exact female guardrail floor boundary
    # Female floor = 1200 kcal/day
    assert GUARDRAIL_THRESHOLDS["female"] == 1200.0
    assert GUARDRAIL_THRESHOLDS["male"] == 1500.0


def test_retired_calculation_version_disclosure():
    """Verify retired or unrecognized calculation versions cannot silently substitute a method without clear disclosure."""
    client.cookies.clear()
    with SessionLocal() as s:
        user = User(
            name="Retired Version User",
            email=f"retired_{uuid4().hex[:8]}@nutriverse.local",
            password_hash=PasswordHasher.hash("ValidPass123!"),
            role=Role.user.value,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        token = create_access_token(user)
        user_id = user.id

    headers = {"Authorization": f"Bearer {token}"}

    # Save initial profile
    client.put(
        "/api/nutrition-targets/me",
        json={"age": 28, "sex": "male", "height": 178, "weight": 74, "activity_level": "sedentary", "consent_given": True},
        headers=headers,
    )

    # Manually simulate a retired legacy version in database
    with SessionLocal() as s:
        prof = s.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user_id))
        prof.calculation_version = "harris_benedict_1919_deprecated"
        s.commit()

    # Retrieve profile
    res = client.get("/api/nutrition-targets/me", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Must explicitly disclose that the version is retired / unrecognized
    assert data["target_freshness"]["retired_or_unrecognized_version"] is True
    assert data["target_freshness"]["is_stale"] is True
    assert data["target_freshness"]["version_matched"] is False
    assert "retired or unrecognized" in data["target_freshness"]["note"]
    assert any("Notice: Stored profile references an unrecognized or retired calculation method" in w for w in data["estimate"]["warnings"])


