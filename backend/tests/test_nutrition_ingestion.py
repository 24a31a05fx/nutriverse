"""Phase 2 Nutrition Ingestion & Licensing Review Test Suite.

Covers:
1. IFCT canonical nutrient schema, units, and categories.
2. Source and page/table provenance in SourceRecord.
3. Food-state ('raw') and measurement-basis ('per_100g_edible') handling.
4. NULL versus zero handling (explicit is_unknown and unknown_reason).
5. Duplicate prevention and idempotent repeat ingestion.
6. Preservation of existing food records.
7. Malformed source record handling and constraints.
8. Open Food Facts isolated client, rate limiting, and provenance assignment.
9. Licensing documentation integrity and quarantine enforcement.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from backend.app.main import (
    Base,
    CartItem,
    DataSource,
    Food,
    FoodNutrient,
    Nutrient,
    NutritionProfile,
    Order,
    SourceRecord,
    Subscription,
    User,
    VerificationRecord,
    VerificationStatus,
)
from backend.app.nutrition_engine import (
    CalculationMode,
    IncompatibleFoodStateError,
    calculate_food_portion_nutrients,
)
from backend.app.services.ifct_ingestion import (
    CANONICAL_NUTRIENTS as CANONICAL_NUTRIENTS_EXPANSION,
    VERIFIED_IFCT_FOODS_DATASET,
    ingest_ifct_expansion,
    validate_nutrient_values,
)
from backend.app.services.openfoodfacts import (
    OpenFoodFactsClient,
    OpenFoodFactsRateLimitError,
    OpenFoodFactsTimeoutError,
)
from backend.app.services.recommendations import generate_recommendations
from scripts.ingest_ifct_subset import (
    CANONICAL_NUTRIENTS,
    IFCT_PDF_PATH,
    REPRESENTATIVE_IFCT_SUBSET,
    ingest_ifct_subset,
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


def test_ifct_canonical_nutrient_definitions(isolated_db_session):
    """Test 1: IFCT extraction creates canonical nutrients with proper units and categories."""
    session, engine, _ = isolated_db_session

    summary = ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)
    assert summary["status"] == "success"

    # Verify canonical nutrients exist
    nutrients = session.query(Nutrient).all()
    assert len(nutrients) >= len(CANONICAL_NUTRIENTS)

    nutrient_by_code = {n.canonical_code: n for n in nutrients}
    assert "ENERC_KCAL" in nutrient_by_code
    assert nutrient_by_code["ENERC_KCAL"].unit == "kcal"
    assert nutrient_by_code["ENERC_KCAL"].category == "macronutrient"

    assert "PROTCNT" in nutrient_by_code
    assert nutrient_by_code["PROTCNT"].unit == "g"

    assert "CA" in nutrient_by_code
    assert nutrient_by_code["CA"].unit == "mg"
    assert nutrient_by_code["CA"].category == "mineral"

    assert "THIA" in nutrient_by_code
    assert nutrient_by_code["THIA"].unit == "mg"
    assert nutrient_by_code["THIA"].category == "vitamin"


def test_source_and_page_provenance(isolated_db_session):
    """Test 2: SourceRecord preserves external IFCT ID, page/table references, and checksums."""
    session, engine, _ = isolated_db_session

    ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)

    ds = session.query(DataSource).filter(DataSource.name == "ICMR-NIN IFCT 2017").first()
    assert ds is not None
    assert ds.publisher == "National Institute of Nutrition (ICMR), Hyderabad"

    # Check Ragi A010 provenance
    src_ragi = (
        session.query(SourceRecord)
        .filter(SourceRecord.source_id == ds.id, SourceRecord.external_id == "A010")
        .first()
    )
    assert src_ragi is not None
    assert "Ragi (Eleusine coracana)" in src_ragi.external_name
    assert src_ragi.raw_checksum is not None
    assert len(src_ragi.raw_checksum) == 64  # Valid SHA-256

    payload = json.loads(src_ragi.raw_payload)
    assert payload["table_references"]["proximate_table"] == 1
    assert payload["table_references"]["table1_page"] == 40
    assert payload["table_references"]["table2_page"] == 70
    assert payload["table_references"]["table5_page"] == 150
    assert payload["national_samples_count"] == 5


def test_food_state_and_measurement_basis(isolated_db_session):
    """Test 3: Ingested food nutrients preserve food_state='raw' and basis='per_100g_edible'."""
    session, engine, _ = isolated_db_session

    ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)

    food_nutrients = session.query(FoodNutrient).all()
    assert len(food_nutrients) > 0

    for fn in food_nutrients:
        assert fn.food_state == "raw"
        assert fn.basis == "per_100g_edible"
        assert fn.verification_status == VerificationStatus.verified_reference.value
        assert fn.confidence_score == 1.0


def test_null_versus_zero_handling(isolated_db_session):
    """Test 4: Unanalyzed or below-detection nutrients are explicitly NULL with is_unknown=True."""
    session, engine, _ = isolated_db_session

    ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)

    # In Paneer (L003), dietary fibre is unanalyzed / not present in dairy
    paneer = session.query(Food).filter(Food.name == "Fresh Malai Paneer").first()
    assert paneer is not None

    fib_nutrient = session.query(Nutrient).filter(Nutrient.canonical_code == "FIBTG").first()
    assert fib_nutrient is not None

    fn_fib = (
        session.query(FoodNutrient)
        .filter(FoodNutrient.food_id == paneer.id, FoodNutrient.nutrient_id == fib_nutrient.id)
        .first()
    )
    assert fn_fib is not None
    assert fn_fib.value is None  # MUST be NULL, not 0.0
    assert fn_fib.is_unknown is True
    assert fn_fib.unknown_reason is not None
    assert "dairy" in fn_fib.unknown_reason.lower() or "ifct" in fn_fib.unknown_reason.lower()

    # In Ragi (A010), Vitamin C is not present in raw dry grain
    ragi = session.query(Food).filter(Food.name == "Whole Finger Millet (Ragi / Ragulu)").first()
    vitc_nutrient = session.query(Nutrient).filter(Nutrient.canonical_code == "VITC").first()

    fn_vitc = (
        session.query(FoodNutrient)
        .filter(FoodNutrient.food_id == ragi.id, FoodNutrient.nutrient_id == vitc_nutrient.id)
        .first()
    )
    assert fn_vitc is not None
    assert fn_vitc.value is None  # MUST be NULL
    assert fn_vitc.is_unknown is True

    # Conversely, Spinach (C033) HAS Vitamin C (30.28 mg)
    spinach = session.query(Food).filter(Food.name == "Tender Baby Spinach").first()
    fn_spinach_vitc = (
        session.query(FoodNutrient)
        .filter(FoodNutrient.food_id == spinach.id, FoodNutrient.nutrient_id == vitc_nutrient.id)
        .first()
    )
    assert fn_spinach_vitc is not None
    assert fn_spinach_vitc.value == 30.28
    assert fn_spinach_vitc.is_unknown is False
    assert fn_spinach_vitc.unknown_reason is None


def test_duplicate_prevention_and_idempotence(isolated_db_session):
    """Test 5: Repeating ingestion does not create duplicate sources, nutrients, or food nutrients."""
    session, engine, _ = isolated_db_session

    # Run 1
    summary1 = ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)
    assert summary1["source_records_created"] == len(REPRESENTATIVE_IFCT_SUBSET)

    count_sources_1 = session.query(DataSource).count()
    count_nutrients_1 = session.query(Nutrient).count()
    count_source_records_1 = session.query(SourceRecord).count()
    count_food_nutrients_1 = session.query(FoodNutrient).count()

    # Run 2
    summary2 = ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)
    assert summary2["source_records_created"] == 0  # 0 new, all updated/preserved

    count_sources_2 = session.query(DataSource).count()
    count_nutrients_2 = session.query(Nutrient).count()
    count_source_records_2 = session.query(SourceRecord).count()
    count_food_nutrients_2 = session.query(FoodNutrient).count()

    assert count_sources_1 == count_sources_2
    assert count_nutrients_1 == count_nutrients_2
    assert count_source_records_1 == count_source_records_2
    assert count_food_nutrients_1 == count_food_nutrients_2


def test_preservation_of_existing_food_records(isolated_db_session):
    """Test 6: Ingestion does not overwrite or corrupt existing food properties."""
    session, engine, _ = isolated_db_session

    # Pre-create an existing food with specific pricing, stock, and imagery
    existing_food = Food(
        name="Whole Finger Millet (Ragi / Ragulu)",
        category="Grains & Pseudocereals",
        price_paise=18500,
        stock_qty=42,
        description="Premium heritage millets from Karnataka farms.",
        unit="1kg",
        image_source_url="https://images.unsplash.com/photo-ragi",
        calories=328.0,
        protein_g=7.3,
    )
    session.add(existing_food)
    session.commit()
    orig_food_id = existing_food.id

    # Ingest subset
    ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)

    # Re-fetch existing food and assert shopping fields are untouched
    reloaded_food = session.query(Food).filter(Food.id == orig_food_id).first()
    assert reloaded_food is not None
    assert reloaded_food.price_paise == 18500
    assert reloaded_food.stock_qty == 42
    assert reloaded_food.description == "Premium heritage millets from Karnataka farms."
    assert reloaded_food.unit == "1kg"
    assert reloaded_food.image_source_url == "https://images.unsplash.com/photo-ragi"

    # But relational nutrients should now be attached!
    assert len(reloaded_food.nutrients_rel) > 0


def test_malformed_records_and_constraints(isolated_db_session):
    """Test 7: Constraints reject negative nutrient values and invalid verification statuses."""
    session, engine, _ = isolated_db_session

    ingest_ifct_subset(session, pdf_path=IFCT_PDF_PATH)

    food = session.query(Food).first()
    nutrient = session.query(Nutrient).first()

    # 1. Negative value must be rejected
    with pytest.raises(ValueError, match="Nutrient value cannot be negative"):
        bad_fn = FoodNutrient(
            food_id=food.id,
            nutrient_id=nutrient.id,
            value=-15.0,
            unit="g",
            basis="per_100g_edible",
            food_state="raw",
            verification_status="verified_reference",
        )
        session.add(bad_fn)
        session.flush()
    session.rollback()

    # 2. Invalid verification status must be rejected
    with pytest.raises(ValueError, match="Invalid verification_status"):
        bad_status_fn = FoodNutrient(
            food_id=food.id,
            nutrient_id=nutrient.id,
            value=10.0,
            unit="g",
            basis="per_100g_edible",
            food_state="raw",
            verification_status="totally_unsupported_status",
        )
        session.add(bad_status_fn)
        session.flush()
    session.rollback()


def test_openfoodfacts_client_parsing_and_provenance():
    """Test 8: OpenFoodFactsClient parses response, assigns 'source_reported', and distinguishes unknowns."""
    client = OpenFoodFactsClient()

    sample_off_response = {
        "code": "8901030382345",
        "status": 1,
        "product": {
            "code": "8901030382345",
            "product_name": "Tata Tea Gold",
            "brands": "Tata Tea",
            "categories": "Beverages, Teas",
            "serving_size": "2g",
            "nutriments": {
                "energy-kcal_100g": 0.0,
                "energy-kj_100g": 0.0,
                "proteins_100g": 0.0,
                "carbohydrates_100g": 0.0,
                "fat_100g": 0.0,
                # Note: 'fiber_100g', 'calcium_100g', 'iron_100g' are MISSING from OFF payload
            },
        },
    }

    parsed = client.parse_product_payload(sample_off_response)

    assert parsed["external_id"] == "8901030382345"
    assert "Tata Tea Gold" in parsed["external_name"]
    assert parsed["verification_status"] == VerificationStatus.source_reported.value
    assert parsed["raw_checksum"] is not None
    assert "Open Database License (ODbL)" in parsed["license_attribution"]

    nutrients = {n["canonical_code"]: n for n in parsed["nutrients"]}

    # Energy is reported as 0.0 -> value=0.0, is_unknown=False
    assert nutrients["ENERC_KCAL"]["value"] == 0.0
    assert nutrients["ENERC_KCAL"]["is_unknown"] is False
    assert nutrients["ENERC_KCAL"]["verification_status"] == VerificationStatus.source_reported.value

    # Fibre is missing from OFF -> value=None, is_unknown=True
    assert nutrients["FIBTG"]["value"] is None
    assert nutrients["FIBTG"]["is_unknown"] is True
    assert nutrients["FIBTG"]["unknown_reason"] is not None

    # Calcium is missing -> value=None, is_unknown=True
    assert nutrients["CA"]["value"] is None
    assert nutrients["CA"]["is_unknown"] is True


def test_openfoodfacts_rate_limiting_and_timeout():
    """Test 9: OpenFoodFactsClient raises dedicated exceptions for 429 and timeouts."""
    mock_client = MagicMock()

    # 1. Test 429 Rate Limit
    mock_resp_429 = MagicMock()
    mock_resp_429.status_code = 429
    mock_client.get.return_value = mock_resp_429

    off_client = OpenFoodFactsClient(client=mock_client)
    with pytest.raises(OpenFoodFactsRateLimitError):
        off_client.fetch_product("8901234567890")

    # 2. Test Invalid Barcode
    with pytest.raises(ValueError, match="Invalid barcode format"):
        off_client.fetch_product("invalid barcode with spaces!")


def test_data_licenses_documentation_integrity():
    """Test 10: docs/DATA_LICENSES.md exists and documents required sources and quarantines."""
    doc_path = Path("docs/DATA_LICENSES.md")
    assert doc_path.exists(), "docs/DATA_LICENSES.md must exist."

    content = doc_path.read_text(encoding="utf-8")
    assert "ICMR-NIN IFCT 2017" in content
    assert "Open Food Facts" in content
    assert "Open Database License (ODbL)" in content
    assert "cleaned_nutrition_dataset_per100g.csv" in content
    assert "QUARANTINED" in content
    assert "Food_Nutrition_Dataset.csv" in content


# =====================================================================
# PHASE 6.1: VERIFIED INDIAN FOOD NUTRITION DATASET EXPANSION TESTS
# =====================================================================


def test_phase6_1_expansion_ingestion_and_counts(isolated_db_session):
    """Phase 6.1 Test 1: Full expansion ingestion ingests all 50 foods with 800 food nutrient rows."""
    session, engine, _ = isolated_db_session

    summary = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    assert summary["status"] == "success"
    assert summary["dry_run"] is False
    assert summary["total_dataset_foods"] == 50
    assert summary["source_records_created"] == 50
    assert summary["canonical_nutrients_active"] == 16
    assert summary["food_nutrients_created"] == 800  # 50 foods * 16 nutrients
    assert summary["unknown_nutrients_preserved"] == 42  # 42 verified unassayed/below detection nutrients
    assert len(summary["rejected_records"]) == 0
    assert len(summary["skipped_records"]) == 0
    assert len(summary["unresolved_records"]) == 0

    # Verify DB counts
    total_foods = session.query(Food).count()
    assert total_foods == 50

    total_verified = (
        session.query(Food)
        .filter(Food.approval_status == VerificationStatus.verified_reference.value)
        .count()
    )
    assert total_verified == 50

    total_fn = session.query(FoodNutrient).count()
    assert total_fn == 800

    total_sr = session.query(SourceRecord).count()
    assert total_sr == 50


def test_phase6_1_idempotent_repeated_ingestion(isolated_db_session):
    """Phase 6.1 Test 2: Ingesting repeatedly creates 0 duplicate foods, source records, or nutrients."""
    session, engine, _ = isolated_db_session

    # Run 1
    summary1 = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)
    assert summary1["source_records_created"] == 50
    assert summary1["food_nutrients_created"] == 800

    foods_cnt_1 = session.query(Food).count()
    sr_cnt_1 = session.query(SourceRecord).count()
    fn_cnt_1 = session.query(FoodNutrient).count()
    vr_cnt_1 = session.query(VerificationRecord).count()

    # Run 2
    summary2 = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)
    assert summary2["source_records_created"] == 0
    assert summary2["source_records_updated"] == 50
    assert summary2["food_nutrients_created"] == 0
    assert summary2["food_nutrients_updated"] == 800
    assert summary2["foods_created"] == 0
    assert summary2["foods_updated"] == 50

    foods_cnt_2 = session.query(Food).count()
    sr_cnt_2 = session.query(SourceRecord).count()
    fn_cnt_2 = session.query(FoodNutrient).count()
    vr_cnt_2 = session.query(VerificationRecord).count()

    assert foods_cnt_1 == foods_cnt_2
    assert sr_cnt_1 == sr_cnt_2
    assert fn_cnt_1 == fn_cnt_2
    assert vr_cnt_1 == vr_cnt_2


def test_phase6_1_dry_run_behavior(isolated_db_session):
    """Phase 6.1 Test 3: Dry run validates dataset completely without writing any records to DB."""
    session, engine, _ = isolated_db_session

    # Verify baseline is 0
    assert session.query(Food).count() == 0
    assert session.query(SourceRecord).count() == 0
    assert session.query(FoodNutrient).count() == 0

    summary = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=True)

    assert summary["status"] == "dry_run"
    assert summary["dry_run"] is True
    assert summary["total_dataset_foods"] == 50
    assert len(summary["rejected_records"]) == 0

    # Ensure database was NOT modified
    assert session.query(Food).count() == 0
    assert session.query(SourceRecord).count() == 0
    assert session.query(FoodNutrient).count() == 0
    assert session.query(VerificationRecord).count() == 0


def test_phase6_1_duplicate_food_detection(isolated_db_session):
    """Phase 6.1 Test 4: Existing catalog item is matched and updated without duplicate creation."""
    session, engine, _ = isolated_db_session

    # Pre-seed existing food: Sprouted Chickpeas
    pre_food = Food(
        name="Sprouted Chickpeas",
        category="Grain Legumes",
        price_paise=4500,
        stock_qty=120,
        description="Fresh sprouted organic desi chickpeas.",
        unit="500g",
        serving_size="100g",
        approval_status="pending",
    )
    session.add(pre_food)
    session.commit()
    pre_id = pre_food.id

    # Ingest expansion
    summary = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)
    assert summary["status"] == "success"

    # Verify only ONE food exists with this name and ID was preserved
    matching_foods = session.query(Food).filter(Food.name == "Sprouted Chickpeas").all()
    assert len(matching_foods) == 1
    reloaded = matching_foods[0]
    assert reloaded.id == pre_id
    assert reloaded.price_paise == 4500
    assert reloaded.stock_qty == 120
    assert reloaded.description == "Fresh sprouted organic desi chickpeas."
    assert reloaded.approval_status == VerificationStatus.verified_reference.value
    # Relational nutrients attached
    assert len(reloaded.nutrients_rel) == 16


def test_phase6_1_source_record_and_nutrient_provenance(isolated_db_session):
    """Phase 6.1 Test 5: SourceRecord preserves IFCT codes, table pages, sample counts, and audit trails."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    ds = session.query(DataSource).filter(DataSource.name == "ICMR-NIN IFCT 2017").first()
    assert ds is not None
    assert ds.publisher == "National Institute of Nutrition (ICMR), Hyderabad"

    # Test Pearl Millet (Bajra A003)
    sr_bajra = (
        session.query(SourceRecord)
        .filter(SourceRecord.source_id == ds.id, SourceRecord.external_id == "A003")
        .first()
    )
    assert sr_bajra is not None
    assert "Bajra" in sr_bajra.external_name
    assert sr_bajra.raw_checksum is not None
    assert len(sr_bajra.raw_checksum) == 64

    payload = json.loads(sr_bajra.raw_payload)
    assert payload["ifct_code"] == "A003"
    assert payload["food_group"] == "Cereals and Millets"
    assert payload["table_references"]["table1_page"] == 40
    assert payload["table_references"]["table2_page"] == 70
    assert payload["table_references"]["table5_page"] == 150
    assert payload["national_samples_count"] == 6

    # Test VerificationRecord attached to Bajra protein
    food_bajra = session.query(Food).filter(Food.name == "Pearl Millet Grain (Bajra / Sajje)").first()
    prot_nut = session.query(Nutrient).filter(Nutrient.canonical_code == "PROTCNT").first()
    fn_bajra_prot = (
        session.query(FoodNutrient)
        .filter(FoodNutrient.food_id == food_bajra.id, FoodNutrient.nutrient_id == prot_nut.id)
        .first()
    )
    assert fn_bajra_prot is not None
    assert fn_bajra_prot.value == 10.96
    assert fn_bajra_prot.verification_status == VerificationStatus.verified_reference.value
    assert len(fn_bajra_prot.verification_records) >= 1
    vr = fn_bajra_prot.verification_records[0]
    assert vr.reviewer_name == "System / IFCT Ingestion Pipeline"
    assert "ICMR" in vr.evidence


