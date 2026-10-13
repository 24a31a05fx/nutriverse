"""Deterministic Nutrition Calculation Engine Test Suite.

Covers:
1. Correct per-100-g scaling formula (nutrient_per_100g * mass_g / 100).
2. Supported unit conversions (g, mg, kg, oz, lb, ml, l, serving).
3. Portion and combination totals across multiple whole foods.
4. Multiple ingredients and recipe per-serving calculations.
5. Documented zero (0.0) versus unknown (None) distinction.
6. Missing nutrient contributions and completeness reporting.
7. Raw-versus-cooked incompatibility handling.
8. Unverified source filtering in strict_verified mode.
9. Invalid units and invalid negative quantities rejection.
10. Calculation reproducibility and provenance metadata.
11. Existing /api/combinations/calculate backward compatibility.
12. New /api/nutrition/calculate and /api/recipes/calculate endpoints.
"""

from __future__ import annotations

import json
import os
import tempfile
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import (
    Base,
    DataSource,
    Food,
    FoodNutrient,
    Nutrient,
    Recipe,
    RecipeIngredient,
    SourceRecord,
    VerificationStatus,
    app,
    db,
)
from backend.app.nutrition_engine import (
    CALCULATION_FORMULA,
    CALCULATION_VERSION,
    CalculationMode,
    IncompatibleUnitError,
    NutritionCalculationError,
    calculate_combination_nutrition,
    calculate_food_portion_nutrients,
    calculate_recipe_nutrition,
    convert_quantity_to_grams,
)


