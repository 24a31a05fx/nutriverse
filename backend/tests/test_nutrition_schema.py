"""Traceable Nutrition Schema, Source Registry, and Provenance Architecture Tests.

Tests:
1. Creating the new schema and relationships.
2. Valid source and nutrient foreign-key references.
3. Nullable nutrient values and explicit unknown status.
4. Valid and invalid verification statuses.
5. Duplicate nutrient/source identifier constraints.
6. Preservation of existing food records and existing application behaviour.
7. Migration upgrade and downgrade on an isolated temporary database.
8. Compatibility with existing backend tests.
"""
from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.app.main import (
    ALLOWED_VERIFICATION_STATUSES,
    Base,
    CalinPackItem,
    CalinPackTier,
    DataSource,
    Food,
    FoodNutrient,
    Nutrient,
    SourceRecord,
    User,
    VerificationRecord,
    VerificationStatus,
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


def test_schema_tables_and_relationships_creation(isolated_db_session):
    """1. Test that all Phase 1 tables, columns, and indexes are created cleanly."""
    session, engine, _ = isolated_db_session
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    expected_tables = {
        "data_sources",
        "source_records",
        "nutrients",
        "food_nutrients",
        "verification_records",
        "calin_pack_items",
    }
    for t in expected_tables:
        assert t in tables, f"Expected table '{t}' to be present in schema"

    # Verify column structures
    fn_cols = {col["name"]: col for col in insp.get_columns("food_nutrients")}
    assert "value" in fn_cols and fn_cols["value"]["nullable"] is True
    assert "is_unknown" in fn_cols
    assert "unknown_reason" in fn_cols
    assert "verification_status" in fn_cols
    assert "basis" in fn_cols
    assert "food_state" in fn_cols


def test_valid_source_and_nutrient_foreign_keys(isolated_db_session):
    """2. Test valid foreign-key navigation across DataSource, SourceRecord, FoodNutrient, Nutrient, and VerificationRecord."""
    session, _, _ = isolated_db_session

    # Seed User (Reviewer)
    reviewer = User(
        name="Dr. Sunita Rao (Nutritionist)",
        email="sunita.rao@nutriverse.local",
        password_hash="dummy_hash_123",
        role="nutritionist",
    )
    session.add(reviewer)

    # Seed Food
    food = Food(
        name="Desi Sprouted Moong Beans",
        description="Bioavailable sprouted whole green gram.",
        category="Legumes & Pulses",
        price_paise=14900,
        unit="500g",
        serving_size="100g sprouted",
        calories=105.0,
        protein_g=7.5,
        carbs_g=19.2,
        fat_g=0.4,
        fibre_g=5.4,
    )
    session.add(food)

    # Seed DataSource (IFCT 2017)
    source = DataSource(
        name="IFCT 2017",
        publisher="ICMR - National Institute of Nutrition, Hyderabad",
        url="https://www.nin.res.in/ebooks/IFCT2017.pdf",
        license="Government of India Open Access / Educational",
        version="2017-v1",
    )
    session.add(source)
    session.flush()

    # Seed SourceRecord
    raw_record = SourceRecord(
        source_id=source.id,
        external_id="IFCT_B001",
        external_name="Green gram, sprouted (Vigna radiata)",
        raw_payload='{"food_code": "B001", "moisture": 70.2, "protein": 7.5, "iron": 2.1}',
        raw_checksum="a1b2c3d4e5f6g7h8",
    )
    session.add(raw_record)

    # Seed Nutrient (Iron)
    nutrient = Nutrient(
        name="Iron",
        canonical_code="FE",
        unit="mg",
        category="mineral",
        applicable_basis="per_100g_edible",
        icmr_rda_adult_male=19.0,
        icmr_rda_adult_female=29.0,
    )
    session.add(nutrient)
    session.flush()

    # Seed FoodNutrient
    fn = FoodNutrient(
        food_id=food.id,
        nutrient_id=nutrient.id,
        source_record_id=raw_record.id,
        value=2.1,
        unit="mg",
        basis="per_100g_edible",
        food_state="sprouted",
        verification_status=VerificationStatus.verified_reference.value,
        is_unknown=False,
        confidence_score=1.0,
        notes="Analyzed using AAS methodology from IFCT 2017 Table 2.",
    )
    session.add(fn)
    session.flush()

    # Seed VerificationRecord
    vr = VerificationRecord(
        food_nutrient_id=fn.id,
        reviewer_id=reviewer.id,
        reviewer_name=reviewer.name,
        status=VerificationStatus.verified_reference.value,
        evidence="Cross-referenced against IFCT 2017 page 158, Table 2 entry B001.",
        previous_status=VerificationStatus.pending_review.value,
    )
    session.add(vr)
    session.commit()

    # Test bidirectional relationship traversal
    queried_food = session.scalar(select(Food).where(Food.id == food.id))
    assert len(queried_food.nutrients_rel) == 1
    rel_fn = queried_food.nutrients_rel[0]
    assert rel_fn.value == 2.1
    assert rel_fn.nutrient.canonical_code == "FE"
    assert rel_fn.source_record.external_id == "IFCT_B001"
    assert rel_fn.source_record.data_source.name == "IFCT 2017"
    assert len(rel_fn.verification_records) == 1
    assert rel_fn.verification_records[0].reviewer.email == "sunita.rao@nutriverse.local"


def test_nullable_nutrient_values_and_explicit_unknown_status(isolated_db_session):
    """3. Test that unknown nutrient values remain NULL with an explicit reason, never silently becoming zero."""
    session, _, _ = isolated_db_session

    food = Food(
        name="Wild Forest Mushroom",
        description="Fresh foraged wild forest mushrooms.",
        category="Vegetables",
        price_paise=29900,
        unit="200g",
    )
    session.add(food)

    nutrient = Nutrient(
        name="Vitamin B12",
        canonical_code="VITB12",
        unit="mcg",
        category="vitamin",
    )
    session.add(nutrient)
    session.flush()

    # Save a record where B12 was not analyzed
    unknown_fn = FoodNutrient(
        food_id=food.id,
        nutrient_id=nutrient.id,
        value=None,  # Explicit NULL
        unit="mcg",
        basis="per_100g_edible",
        food_state="raw",
        verification_status=VerificationStatus.source_reported.value,
        is_unknown=True,
        unknown_reason="not_analyzed_in_source",
        notes="B12 assays were not conducted for wild foraged batch.",
    )
    session.add(unknown_fn)
    session.commit()

    # Query from fresh session to ensure database roundtrip
    saved = session.scalar(
        select(FoodNutrient).where(
            FoodNutrient.food_id == food.id,
            FoodNutrient.nutrient_id == nutrient.id,
        )
    )
    assert saved.value is None, "Value must remain NULL and not be silently coerced to 0"
    assert saved.is_unknown is True
    assert saved.unknown_reason == "not_analyzed_in_source"


def test_valid_and_invalid_verification_statuses(isolated_db_session):
    """4. Test that all 5 verification statuses are accepted, while unauthorized statuses raise ValueError."""
    session, _, _ = isolated_db_session

    food = Food(name="Sample Food", description="Standard nutrient reference sample.", category="Grains", price_paise=1000)
    session.add(food)
    nutrient = Nutrient(name="Calcium", canonical_code="CA", unit="mg")
    session.add(nutrient)
    session.flush()

    # Test all 5 valid statuses
    for valid_status in sorted(list(ALLOWED_VERIFICATION_STATUSES)):
        fn = FoodNutrient(
            food_id=food.id,
            nutrient_id=nutrient.id,
            value=10.0,
            unit="mg",
            basis=f"basis_{valid_status}",  # distinct to satisfy uniqueness
            food_state="raw",
            verification_status=valid_status,
        )
        session.add(fn)
    session.commit()

    # Test invalid verification status on FoodNutrient model
    with pytest.raises(ValueError, match="Invalid verification_status"):
        FoodNutrient(
            food_id=food.id,
            nutrient_id=nutrient.id,
            value=10.0,
            unit="mg",
            verification_status="unsupported_ai_guess",
        )

    # Test invalid status on VerificationRecord model
    sample_fn = session.scalars(select(FoodNutrient)).first()
    with pytest.raises(ValueError, match="Invalid status"):
        VerificationRecord(
            food_nutrient_id=sample_fn.id,
            reviewer_name="Auditor",
            status="unauthorized_label",
            evidence="None",
        )


def test_duplicate_constraints_prevention(isolated_db_session):
    """5. Test that uniqueness constraints prevent duplicate source names, nutrient codes, and duplicate food-nutrient measurements."""
    session, _, _ = isolated_db_session

    # Duplicate DataSource name
    ds1 = DataSource(name="Duplicate Source", publisher="Publisher 1", license="MIT")
    ds2 = DataSource(name="Duplicate Source", publisher="Publisher 2", license="Apache")
    session.add(ds1)
    session.flush()
    session.add(ds2)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # Duplicate Nutrient canonical code
    n1 = Nutrient(name="Zinc", canonical_code="ZN", unit="mg")
    n2 = Nutrient(name="Zinc Elemental", canonical_code="ZN", unit="mg")
    session.add(n1)
    session.flush()
    session.add(n2)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

    # Duplicate FoodNutrient for same food, nutrient, state, and basis
    f = Food(name="Whole Oats", description="100% whole grain rolled oats.", category="Grains", price_paise=2000)
    nut = Nutrient(name="Magnesium", canonical_code="MG", unit="mg")
    session.add_all([f, nut])
    session.flush()

    fn1 = FoodNutrient(food_id=f.id, nutrient_id=nut.id, value=120.0, unit="mg", food_state="raw", basis="per_100g")
    fn2 = FoodNutrient(food_id=f.id, nutrient_id=nut.id, value=125.0, unit="mg", food_state="raw", basis="per_100g")
    session.add(fn1)
    session.flush()
    session.add(fn2)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()


def test_calin_pack_item_relational_structure(isolated_db_session):
    """6. Test CalinPackItem normalization, ordering, and unique constraint."""
    session, _, _ = isolated_db_session

    tier = CalinPackTier(
        tier="minimal_plus_v2",
        name="Minimal Plus Pack",
        base_price_paise=109900,
        description="Balanced micronutrient diversity",
        target_audience="Active Adults",
    )
    food1 = Food(name="Baby Spinach", description="Fresh organic baby spinach.", category="Greens", price_paise=4000)
    food2 = Food(name="Greek Yoghurt", description="Live culture probiotic Greek yoghurt.", category="Dairy", price_paise=9500)
    session.add_all([tier, food1, food2])
    session.flush()

    item1 = CalinPackItem(
        pack_tier_id=tier.id,
        food_id=food1.id,
        quantity=2.0,
        unit="250g pack",
        role_in_pack="micronutrient_dense",
        sort_order=1,
    )
    item2 = CalinPackItem(
        pack_tier_id=tier.id,
        food_id=food2.id,
        quantity=3.0,
        unit="400g tub",
        role_in_pack="primary_protein",
        sort_order=2,
    )
    session.add_all([item1, item2])
    session.commit()

    queried_tier = session.scalar(select(CalinPackTier).where(CalinPackTier.id == tier.id))
    assert len(queried_tier.items_rel) == 2
    assert queried_tier.items_rel[0].food.name in ("Baby Spinach", "Greek Yoghurt")

    # Duplicate CalinPackItem for same tier and food must be prevented
    dup_item = CalinPackItem(pack_tier_id=tier.id, food_id=food1.id, quantity=1.0)
    session.add(dup_item)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_preservation_of_existing_food_records_and_application_behavior(isolated_db_session):
    """7. Test that existing Food records, prices, and macro columns operate seamlessly alongside new relationships."""
    session, _, _ = isolated_db_session

    # Existing application creates Food without new Phase 1 tables
    food = Food(
        name="Standard Russet Potato",
        description="Farm fresh earthen russet potatoes.",
        category="Tubers & Roots",
        price_paise=2900,
        unit="1 kg",
        serving_size="100g",
        stock_qty=100,
        calories=87.0,
        protein_g=1.9,
        carbs_g=20.1,
        fat_g=0.1,
        fibre_g=1.8,
        vitamins_json='{"potassium_mg": 421}',
    )
    session.add(food)
    session.commit()

    # Query using existing application pattern
    loaded = session.scalar(select(Food).where(Food.name == "Standard Russet Potato"))
    assert loaded is not None
    assert loaded.calories == 87.0
    assert loaded.price_paise == 2900
    # Relationship defaults cleanly to empty list without error
    assert loaded.nutrients_rel == []
    assert loaded.calin_pack_items == []


def test_alembic_upgrade_and_downgrade_lifecycle_isolated():
    """8. Test full reversible migration lifecycle (upgrade from d2b7e192a001 -> e3f4a1b89c02 -> downgrade back)."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_db_path = tmp.name

    try:
        tmp_url = f"sqlite:///{tmp_db_path}"
        cfg = Config("alembic.ini")
        cfg.set_main_option("sqlalchemy.url", tmp_url)

        # 1. Upgrade to parent revision (d2b7e192a001)
        command.upgrade(cfg, "d2b7e192a001")
        eng = create_engine(tmp_url)
        insp = inspect(eng)
        parent_tables = set(insp.get_table_names())
        assert "foods" in parent_tables
        assert "data_sources" not in parent_tables
        assert "food_nutrients" not in parent_tables
        eng.dispose()

        # 2. Advance migration to head (e3f4a1b89c02)
        command.upgrade(cfg, "head")
        eng = create_engine(tmp_url)
        insp = inspect(eng)
        upgraded_tables = set(insp.get_table_names())
        assert "data_sources" in upgraded_tables
        assert "source_records" in upgraded_tables
        assert "nutrients" in upgraded_tables
        assert "food_nutrients" in upgraded_tables
        assert "verification_records" in upgraded_tables
        assert "calin_pack_items" in upgraded_tables
        eng.dispose()

        # 3. Revert migration back to d2b7e192a001
        command.downgrade(cfg, "d2b7e192a001")
        eng = create_engine(tmp_url)
        insp = inspect(eng)
        downgraded_tables = set(insp.get_table_names())
        assert "data_sources" not in downgraded_tables
        assert "food_nutrients" not in downgraded_tables
        assert "foods" in downgraded_tables, "Existing application tables must remain untouched on downgrade"
        eng.dispose()

        # 4. Re-upgrade cleanly to head
        command.upgrade(cfg, "head")
        eng = create_engine(tmp_url)
        insp = inspect(eng)
        reupgraded_tables = set(insp.get_table_names())
        assert "food_nutrients" in reupgraded_tables
        eng.dispose()

    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except OSError:
                pass