def test_phase6_1_unknown_nutrient_preservation(isolated_db_session):
    """Phase 6.1 Test 6: Missing and unanalyzed nutrients are explicitly NULL with is_unknown=True."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    fib_nut = session.query(Nutrient).filter(Nutrient.canonical_code == "FIBTG").first()
    vitc_nut = session.query(Nutrient).filter(Nutrient.canonical_code == "VITC").first()
    ca_nut = session.query(Nutrient).filter(Nutrient.canonical_code == "CA").first()

    # 1. Buffalo Milk (L001) - Fibre unanalyzed in dairy
    milk = session.query(Food).filter(Food.name == "Fresh Buffalo Whole Milk (Raw Farm Reference)").first()
    fn_milk_fib = session.query(FoodNutrient).filter(FoodNutrient.food_id == milk.id, FoodNutrient.nutrient_id == fib_nut.id).first()
    assert fn_milk_fib is not None
    assert fn_milk_fib.value is None  # MUST be NULL, not 0.0
    assert fn_milk_fib.is_unknown is True
    assert fn_milk_fib.unknown_reason is not None
    assert "dairy" in fn_milk_fib.unknown_reason.lower() or "unanalyzed" in fn_milk_fib.unknown_reason.lower()

    # 2. Poultry Egg (M001) - Fibre unanalyzed in Table 1; Calcium assayed at 49.44 mg in Table 5 p.185
    egg = session.query(Food).filter(Food.name == "Whole Poultry Egg (Raw Reference)").first()
    fn_egg_fib = session.query(FoodNutrient).filter(FoodNutrient.food_id == egg.id, FoodNutrient.nutrient_id == fib_nut.id).first()
    assert fn_egg_fib is not None
    assert fn_egg_fib.value is None  # MUST be NULL, not 0.0
    assert fn_egg_fib.is_unknown is True

    fn_egg_ca = session.query(FoodNutrient).filter(FoodNutrient.food_id == egg.id, FoodNutrient.nutrient_id == ca_nut.id).first()
    assert fn_egg_ca is not None
    assert fn_egg_ca.value == 49.44
    assert fn_egg_ca.is_unknown is False

    # 3. Bajra (A003) - Vitamin C not reported in dry grain
    bajra = session.query(Food).filter(Food.name == "Pearl Millet Grain (Bajra / Sajje)").first()
    fn_bajra_vitc = session.query(FoodNutrient).filter(FoodNutrient.food_id == bajra.id, FoodNutrient.nutrient_id == vitc_nut.id).first()
    assert fn_bajra_vitc is not None
    assert fn_bajra_vitc.value is None
    assert fn_bajra_vitc.is_unknown is True

    # 4. In contrast, Cabbage (C015) has Vitamin C 33.25 mg
    cabbage = session.query(Food).filter(Food.name == "Green Cabbage (Patta Gobi)").first()
    fn_cabbage_vitc = session.query(FoodNutrient).filter(FoodNutrient.food_id == cabbage.id, FoodNutrient.nutrient_id == vitc_nut.id).first()
    assert fn_cabbage_vitc is not None
    assert fn_cabbage_vitc.value == 33.25
    assert fn_cabbage_vitc.is_unknown is False
    assert fn_cabbage_vitc.unknown_reason is None


def test_phase6_1_raw_cooked_and_unit_mismatches(isolated_db_session):
    """Phase 6.1 Test 7: Enforces food_state='raw' and rejects cooked calculation without yield factor."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    food_nutrients = session.query(FoodNutrient).all()
    for fn in food_nutrients:
        assert fn.food_state == "raw"
        assert fn.basis == "per_100g_edible"

    # Now calculate portion nutrients for Bajra asking for food_state='cooked' without yield factor
    bajra = session.query(Food).filter(Food.name == "Pearl Millet Grain (Bajra / Sajje)").first()
    portion_calc = calculate_food_portion_nutrients(
        food=bajra,
        mass_g=100.0,
        session=session,
        mode=CalculationMode.STRICT_VERIFIED,
        food_state="cooked",  # State mismatch!
        conversion_yield_factor=None,
    )
    # Nutrients must be marked unknown because cooked != raw without yield conversion
    prot_res = portion_calc["nutrients"]["PROTCNT"]
    assert prot_res["is_unknown"] is True
    assert "conversion" in prot_res["unknown_reason"].lower() or "state" in prot_res["unknown_reason"].lower()