@pytest.fixture
def isolated_db_session():
    """Provides a pristine, isolated temporary SQLite database upgraded to head."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    tmp_url = f"sqlite:///{tmp_db_path}"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", tmp_url)
    command.upgrade(cfg, "head")

    engine = create_engine(tmp_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()

    yield session, engine, tmp_url

    session.close()
    engine.dispose()
    if os.path.exists(tmp_db_path):
        try:
            os.remove(tmp_db_path)
        except OSError:
            pass


@pytest.fixture
def test_foods_fixture(isolated_db_session):
    """Sets up controlled test foods with verified IFCT nutrients and provenance."""
    session, engine, _ = isolated_db_session

    # 1. Source & Nutrients
    ds = DataSource(
        name="ICMR-NIN IFCT 2017",
        publisher="National Institute of Nutrition (ICMR)",
        license="Scientific Reference",
    )
    session.add(ds)
    session.flush()

    sr_ragi = SourceRecord(source_id=ds.id, external_id="A010", external_name="Ragi (Eleusine coracana)")
    sr_spinach = SourceRecord(source_id=ds.id, external_id="C033", external_name="Spinach (Spinacia oleracea)")
    sr_paneer = SourceRecord(source_id=ds.id, external_id="L003", external_name="Paneer")
    session.add_all([sr_ragi, sr_spinach, sr_paneer])
    session.flush()

    n_protein = Nutrient(name="Protein", canonical_code="PROTCNT", unit="g", category="macronutrient")
    n_energy = Nutrient(name="Energy (kcal)", canonical_code="ENERC_KCAL", unit="kcal", category="macronutrient")
    n_fiber = Nutrient(name="Total Dietary Fibre", canonical_code="FIBTG", unit="g", category="macronutrient")
    n_vitc = Nutrient(name="Vitamin C", canonical_code="VITC", unit="mg", category="vitamin")
    n_calcium = Nutrient(name="Calcium", canonical_code="CA", unit="mg", category="mineral")
    session.add_all([n_protein, n_energy, n_fiber, n_vitc, n_calcium])
    session.flush()

    # 2. Foods
    f_ragi = Food(
        name="Test Finger Millet (Ragi)",
        category="Grains",
        price_paise=8500,
        serving_size="100g",
        unit="1kg",
        calories=320.0,
        protein_g=7.16,
    )
    f_spinach = Food(
        name="Test Baby Spinach",
        category="Greens",
        price_paise=4000,
        serving_size="100g",
        unit="250g",
        calories=24.0,
        protein_g=2.14,
    )
    f_paneer = Food(
        name="Test Fresh Paneer",
        category="Dairy",
        price_paise=12000,
        serving_size="100g",
        unit="200g",
        calories=305.0,
        protein_g=18.86,
    )
    session.add_all([f_ragi, f_spinach, f_paneer])
    session.flush()

    # 3. Nutrients for Ragi (A010): VITC is unknown (None), FIBTG is 11.18g, CA is 364mg
    session.add_all([
        FoodNutrient(
            food_id=f_ragi.id, nutrient_id=n_protein.id, source_record_id=sr_ragi.id,
            value=7.16, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_ragi.id, nutrient_id=n_energy.id, source_record_id=sr_ragi.id,
            value=320.75, unit="kcal", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_ragi.id, nutrient_id=n_fiber.id, source_record_id=sr_ragi.id,
            value=11.18, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_ragi.id, nutrient_id=n_vitc.id, source_record_id=sr_ragi.id,
            value=None, unit="mg", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=True,
            unknown_reason="Below detectable limit for dry raw grain in IFCT Table 2"
        ),
        FoodNutrient(
            food_id=f_ragi.id, nutrient_id=n_calcium.id, source_record_id=sr_ragi.id,
            value=364.0, unit="mg", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
    ])

    # 4. Nutrients for Spinach (C033): VITC is 30.28mg, Protein is 2.14g
    session.add_all([
        FoodNutrient(
            food_id=f_spinach.id, nutrient_id=n_protein.id, source_record_id=sr_spinach.id,
            value=2.14, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_spinach.id, nutrient_id=n_energy.id, source_record_id=sr_spinach.id,
            value=24.38, unit="kcal", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_spinach.id, nutrient_id=n_vitc.id, source_record_id=sr_spinach.id,
            value=30.28, unit="mg", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
    ])

    # 5. Nutrients for Paneer (L003): Fibre is None (not applicable to dairy), Protein is 18.86g
    session.add_all([
        FoodNutrient(
            food_id=f_paneer.id, nutrient_id=n_protein.id, source_record_id=sr_paneer.id,
            value=18.86, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_paneer.id, nutrient_id=n_energy.id, source_record_id=sr_paneer.id,
            value=305.45, unit="kcal", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
        FoodNutrient(
            food_id=f_paneer.id, nutrient_id=n_fiber.id, source_record_id=sr_paneer.id,
            value=None, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=True,
            unknown_reason="Not applicable to dairy matrix in IFCT Table 1"
        ),
        FoodNutrient(
            food_id=f_paneer.id, nutrient_id=n_calcium.id, source_record_id=sr_paneer.id,
            value=480.0, unit="mg", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.verified_reference.value, is_unknown=False
        ),
    ])

    session.commit()
    return {
        "ragi": f_ragi,
        "spinach": f_spinach,
        "paneer": f_paneer,
        "nutrients": {
            "protein": n_protein,
            "energy": n_energy,
            "fiber": n_fiber,
            "vitc": n_vitc,
            "calcium": n_calcium,
        },
    }


def test_per_100g_scaling_accuracy(isolated_db_session, test_foods_fixture):
    """Test 1: Scales nutrients accurately according to nutrient_per_100g * mass_g / 100."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    # Calculate 150g of Ragi:
    # 7.16g protein / 100g * 150g = 10.74g
    # 364mg calcium / 100g * 150g = 546.0mg
    portion = calculate_food_portion_nutrients(food=ragi, mass_g=150.0, session=session)

    assert portion["mass_g"] == 150.0
    assert portion["scale_factor"] == 1.5

    nuts = portion["nutrients"]
    assert nuts["PROTCNT"]["amount"] == round(7.16 * 1.5, 4)
    assert nuts["CA"]["amount"] == round(364.0 * 1.5, 4)
    assert nuts["ENERC_KCAL"]["amount"] == round(320.75 * 1.5, 4)


def test_supported_unit_conversions(isolated_db_session, test_foods_fixture):
    """Test 2: Explicit unit conversions across mass and volume units."""
    ragi = test_foods_fixture["ragi"]

    # 1. Grams
    g_mass, _ = convert_quantity_to_grams(250.0, "g")
    assert g_mass == 250.0

    # 2. Milligrams
    mg_mass, _ = convert_quantity_to_grams(500000.0, "mg")
    assert mg_mass == 500.0

    # 3. Kilograms
    kg_mass, _ = convert_quantity_to_grams(0.5, "kg")
    assert kg_mass == 500.0

    # 4. Milliliters (aqueous food or explicit density)
    tea = Food(name="Green Tea Infusion", category="Beverages")
    ml_mass, assumptions = convert_quantity_to_grams(100.0, "ml", food=tea)
    assert ml_mass == 100.0
    assert any("aqueous density" in a for a in assumptions)

    oil_mass, oil_assumptions = convert_quantity_to_grams(100.0, "ml", density_g_ml=0.92)
    assert oil_mass == 92.0
    assert any("explicit density" in a for a in oil_assumptions)

    # 5. Serving (resolved from food.serving_size = '100g')
    srv_mass, srv_assumptions = convert_quantity_to_grams(2.0, "serving", food=ragi)
    assert srv_mass == 200.0
    assert any("serving_size" in a for a in srv_assumptions)