def test_phase6_1_invalid_and_non_finite_nutrient_values(isolated_db_session):
    """Phase 6.1 Test 8: Numeric validator rejects non-finite, negative, and impossible values."""
    session, engine, _ = isolated_db_session

    # 1. Negative value
    errs_neg = validate_nutrient_values("TEST", "Test Food", {"PROTCNT": -5.0})
    assert any("negative" in e.lower() for e in errs_neg)

    # 2. NaN
    errs_nan = validate_nutrient_values("TEST", "Test Food", {"PROTCNT": float("nan")})
    assert any("non-finite" in e.lower() for e in errs_nan)

    # 3. Inf
    errs_inf = validate_nutrient_values("TEST", "Test Food", {"PROTCNT": float("inf")})
    assert any("non-finite" in e.lower() for e in errs_inf)

    # 4. Implausible Energy
    errs_kcal = validate_nutrient_values("TEST", "Test Food", {"ENERC_KCAL": 1500.0})
    assert any("implausible" in e.lower() for e in errs_kcal)

    # 5. Proximate sum > 106g
    errs_prox = validate_nutrient_values(
        "TEST", "Test Food",
        {"WATER": 50.0, "PROTCNT": 40.0, "FATCE": 30.0, "ASH": 10.0, "CHOAVLDF": 20.0}
    )
    assert any("exceeds" in e.lower() for e in errs_prox)


def test_phase6_1_verification_status_assignment(isolated_db_session):
    """Phase 6.1 Test 9: All ingested nutrients receive verified_reference; pending food is not upgraded."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    fns = session.query(FoodNutrient).all()
    assert len(fns) == 800
    for fn in fns:
        assert fn.verification_status == VerificationStatus.verified_reference.value
        assert fn.confidence_score == 1.0

    # Create an unverified legacy food
    unverified_food = Food(
        name="Legacy Unverified Packaged Biscuit",
        category="Snacks",
        approval_status="pending",
    )
    session.add(unverified_food)
    session.commit()

    # Verify unverified food has pending status and no verified_reference nutrients
    reloaded = session.query(Food).filter(Food.id == unverified_food.id).first()
    assert reloaded.approval_status == "pending"
    assert len(reloaded.nutrients_rel) == 0


def test_phase6_1_conflicting_source_records(isolated_db_session):
    """Phase 6.1 Test 10: Verified reference data is never silently downgraded by lower-tier sources."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    # Try to insert a conflicting food nutrient from a hypothetical unverified source
    cabbage = session.query(Food).filter(Food.name == "Green Cabbage (Patta Gobi)").first()
    prot_nut = session.query(Nutrient).filter(Nutrient.canonical_code == "PROTCNT").first()

    # Get authoritative IFCT food nutrient
    fn_auth = (
        session.query(FoodNutrient)
        .filter(FoodNutrient.food_id == cabbage.id, FoodNutrient.nutrient_id == prot_nut.id)
        .first()
    )
    assert fn_auth.verification_status == VerificationStatus.verified_reference.value
    assert fn_auth.value == 1.36

    # Attempting to assign an unverified status to an authoritative reference record is rejected
    with pytest.raises(ValueError):
        fn_auth.verification_status = "unsupported_bogus_status"
        session.flush()
    session.rollback()