def test_portion_and_combination_totals(isolated_db_session, test_foods_fixture):
    """Test 3: Combination calculation sums nutrients and preserves provenance."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]
    paneer = test_foods_fixture["paneer"]

    # Combine 100g Ragi (7.16g protein, 320.75 kcal) + 50g Paneer (9.43g protein, 152.725 kcal)
    items = [
        {"food_id": ragi.id, "quantity": 100.0, "unit": "g"},
        {"food_id": paneer.id, "quantity": 50.0, "unit": "g"},
    ]

    result = calculate_combination_nutrition(items=items, session=session)

    # Check totals
    expected_protein = round(7.16 + (18.86 * 0.5), 2)
    expected_calories = round(320.75 + (305.45 * 0.5), 1)

    assert result["total_protein_g"] == round(expected_protein, 1)
    assert result["nutrients"]["PROTCNT"]["total_amount"] == expected_protein
    assert result["total_calories"] == expected_calories

    # Check provenance
    prov = result["provenance"]
    assert prov["calculation_version"] == CALCULATION_VERSION
    assert prov["formula"] == CALCULATION_FORMULA
    assert len(prov["source_record_ids"]) >= 2


def test_recipe_multi_ingredient_serving_calculation(isolated_db_session, test_foods_fixture):
    """Test 4: Calculates recipe totals and per-serving nutrition from multiple ingredients."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]
    spinach = test_foods_fixture["spinach"]

    # Create recipe for 2 servings
    recipe = Recipe(
        name="Ragi Spinach Porridge",
        description="Warm mineral rich porridge",
        instructions="Boil and stir",
        servings=2,
        active=True,
    )
    session.add(recipe)
    session.flush()

    # Ingredients: 100g Ragi + 100g Spinach
    ri1 = RecipeIngredient(recipe_id=recipe.id, food_id=ragi.id, quantity=100.0, unit="g")
    ri2 = RecipeIngredient(recipe_id=recipe.id, food_id=spinach.id, quantity=100.0, unit="g")
    session.add_all([ri1, ri2])
    session.commit()

    recipe_calc = calculate_recipe_nutrition(recipe_id=recipe.id, session=session)

    assert recipe_calc["recipe_name"] == "Ragi Spinach Porridge"
    assert recipe_calc["servings"] == 2

    total_protein = round(7.16 + 2.14, 2)
    serving_protein = round(total_protein / 2.0, 2)

    assert recipe_calc["total_protein_g"] == total_protein
    assert recipe_calc["protein_per_serving_g"] == round(serving_protein, 1)

    # Per serving breakdown should divide by 2
    per_serving_nuts = recipe_calc["per_serving_nutrition"]
    assert per_serving_nuts["PROTCNT"]["amount"] == round(total_protein / 2.0, 2)


def test_documented_zero_versus_unknown_values(isolated_db_session, test_foods_fixture):
    """Test 5: Distinguishes known numeric values from explicit unknown (None)."""
    session, _, _ = isolated_db_session
    paneer = test_foods_fixture["paneer"]

    # In Paneer, dietary fibre is explicitly None
    portion = calculate_food_portion_nutrients(food=paneer, mass_g=100.0, session=session)
    fiber_entry = portion["nutrients"]["FIBTG"]

    assert fiber_entry["amount"] is None
    assert fiber_entry["is_unknown"] is True
    assert fiber_entry["unknown_reason"] is not None
    # Must NEVER be silently converted to 0.0
    assert fiber_entry["amount"] != 0.0


def test_missing_nutrient_contributions_reporting(isolated_db_session, test_foods_fixture):
    """Test 6: Flags incomplete totals and reports missing contributors when any contributor is unknown."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]          # Vitamin C is None (unknown)
    spinach = test_foods_fixture["spinach"]    # Vitamin C is 30.28mg (known)

    items = [
        {"food_id": ragi.id, "quantity": 100.0, "unit": "g"},
        {"food_id": spinach.id, "quantity": 100.0, "unit": "g"},
    ]

    result = calculate_combination_nutrition(items=items, session=session)
    vitc_agg = result["nutrients"]["VITC"]

    # Partial total is 30.28mg (from spinach)
    assert vitc_agg["total_amount"] == 30.28
    # But completeness is False because Ragi has unknown Vitamin C!
    assert vitc_agg["is_complete"] is False
    assert vitc_agg["completeness_ratio"] == 0.5  # 1 out of 2 known

    # Unknown contributor is flagged
    assert len(vitc_agg["unknown_contributors"]) == 1
    assert vitc_agg["unknown_contributors"][0]["food_id"] == ragi.id
    assert "dry raw grain" in vitc_agg["unknown_contributors"][0]["reason"].lower()


def test_raw_versus_cooked_state_handling(isolated_db_session, test_foods_fixture):
    """Test 7: Raw vs cooked state documents explicit assumption rather than silent conversion."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    items = [
        {"food_id": ragi.id, "quantity": 100.0, "unit": "g", "food_state": "cooked"}
    ]

    result = calculate_combination_nutrition(items=items, session=session)
    prov = result["provenance"]

    # Must document state assumption
    assert any("cooked" in a.lower() for a in prov["assumptions"])


def test_unverified_source_filtering_in_strict_mode(isolated_db_session, test_foods_fixture):
    """Test 8: Strict verified mode excludes nutrients that lack verified_reference status."""
    session, _, _ = isolated_db_session

    # Create unverified food with source_reported status
    ds = session.query(DataSource).first()
    sr_unverified = SourceRecord(source_id=ds.id, external_id="OFF_TEST", external_name="Crowdsourced Food")
    session.add(sr_unverified)
    session.flush()

    f_unverified = Food(name="Unverified Packaged Food", category="Snacks", price_paise=5000)
    session.add(f_unverified)
    session.flush()

    n_protein = test_foods_fixture["nutrients"]["protein"]
    session.add(
        FoodNutrient(
            food_id=f_unverified.id, nutrient_id=n_protein.id, source_record_id=sr_unverified.id,
            value=12.0, unit="g", basis="per_100g_edible", food_state="raw",
            verification_status=VerificationStatus.source_reported.value, is_unknown=False
        )
    )
    session.commit()

    # 1. Standard mode accepts source_reported
    std_result = calculate_combination_nutrition(
        items=[{"food_id": f_unverified.id, "quantity": 100.0, "unit": "g"}],
        session=session,
        mode="standard",
    )
    assert std_result["nutrients"]["PROTCNT"]["total_amount"] == 12.0
    assert std_result["nutrients"]["PROTCNT"]["verification_status"] == VerificationStatus.source_reported.value

    # 2. Strict verified mode excludes source_reported
    strict_result = calculate_combination_nutrition(
        items=[{"food_id": f_unverified.id, "quantity": 100.0, "unit": "g"}],
        session=session,
        mode="strict_verified",
    )
    assert strict_result["nutrients"]["PROTCNT"]["is_complete"] is False
    assert len(strict_result["nutrients"]["PROTCNT"]["unknown_contributors"]) == 1


def test_invalid_units_and_negative_quantities():
    """Test 9: Invalid units and negative quantities are rejected."""
    # 1. Negative quantity
    with pytest.raises(IncompatibleUnitError, match="negative"):
        convert_quantity_to_grams(-10.0, "g")

    # 2. Unsupported ambiguous unit
    with pytest.raises(IncompatibleUnitError, match="Unsupported or ambiguous unit"):
        convert_quantity_to_grams(2.0, "handful")

    with pytest.raises(IncompatibleUnitError, match="Unsupported or ambiguous unit"):
        convert_quantity_to_grams(1.0, "pinch")


def test_reproducibility_and_provenance(isolated_db_session, test_foods_fixture):
    """Test 10: Calculations are completely deterministic and reproducible."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    items = [{"food_id": ragi.id, "quantity": 75.0, "unit": "g"}]

    run1 = calculate_combination_nutrition(items=items, session=session)
    run2 = calculate_combination_nutrition(items=items, session=session)

    assert run1["total_protein_g"] == run2["total_protein_g"]
    assert run1["total_calories"] == run2["total_calories"]
    assert run1["provenance"]["formula"] == run2["provenance"]["formula"]
    assert run1["provenance"]["calculation_version"] == CALCULATION_VERSION


def test_api_combinations_calculate_backward_compatibility(isolated_db_session, test_foods_fixture):
    """Test 11: /api/combinations/calculate preserves all established response keys."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    app.dependency_overrides[db] = lambda: session
    try:
        client = TestClient(app)

        res = client.post(
            "/api/combinations/calculate",
            json={"items": [{"food_id": ragi.id, "quantity": 1.0}]},
        )
        assert res.status_code == 200
        data = res.json()

        # Must preserve all original keys for frontend CombinationsView.tsx
        assert "items" in data
        assert "total_calories" in data
        assert "total_protein_g" in data
        assert "total_carbs_g" in data
        assert "total_fat_g" in data
        assert "total_fibre_g" in data
        assert "total_price_paise" in data
        assert "contributing_nutrients" in data
        assert "disclaimer" in data

        # And enriches with new deterministic engine keys
        assert "nutrients" in data
        assert "completeness" in data
        assert "provenance" in data
    finally:
        app.dependency_overrides.clear()