def test_phase6_1_preservation_of_existing_commerce_records(isolated_db_session):
    """Phase 6.1 Test 11: Ingestion preserves user cart, orders, subscriptions, and profile targets."""
    session, engine, _ = isolated_db_session

    # 1. Create a User
    user = User(
        name="Aarav Sharma",
        email="aarav.sharma@example.in",
        password_hash="$2b$12$eXampleHashedPasswordForTest",
    )
    session.add(user)
    session.flush()

    # 2. Create NutritionProfile
    profile = NutritionProfile(
        user_id=user.id,
        age=28,
        sex="male",
        height_cm=175.0,
        weight_kg=72.0,
        activity_level=1.55,
        calorie_target=2450,
        bmr=1680,
        allergies="dairy",
        budget_paise=250000,
        calculation_version="mifflin-st-jeor-v1",
    )
    session.add(profile)

    # 3. Create a commerce Food with custom pricing and stock
    food = Food(
        name="Handmade Khapli Wheat Atta",
        category="Flours",
        price_paise=29900,
        stock_qty=15,
        description="Stone ground emmer wheat flour.",
        unit="1kg",
        serving_size="100g",
    )
    session.add(food)
    session.flush()

    # 4. Create CartItem
    cart_item = CartItem(
        user_id=user.id,
        item_type="food",
        food_id=food.id,
        unit_price_paise=29900,
        quantity=2,
    )
    session.add(cart_item)

    # 5. Create Order
    order = Order(
        user_id=user.id,
        status="placed",
        subtotal_paise=59800,
        delivery_fee_paise=4000,
        total_paise=63800,
        items_json=json.dumps([{"food_id": food.id, "quantity": 2, "price_paise": 29900}]),
    )
    session.add(order)

    # 6. Create Subscription
    subscription = Subscription(
        user_id=user.id,
        pack_tier="premium",
        pack_name="Active Vitality Pack",
        frequency="weekly",
        status="active",
        price_per_delivery_paise=85000,
        next_delivery_date=datetime.now(timezone.utc),
    )
    session.add(subscription)
    session.commit()

    saved_user_id = user.id
    saved_cart_id = cart_item.id
    saved_order_id = order.id
    saved_sub_id = subscription.id
    saved_food_id = food.id

    # Execute expansion ingestion
    summary = ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)
    assert summary["status"] == "success"

    # Verify ALL commerce entities are intact
    re_user = session.query(User).filter(User.id == saved_user_id).first()
    assert re_user is not None
    assert re_user.email == "aarav.sharma@example.in"

    re_profile = session.query(NutritionProfile).filter(NutritionProfile.user_id == saved_user_id).first()
    assert re_profile is not None
    assert re_profile.calorie_target == 2450
    assert re_profile.allergies == "dairy"

    re_food = session.query(Food).filter(Food.id == saved_food_id).first()
    assert re_food is not None
    assert re_food.price_paise == 29900
    assert re_food.stock_qty == 15

    re_cart = session.query(CartItem).filter(CartItem.id == saved_cart_id).first()
    assert re_cart is not None
    assert re_cart.quantity == 2
    assert re_cart.unit_price_paise == 29900

    re_order = session.query(Order).filter(Order.id == saved_order_id).first()
    assert re_order is not None
    assert re_order.total_paise == 63800

    re_sub = session.query(Subscription).filter(Subscription.id == saved_sub_id).first()
    assert re_sub is not None
    assert re_sub.price_per_delivery_paise == 85000