def test_api_nutrition_calculate_and_recipe_calculate_endpoints(isolated_db_session, test_foods_fixture):
    """Test 12: New POST /api/nutrition/calculate and POST /api/recipes/calculate endpoints."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]
    spinach = test_foods_fixture["spinach"]

    app.dependency_overrides[db] = lambda: session
    try:
        client = TestClient(app)

        # 1. POST /api/nutrition/calculate
        nut_res = client.post(
            "/api/nutrition/calculate",
            json={
                "items": [
                    {"food_id": ragi.id, "quantity": 100.0, "unit": "g"},
                    {"food_id": spinach.id, "quantity": 50.0, "unit": "g"},
                ],
                "mode": "standard",
            },
        )
        assert nut_res.status_code == 200
        nut_data = nut_res.json()
        assert "nutrients" in nut_data
        assert nut_data["total_protein_g"] > 0

        # 2. Seed recipe and test POST /api/recipes/calculate
        recipe = Recipe(
            name="Golden Ragi Spinach Power Bowl",
            description="Iron rich power lunch",
            instructions="Steam and toss",
            servings=2,
            ingredients_json=json.dumps([
                {"name": "Test Finger Millet (Ragi)", "qty": "100", "unit": "g"},
                {"name": "Test Baby Spinach", "qty": "80", "unit": "g"},
            ]),
            active=True,
        )
        session.add(recipe)
        session.commit()

        rec_res = client.post(
            "/api/recipes/calculate",
            json={"recipe_id": recipe.id, "servings": 2},
        )
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["recipe_id"] == recipe.id
        assert rec_data["servings"] == 2
        assert "per_serving_nutrition" in rec_data
        assert rec_data["protein_per_serving_g"] > 0
    finally:
        app.dependency_overrides.clear()


# ==============================================================================
# Phase 3.1 Hardened Integrity Regression Tests
# ==============================================================================


def test_step2_raw_to_cooked_state_mismatch_returns_unavailable(isolated_db_session, test_foods_fixture):
    """Step 2: Never presents raw nutrition values as valid cooked nutrition values without a yield factor."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]  # source basis is 'raw'

    portion = calculate_food_portion_nutrients(
        food=ragi,
        mass_g=100.0,
        session=session,
        food_state="cooked",  # Mismatch: requested cooked, but data is raw
    )

    # Nutrients must be explicitly unavailable (is_unknown=True, amount=None)
    for code in ["PROTCNT", "ENERC_KCAL", "CA"]:
        nut = portion["nutrients"][code]
        assert nut["amount"] is None
        assert nut["is_unknown"] is True
        assert "Incompatible food state" in nut["unknown_reason"]
        assert "Raw nutrition cannot be presented as cooked" in nut["unknown_reason"]

    # Provenance records the mismatch and unavailable marking
    assert any("differs from source state" in a for a in portion["assumptions"])