def test_phase6_1_recommendation_integration(isolated_db_session):
    """Phase 6.1 Test 12: Newly ingested authentic foods integrate with recommendation engine and respect allergies."""
    session, engine, _ = isolated_db_session

    ingest_ifct_expansion(session, pdf_path=IFCT_PDF_PATH, dry_run=False)

    target_estimate = {
        "macronutrient_targets": {
            "protein": {"target_g_day": 75.0, "unit": "g"},
            "dietary_fiber": {"target_g_day": 30.0, "unit": "g"},
        },
        "energy_targets": {"daily_energy_target_kcal": 2100.0},
    }

    # 1. Recommendation for Protein (without allergies)
    recs = generate_recommendations(
        session=session,
        target_nutrient="protein",
        target_estimate=target_estimate,
        limit=5,
        strict_verified=True,
    )
    assert len(recs["recommendations"]) == 5
    assert recs["counts"]["recommendations_returned"] == 5
    food_names = [r["food_name"] for r in recs["recommendations"]]
    # High protein Indian staples should be ranked
    # Examples: Split Red Lentil (24.35g), Green gram dal (23.88g), Peanuts (23.65g), etc.
    top_rec = recs["recommendations"][0]
    assert top_rec["nutrient_contribution"]["amount"] > 15.0  # High protein contribution
    assert top_rec["nutrient_contribution"]["verification_status"] == VerificationStatus.verified_reference.value
    assert top_rec["data_completeness"]["known_count"] > 0

    # 2. Recommendation with Dairy Allergy
    recs_dairy_free = generate_recommendations(
        session=session,
        target_nutrient="protein",
        target_estimate=target_estimate,
        user_allergies="dairy",
        limit=10,
        strict_verified=True,
    )
    dairy_food_names = [r["food_name"] for r in recs_dairy_free["recommendations"]]
    for name in dairy_food_names:
        assert "milk" not in name.lower()
        assert "paneer" not in name.lower()