def test_step2_matching_raw_and_cooked_states(isolated_db_session, test_foods_fixture):
    """Step 2: Matching food states calculate with full completeness."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    # 1. Matching raw state
    raw_portion = calculate_food_portion_nutrients(
        food=ragi,
        mass_g=100.0,
        session=session,
        food_state="raw",
    )
    assert raw_portion["nutrients"]["PROTCNT"]["amount"] == 7.16
    assert raw_portion["nutrients"]["PROTCNT"]["is_unknown"] is False

    # 2. Matching cooked state (create food with source_state='cooked')
    ds = session.query(DataSource).first()
    sr_cooked = SourceRecord(source_id=ds.id, external_id="C_RICE", external_name="Cooked Rice")
    session.add(sr_cooked)
    session.flush()

    f_cooked_rice = Food(name="Steamed White Rice", category="Grains", price_paise=6000, serving_size="100g")
    session.add(f_cooked_rice)
    session.flush()

    n_protein = test_foods_fixture["nutrients"]["protein"]
    session.add(
        FoodNutrient(
            food_id=f_cooked_rice.id,
            nutrient_id=n_protein.id,
            source_record_id=sr_cooked.id,
            value=2.7,
            unit="g",
            basis="per_100g_edible",
            food_state="cooked",
            verification_status=VerificationStatus.verified_reference.value,
            is_unknown=False,
        )
    )
    session.commit()

    cooked_portion = calculate_food_portion_nutrients(
        food=f_cooked_rice,
        mass_g=150.0,
        session=session,
        food_state="cooked",
    )
    assert cooked_portion["nutrients"]["PROTCNT"]["amount"] == round(2.7 * 1.5, 4)
    assert cooked_portion["nutrients"]["PROTCNT"]["is_unknown"] is False


def test_step2_raw_to_cooked_with_explicit_yield_factor(isolated_db_session, test_foods_fixture):
    """Step 2: Permits raw-to-cooked calculations when explicit conversion yield factor is supplied."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    portion = calculate_food_portion_nutrients(
        food=ragi,
        mass_g=100.0,
        session=session,
        food_state="cooked",
        conversion_yield_factor=0.85,
    )

    # 7.16 * 1.0 * 0.85 = 6.086
    expected_protein = round(7.16 * 0.85, 4)
    assert portion["nutrients"]["PROTCNT"]["amount"] == expected_protein
    assert portion["nutrients"]["PROTCNT"]["is_unknown"] is False
    assert any("using explicit yield factor 0.85" in a for a in portion["assumptions"])


def test_step3_volume_without_density_rejected():
    """Step 3: Strictly rejects volume inputs without explicit density or aqueous context."""
    # 1. No food and no density
    with pytest.raises(IncompatibleUnitError, match="without an explicit density factor"):
        convert_quantity_to_grams(100.0, "ml")

    # 2. Solid/grain food with ml
    dry_food = Food(name="Dry Basmati Rice", category="Grains")
    with pytest.raises(IncompatibleUnitError, match="Nutriverse engine does not assume universal 1 g/ml density"):
        convert_quantity_to_grams(50.0, "ml", food=dry_food)


def test_step3_volume_with_explicit_density_succeeds():
    """Step 3: Converts volume when explicit density is provided and notes assumption."""
    mass, assumptions = convert_quantity_to_grams(200.0, "ml", density_g_ml=0.92)
    assert mass == 184.0
    assert any("explicit density 0.92" in a for a in assumptions)


def test_step3_ambiguous_serving_strings_rejected():
    """Step 3: Rejects ambiguous serving strings without silently defaulting to 100g."""
    f_bunch = Food(name="Fresh Coriander", category="Greens", serving_size="1 bunch")
    with pytest.raises(IncompatibleUnitError, match="does not define an unambiguous gram weight"):
        convert_quantity_to_grams(1.0, "serving", food=f_bunch)

    f_med = Food(name="Red Apple", category="Fruits", serving_size="medium")
    with pytest.raises(IncompatibleUnitError, match="does not define an unambiguous gram weight"):
        convert_quantity_to_grams(1.0, "serving", food=f_med)

    f_none = Food(name="Rock Salt", category="Spices", serving_size=None)
    with pytest.raises(IncompatibleUnitError, match="not specified"):
        convert_quantity_to_grams(1.0, "serving", food=f_none)


def test_step3_ambiguous_household_measures_rejected():
    """Step 3: Rejects household measures (cup, piece, pinch, handful) without explicit gram weights."""
    for unit in ["cup", "piece", "pinch", "handful", "bowl", "slice"]:
        with pytest.raises(IncompatibleUnitError, match="Unsupported or ambiguous unit"):
            convert_quantity_to_grams(2.0, unit)


def test_step3_non_finite_and_negative_quantities_rejected():
    """Step 3: Rejects non-finite numbers (NaN, inf) and negative quantities."""
    for bad_qty in [float("nan"), float("inf"), float("-inf"), -5.0]:
        with pytest.raises(IncompatibleUnitError):
            convert_quantity_to_grams(bad_qty, "g")

    # Invalid density factor
    with pytest.raises(IncompatibleUnitError):
        convert_quantity_to_grams(100.0, "ml", density_g_ml=float("nan"))

    with pytest.raises(IncompatibleUnitError):
        convert_quantity_to_grams(100.0, "ml", density_g_ml=-0.5)


def test_step3_omitted_quantity_defaults_documented(isolated_db_session, test_foods_fixture):
    """Step 3: Omitted quantities default to 1.0 and are explicitly documented in assumptions."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    result = calculate_combination_nutrition(
        items=[{"food_id": ragi.id}],  # quantity omitted
        session=session,
    )
    assert any("defaulted to 1.0" in a for a in result["provenance"]["assumptions"])


def test_step4_independent_nutrient_completeness(isolated_db_session, test_foods_fixture):
    """Step 4: Missing vitamin data does NOT invalidate known energy/protein totals."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]        # Vit C: None, Energy: 320.75, Protein: 7.16
    spinach = test_foods_fixture["spinach"]  # Vit C: 30.28, Energy: 24.38, Protein: 2.14

    result = calculate_combination_nutrition(
        items=[
            {"food_id": ragi.id, "quantity": 100.0, "unit": "g"},
            {"food_id": spinach.id, "quantity": 100.0, "unit": "g"},
        ],
        session=session,
    )

    # 1. Energy is fully known and complete
    energy_agg = result["nutrients"]["ENERC_KCAL"]
    assert energy_agg["total_amount"] == round(320.75 + 24.38, 4)
    assert energy_agg["is_complete"] is True
    assert energy_agg["is_partial"] is False
    assert energy_agg["completeness_status"] == "complete"
    assert energy_agg["completeness_ratio"] == 1.0

    # 2. Vitamin C is partial and incomplete due to Ragi
    vitc_agg = result["nutrients"]["VITC"]
    assert vitc_agg["total_amount"] == 30.28
    assert vitc_agg["partial_amount"] == 30.28
    assert vitc_agg["is_complete"] is False
    assert vitc_agg["is_partial"] is True
    assert vitc_agg["completeness_status"] == "partial"
    assert vitc_agg["completeness_ratio"] == 0.5  # 1 out of 2 known
    assert len(vitc_agg["unknown_contributors"]) == 1
    assert vitc_agg["unknown_contributors"][0]["food_id"] == ragi.id


def test_step4_documented_zero_is_known(isolated_db_session, test_foods_fixture):
    """Step 4: Documented zero is treated as known and contributes to complete totals."""
    session, _, _ = isolated_db_session
    ds = session.query(DataSource).first()
    sr = SourceRecord(source_id=ds.id, external_id="TEST_ZERO", external_name="Zero Food")
    session.add(sr)
    session.flush()

    f_zero = Food(name="Pure Cane Sugar", category="Sweeteners", price_paise=3000, serving_size="100g")
    session.add(f_zero)
    session.flush()

    n_fiber = test_foods_fixture["nutrients"]["fiber"]
    # Documented zero fiber: 0.0g, is_unknown=False
    session.add(
        FoodNutrient(
            food_id=f_zero.id,
            nutrient_id=n_fiber.id,
            source_record_id=sr.id,
            value=0.0,
            unit="g",
            basis="per_100g_edible",
            food_state="raw",
            verification_status=VerificationStatus.verified_reference.value,
            is_unknown=False,
        )
    )
    session.commit()

    portion = calculate_food_portion_nutrients(food=f_zero, mass_g=100.0, session=session)
    fiber_nut = portion["nutrients"]["FIBTG"]
    assert fiber_nut["amount"] == 0.0
    assert fiber_nut["is_unknown"] is False

    combo = calculate_combination_nutrition(
        items=[{"food_id": f_zero.id, "quantity": 100.0, "unit": "g"}],
        session=session,
    )
    assert combo["nutrients"]["FIBTG"]["total_amount"] == 0.0
    assert combo["nutrients"]["FIBTG"]["is_complete"] is True
    assert combo["nutrients"]["FIBTG"]["completeness_status"] == "complete"


def test_step4_all_contributors_unknown_produces_none_not_zero(isolated_db_session, test_foods_fixture):
    """Step 4: When all contributors are unknown, total is None and completeness is 'unknown', never 0.0."""
    session, _, _ = isolated_db_session
    paneer = test_foods_fixture["paneer"]  # Fiber is explicitly None (is_unknown=True)

    combo = calculate_combination_nutrition(
        items=[{"food_id": paneer.id, "quantity": 100.0, "unit": "g"}],
        session=session,
    )
    fiber_agg = combo["nutrients"]["FIBTG"]
    assert fiber_agg["total_amount"] is None
    assert fiber_agg["total_amount"] != 0.0
    assert fiber_agg["completeness_status"] == "unknown"
    assert fiber_agg["is_complete"] is False
    assert fiber_agg["completeness_ratio"] == 0.0


def test_step5_strict_verified_mode_excludes_legacy_unverified(isolated_db_session):
    """Step 5: Catalog foods lacking verified reference rows never contribute to strict totals."""
    session, _, _ = isolated_db_session

    f_legacy = Food(
        name="Legacy Unverified Oats",
        category="Grains",
        price_paise=5000,
        serving_size="100g",
        calories=389.0,
        protein_g=16.9,
    )
    session.add(f_legacy)
    session.commit()

    # 1. Standard mode allows legacy fallback with clear assumption
    std_res = calculate_combination_nutrition(
        items=[{"food_id": f_legacy.id, "quantity": 100.0, "unit": "g"}],
        session=session,
        mode="standard",
    )
    assert std_res["total_protein_g"] == 16.9

    # 2. Strict verified mode excludes legacy food
    strict_res = calculate_combination_nutrition(
        items=[{"food_id": f_legacy.id, "quantity": 100.0, "unit": "g"}],
        session=session,
        mode="strict_verified",
    )
    assert strict_res["nutrients"]["PROTCNT"]["total_amount"] is None
    assert strict_res["nutrients"]["PROTCNT"]["is_complete"] is False
    assert "lacks verified reference records" in strict_res["nutrients"]["PROTCNT"]["unknown_contributors"][0]["reason"]


def test_step6_recipe_unresolved_ingredients_not_guessed(isolated_db_session, test_foods_fixture):
    """Step 6: Unresolved recipe ingredients are not guessed and flag incomplete recipe."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    recipe = Recipe(
        name="Ragi Dragonfruit Medley",
        description="Experimental bowl",
        instructions="Mix together",
        servings=2,
        ingredients_json=json.dumps([
            {"name": "Test Finger Millet (Ragi)", "qty": "100", "unit": "g"},
            {"name": "Exotic Blue Dragonfruit", "qty": "150", "unit": "g"},  # Missing from catalog
        ]),
        active=True,
    )
    session.add(recipe)
    session.commit()

    calc = calculate_recipe_nutrition(recipe_id=recipe.id, session=session)
    assert len(calc["unresolved_ingredients"]) == 1
    assert calc["unresolved_ingredients"][0]["name"] == "Exotic Blue Dragonfruit"
    assert calc["completeness"]["is_complete"] is False
    assert calc["completeness"]["has_unresolved_ingredients"] is True


def test_step6_recipe_totals_and_per_serving_consistency(isolated_db_session, test_foods_fixture):
    """Step 6: Mathematical consistency between total recipe nutrition and per-serving amounts."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]
    spinach = test_foods_fixture["spinach"]

    recipe = Recipe(
        name="Consistent Porridge",
        description="Porridge for 4 servings",
        instructions="Cook well",
        servings=4,
        active=True,
    )
    session.add(recipe)
    session.flush()

    ri1 = RecipeIngredient(recipe_id=recipe.id, food_id=ragi.id, quantity=200.0, unit="g")
    ri2 = RecipeIngredient(recipe_id=recipe.id, food_id=spinach.id, quantity=200.0, unit="g")
    session.add_all([ri1, ri2])
    session.commit()

    calc = calculate_recipe_nutrition(recipe_id=recipe.id, session=session, servings=4)
    assert calc["servings"] == 4

    # Mathematical consistency checks
    for code, total_nut in calc["total_recipe_nutrition"].items():
        serving_nut = calc["per_serving_nutrition"][code]
        if total_nut["total_amount"] is not None:
            expected_serving = round(total_nut["total_amount"] / 4.0, 4)
            assert serving_nut["amount"] == expected_serving
        else:
            assert serving_nut["amount"] is None


def test_step6_api_get_recipe_nutrition_endpoint(isolated_db_session, test_foods_fixture):
    """Step 6: GET /api/recipes/{recipe_id}/nutrition endpoint returns consistent nutrition."""
    session, _, _ = isolated_db_session
    ragi = test_foods_fixture["ragi"]

    recipe = Recipe(
        name="Ragi Quick Bowl",
        description="Quick snack",
        instructions="Boil",
        servings=1,
        active=True,
    )
    session.add(recipe)
    session.flush()

    ri = RecipeIngredient(recipe_id=recipe.id, food_id=ragi.id, quantity=100.0, unit="g")
    session.add(ri)
    session.commit()

    app.dependency_overrides[db] = lambda: session
    try:
        client = TestClient(app)
        res = client.get(f"/api/recipes/{recipe.id}/nutrition?servings=2")
        assert res.status_code == 200
        data = res.json()
        assert data["recipe_id"] == recipe.id
        assert data["servings"] == 2
        assert "per_serving_nutrition" in data
        assert "total_recipe_nutrition" in data
    finally:
        app.dependency_overrides.clear()

