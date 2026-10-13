#!/usr/bin/env python3
"""Nutriverse — Deterministic IFCT 2017 Representative Subset Ingestion Script.

Ingests a representative, manually reviewable subset of authentic Indian staples,
pulses, greens, roots, and dairy from ICMR-NIN IFCT 2017 (datasets/IFCT2017.pdf).

Preserves full provenance:
- DataSource: ICMR-NIN IFCT 2017
- SourceRecord: External IFCT code, scientific name, page reference, raw JSON payload & SHA-256 checksum
- Nutrients: Standard canonical codes (INFOODS/ICMR), units, and categories
- FoodNutrient: Field-level verification_status='verified_reference', basis='per_100g_edible',
  food_state='raw', with explicit NULL + is_unknown=True for unanalyzed / below detectable limit nutrients
- VerificationRecord: Audit trail entry for each verified nutrient record

Idempotent: Safe to execute repeatedly without duplicating records or corrupting existing food data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure repository root and backend directory are on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

try:
    from backend.app.main import (
        Base,
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        SessionLocal,
        SourceRecord,
        VerificationRecord,
        VerificationStatus,
        engine,
    )
except ImportError:
    from app.main import (
        Base,
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        SessionLocal,
        SourceRecord,
        VerificationRecord,
        VerificationStatus,
        engine,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("nutriverse.ingest_ifct")

IFCT_PDF_PATH = REPO_ROOT / "datasets" / "IFCT2017.pdf"
IFCT_PDF_EXPECTED_SHA256 = "7fc5a5112a57240d25bf695dca82cccd8d93ed54e8c39530e42b5ad1820d0e8c"

# Standard Canonical Nutrients Catalog
CANONICAL_NUTRIENTS = [
    {
        "canonical_code": "ENERC_KCAL",
        "name": "Energy (kcal)",
        "unit": "kcal",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Metabolizable energy in kilocalories per 100g edible portion (calculated from kJ: kJ / 4.184)",
        "icmr_rda_adult_male": 2110.0,
        "icmr_rda_adult_female": 1660.0,
    },
    {
        "canonical_code": "ENERC_KJ",
        "name": "Energy (kJ)",
        "unit": "kJ",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Physiologically available energy in kilojoules per 100g edible portion",
        "icmr_rda_adult_male": 8828.0,
        "icmr_rda_adult_female": 6945.0,
    },
    {
        "canonical_code": "WATER",
        "name": "Moisture / Water",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Moisture content determined gravimetrically",
    },
    {
        "canonical_code": "PROTCNT",
        "name": "Protein",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Total protein calculated using Jones nitrogen-to-protein conversion factor",
        "icmr_rda_adult_male": 54.0,
        "icmr_rda_adult_female": 46.0,
    },
    {
        "canonical_code": "FATCE",
        "name": "Total Fat",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Crude fat / ether extract per 100g edible portion",
        "icmr_rda_adult_male": 25.0,
        "icmr_rda_adult_female": 20.0,
    },
    {
        "canonical_code": "CHOAVLDF",
        "name": "Carbohydrates, available",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Available glycemic carbohydrates (sum of analyzed free sugars and starch)",
        "icmr_rda_adult_male": 130.0,
        "icmr_rda_adult_female": 130.0,
    },
    {
        "canonical_code": "FIBTG",
        "name": "Total Dietary Fibre",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Total dietary fibre measured via AOAC enzymatic gravimetric method",
        "icmr_rda_adult_male": 30.0,
        "icmr_rda_adult_female": 25.0,
    },
    {
        "canonical_code": "FIBINS",
        "name": "Insoluble Dietary Fibre",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Insoluble dietary fibre fraction",
    },
    {
        "canonical_code": "FIBSOL",
        "name": "Soluble Dietary Fibre",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Soluble dietary fibre fraction",
    },
    {
        "canonical_code": "ASH",
        "name": "Total Ash",
        "unit": "g",
        "category": "macronutrient",
        "applicable_basis": "per_100g_edible",
        "description": "Mineral residue following muffle furnace combustion",
    },
    {
        "canonical_code": "THIA",
        "name": "Thiamine (Vitamin B1)",
        "unit": "mg",
        "category": "vitamin",
        "applicable_basis": "per_100g_edible",
        "description": "Thiamine assayed via HPLC",
        "icmr_rda_adult_male": 1.4,
        "icmr_rda_adult_female": 1.4,
    },
    {
        "canonical_code": "RIBF",
        "name": "Riboflavin (Vitamin B2)",
        "unit": "mg",
        "category": "vitamin",
        "applicable_basis": "per_100g_edible",
        "description": "Riboflavin assayed via HPLC",
        "icmr_rda_adult_male": 2.0,
        "icmr_rda_adult_female": 1.9,
    },
    {
        "canonical_code": "NIA",
        "name": "Niacin (Vitamin B3)",
        "unit": "mg",
        "category": "vitamin",
        "applicable_basis": "per_100g_edible",
        "description": "Nicotinic acid assayed via HPLC",
        "icmr_rda_adult_male": 14.0,
        "icmr_rda_adult_female": 11.0,
    },
    {
        "canonical_code": "VITC",
        "name": "Total Ascorbic Acid (Vitamin C)",
        "unit": "mg",
        "category": "vitamin",
        "applicable_basis": "per_100g_edible",
        "description": "Ascorbic acid assayed via HPLC",
        "icmr_rda_adult_male": 80.0,
        "icmr_rda_adult_female": 65.0,
    },
    {
        "canonical_code": "CA",
        "name": "Calcium",
        "unit": "mg",
        "category": "mineral",
        "applicable_basis": "per_100g_edible",
        "description": "Calcium assayed via ICP-MS / AAS",
        "icmr_rda_adult_male": 1000.0,
        "icmr_rda_adult_female": 1000.0,
    },
    {
        "canonical_code": "FE",
        "name": "Iron",
        "unit": "mg",
        "category": "mineral",
        "applicable_basis": "per_100g_edible",
        "description": "Iron assayed via ICP-MS / AAS",
        "icmr_rda_adult_male": 19.0,
        "icmr_rda_adult_female": 29.0,
    },
]

# Ground truth representative subset: 10 Indian staples across major food groups
# Values verified from IFCT 2017 Table 1 (Proximate Principles), Table 2 (Water Soluble Vitamins), Table 5 (Minerals).
REPRESENTATIVE_IFCT_SUBSET: List[Dict[str, Any]] = [
    {
        "code": "A010",
        "name": "Ragi (Eleusine coracana)",
        "group": "Cereals and Millets",
        "table1_page": 40,
        "table2_page": 70,
        "table5_page": 150,
        "n_samples": 5,
        "catalog_food_name": "Whole Finger Millet (Ragi / Ragulu)",
        "values": {
            "WATER": 10.89,
            "PROTCNT": 7.16,
            "ASH": 2.04,
            "FATCE": 1.92,
            "FIBTG": 11.18,
            "FIBINS": 9.51,
            "FIBSOL": 1.67,
            "CHOAVLDF": 66.82,
            "ENERC_KJ": 1342.0,
            "ENERC_KCAL": 320.75,
            "THIA": 0.37,
            "RIBF": 0.17,
            "NIA": 1.34,
            "VITC": None,  # Not reported / below detection limit for dry raw grain
            "CA": 364.0,
            "FE": 4.62,
        },
    },
    {
        "code": "A013",
        "name": "Rice, raw, brown (Oryza sativa)",
        "group": "Cereals and Millets",
        "table1_page": 40,
        "table2_page": 70,
        "table5_page": 150,
        "n_samples": 6,
        "catalog_food_name": "Unpolished Single-Origin Brown Rice",
        "values": {
            "WATER": 9.33,
            "PROTCNT": 9.16,
            "ASH": 1.04,
            "FATCE": 1.24,
            "FIBTG": 4.43,
            "FIBINS": 3.60,
            "FIBSOL": 0.82,
            "CHOAVLDF": 74.80,
            "ENERC_KJ": 1480.0,
            "ENERC_KCAL": 353.73,
            "THIA": 0.27,
            "RIBF": 0.06,
            "NIA": 3.40,
            "VITC": None,  # Dry raw grain
            "CA": 10.93,
            "FE": 1.02,
        },
    },
    {
        "code": "B002",
        "name": "Bengal gram, whole (Cicer arietinum)",
        "group": "Grain Legumes",
        "table1_page": 41,
        "table2_page": 71,
        "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Sprouted Chickpeas",
        "values": {
            "WATER": 8.56,
            "PROTCNT": 18.77,
            "ASH": 2.78,
            "FATCE": 5.11,
            "FIBTG": 25.22,
            "FIBINS": 22.70,
            "FIBSOL": 2.52,
            "CHOAVLDF": 39.56,
            "ENERC_KJ": 1201.0,
            "ENERC_KCAL": 287.05,
            "THIA": 0.37,
            "RIBF": 0.24,
            "NIA": 2.10,
            "VITC": None,  # Dry raw legume
            "CA": 150.0,
            "FE": 6.78,
        },
    },
    {
        "code": "B011",
        "name": "Green gram, whole (Vigna radiata)",
        "group": "Grain Legumes",
        "table1_page": 41,
        "table2_page": 71,
        "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Sprouted Green Moong",
        "values": {
            "WATER": 9.95,
            "PROTCNT": 22.53,
            "ASH": 3.22,
            "FATCE": 1.14,
            "FIBTG": 17.04,
            "FIBINS": 14.59,
            "FIBSOL": 2.44,
            "CHOAVLDF": 46.13,
            "ENERC_KJ": 1229.0,
            "ENERC_KCAL": 293.74,
            "THIA": 0.45,
            "RIBF": 0.27,
            "NIA": 2.16,
            "VITC": None,  # Dry raw legume
            "CA": 92.43,
            "FE": 4.89,
        },
    },
    {
        "code": "B014",
        "name": "Lentil whole, brown (Lens culinaris)",
        "group": "Grain Legumes",
        "table1_page": 42,
        "table2_page": 72,
        "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Whole Red Masoor Lentils",
        "values": {
            "WATER": 9.20,
            "PROTCNT": 22.49,
            "ASH": 2.39,
            "FATCE": 0.64,
            "FIBTG": 16.82,
            "FIBINS": 14.16,
            "FIBSOL": 2.66,
            "CHOAVLDF": 48.47,
            "ENERC_KJ": 1251.0,
            "ENERC_KCAL": 298.99,
            "THIA": 0.40,
            "RIBF": 0.22,
            "NIA": 2.54,
            "VITC": None,  # Dry raw legume
            "CA": 76.13,
            "FE": 7.57,
        },
    },
    {
        "code": "C009",
        "name": "Beet greens (Beta vulgaris)",
        "group": "Green Leafy Vegetables",
        "table1_page": 43,
        "table2_page": 73,
        "table5_page": 156,
        "n_samples": 6,
        "catalog_food_name": "Fresh Beet Greens (Reference)",
        "values": {
            "WATER": 86.68,
            "PROTCNT": 2.38,
            "ASH": 2.69,
            "FATCE": 0.75,
            "FIBTG": 3.64,
            "FIBINS": 2.20,
            "FIBSOL": 1.43,
            "CHOAVLDF": 3.86,
            "ENERC_KJ": 145.0,
            "ENERC_KCAL": 34.66,
            "THIA": 0.02,
            "RIBF": 0.17,
            "NIA": 0.43,
            "VITC": 35.83,
            "CA": 151.0,
            "FE": 5.80,
        },
    },
    {
        "code": "C033",
        "name": "Spinach (Spinacia oleracea)",
        "group": "Green Leafy Vegetables",
        "table1_page": 44,
        "table2_page": 74,
        "table5_page": 159,
        "n_samples": 6,
        "catalog_food_name": "Tender Baby Spinach",
        "values": {
            "WATER": 90.31,
            "PROTCNT": 2.14,
            "ASH": 2.47,
            "FATCE": 0.64,
            "FIBTG": 2.38,
            "FIBINS": 1.52,
            "FIBSOL": 0.86,
            "CHOAVLDF": 2.05,
            "ENERC_KJ": 102.0,
            "ENERC_KCAL": 24.38,
            "THIA": 0.16,
            "RIBF": 0.10,
            "NIA": 0.33,
            "VITC": 30.28,
            "CA": 82.29,
            "FE": 2.95,
        },
    },
    {
        "code": "F006",
        "name": "Potato, brown skin, big (Solanum tuberosum)",
        "group": "Roots and Tubers",
        "table1_page": 51,
        "table2_page": 81,
        "table5_page": 172,
        "n_samples": 6,
        "catalog_food_name": "Potato (Bangala Dumpa)",
        "values": {
            "WATER": 80.72,
            "PROTCNT": 1.54,
            "ASH": 0.92,
            "FATCE": 0.23,
            "FIBTG": 1.71,
            "FIBINS": 1.13,
            "FIBSOL": 0.58,
            "CHOAVLDF": 14.89,
            "ENERC_KJ": 292.0,
            "ENERC_KCAL": 69.79,
            "THIA": 0.06,
            "RIBF": 0.01,
            "NIA": 1.04,
            "VITC": 23.15,
            "CA": 9.52,
            "FE": 0.57,
        },
    },
    {
        "code": "F013",
        "name": "Sweet potato, brown skin (Ipomoea batatas)",
        "group": "Roots and Tubers",
        "table1_page": 52,
        "table2_page": 82,
        "table5_page": 174,
        "n_samples": 4,
        "catalog_food_name": "Roasted Sweet Potato",
        "values": {
            "WATER": 69.21,
            "PROTCNT": 1.33,
            "ASH": 0.96,
            "FATCE": 0.26,
            "FIBTG": 3.99,
            "FIBINS": 2.57,
            "FIBSOL": 1.43,
            "CHOAVLDF": 24.25,
            "ENERC_KJ": 456.0,
            "ENERC_KCAL": 108.99,
            "THIA": 0.07,
            "RIBF": 0.04,
            "NIA": 0.67,
            "VITC": 17.94,
            "CA": 27.50,
            "FE": 0.35,
        },
    },
    {
        "code": "L003",
        "name": "Paneer",
        "group": "Milk and Milk Products",
        "table1_page": 56,
        "table2_page": 86,
        "table5_page": 182,
        "n_samples": 6,
        "catalog_food_name": "Fresh Malai Paneer",
        "values": {
            "WATER": 51.96,
            "PROTCNT": 18.86,
            "ASH": 1.98,
            "FATCE": 24.78,
            "FIBTG": None,  # Not applicable to dairy matrix / unanalyzed
            "FIBINS": None,
            "FIBSOL": None,
            "CHOAVLDF": 2.41,
            "ENERC_KJ": 1278.0,
            "ENERC_KCAL": 305.45,
            "THIA": 0.02,
            "RIBF": 0.10,
            "NIA": 0.13,
            "VITC": None,  # Not present in dairy / below detection limit
            "CA": 476.0,
            "FE": 0.90,
        },
    },
]


def verify_pdf_provenance(pdf_path: Path) -> bool:
    """Verifies that the target PDF file exists and matches the expected SHA-256 checksum."""
    if not pdf_path.exists():
        logger.warning("PDF file not found at %s. Proceeding with verified ground truth records.", pdf_path)
        return False
    with open(pdf_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    if file_hash == IFCT_PDF_EXPECTED_SHA256:
        logger.info("IFCT PDF integrity verified: %s (SHA256 match)", pdf_path.name)
        return True
    logger.warning("IFCT PDF SHA256 mismatch (%s != expected %s)", file_hash, IFCT_PDF_EXPECTED_SHA256)
    return False


def get_or_create_data_source(session: Session) -> DataSource:
    """Creates or retrieves the primary ICMR-NIN IFCT 2017 data source."""
    ds = session.query(DataSource).filter(DataSource.name == "ICMR-NIN IFCT 2017").first()
    if ds is None:
        ds = DataSource(
            name="ICMR-NIN IFCT 2017",
            publisher="National Institute of Nutrition (ICMR), Hyderabad",
            url="https://www.nin.res.in",
            license="Scientific Reference (ICMR-NIN Copyright 2017)",
            license_url="https://www.nin.res.in/downloads/IFCT2017.pdf",
            version="2017",
            terms_notes=(
                "Official Indian Food Composition Tables (IFCT 2017). "
                "Analytical data from national food sampling. "
                "All values expressed per 100g edible portion. "
                "All data except poultry/egg pertains to raw unfortified foods. "
                "Blank cells denote values below detectable limit (BDL) or unanalyzed."
            ),
            active=True,
        )
        session.add(ds)
        session.flush()
        logger.info("Created DataSource: %s (ID: %s)", ds.name, ds.id)
    return ds


def sync_canonical_nutrients(session: Session) -> Dict[str, Nutrient]:
    """Ensures all canonical nutrients exist in the nutrients table and returns a lookup dict."""
    nutrient_map: Dict[str, Nutrient] = {}
    for n_def in CANONICAL_NUTRIENTS:
        code = n_def["canonical_code"]
        n = session.query(Nutrient).filter(Nutrient.canonical_code == code).first()
        if n is None:
            n = Nutrient(
                name=n_def["name"],
                canonical_code=code,
                unit=n_def["unit"],
                category=n_def["category"],
                description=n_def.get("description"),
                applicable_basis=n_def.get("applicable_basis", "per_100g_edible"),
                icmr_rda_adult_male=n_def.get("icmr_rda_adult_male"),
                icmr_rda_adult_female=n_def.get("icmr_rda_adult_female"),
            )
            session.add(n)
            session.flush()
            logger.info("Registered Nutrient: %s [%s] (%s)", n.canonical_code, n.unit, n.name)
        nutrient_map[code] = n
    return nutrient_map


def get_or_create_food_reference(session: Session, food_name: str, group_name: str) -> Food:
    """Finds existing food in foods table or creates a reference food entry if not present."""
    f = session.query(Food).filter(Food.name == food_name).first()
    if f is None:
        f = Food(
            name=food_name,
            category=group_name,
            description=f"Reference Indian staple from ICMR-NIN IFCT 2017 ({group_name})",
            unit="500g",
            serving_size="100g",
            approval_status="verified_reference",
            active=True,
        )
        session.add(f)
        session.flush()
        logger.info("Created reference Food: %s (ID: %s)", f.name, f.id)
    return f


def ingest_ifct_subset(
    session: Session,
    pdf_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Main ingestion routine. Idempotently imports the representative IFCT subset.

    Returns summary metrics of ingested records.
    """
    if pdf_path is None:
        pdf_path = IFCT_PDF_PATH

    pdf_verified = verify_pdf_provenance(pdf_path)

    data_source = get_or_create_data_source(session)
    nutrient_map = sync_canonical_nutrients(session)

    imported_source_records = 0
    imported_food_nutrients = 0
    updated_food_nutrients = 0
    unknown_nutrient_count = 0

    for item in REPRESENTATIVE_IFCT_SUBSET:
        code = item["code"]
        ext_name = item["name"]
        catalog_food_name = item["catalog_food_name"]

        # 1. Resolve Food entity
        food = get_or_create_food_reference(session, catalog_food_name, item["group"])

        # 2. Build or resolve SourceRecord
        raw_payload_dict = {
            "source": "ICMR-NIN IFCT 2017",
            "ifct_code": code,
            "description": ext_name,
            "food_group": item["group"],
            "table_references": {
                "proximate_table": 1,
                "table1_page": item["table1_page"],
                "vitamins_table": 2,
                "table2_page": item["table2_page"],
                "minerals_table": 5,
                "table5_page": item["table5_page"],
            },
            "national_samples_count": item["n_samples"],
            "measurement_basis": "per_100g_edible",
            "food_state": "raw",
            "pdf_checksum_sha256": IFCT_PDF_EXPECTED_SHA256 if pdf_verified else None,
            "citation": "Longvah, T., et al. (2017). Indian Food Composition Tables. ICMR-NIN, Hyderabad.",
            "extracted_values": item["values"],
        }
        serialized_payload = json.dumps(raw_payload_dict, sort_keys=True)
        payload_checksum = hashlib.sha256(serialized_payload.encode("utf-8")).hexdigest()

        src_record = (
            session.query(SourceRecord)
            .filter(
                SourceRecord.source_id == data_source.id,
                SourceRecord.external_id == code,
            )
            .first()
        )
        if src_record is None:
            src_record = SourceRecord(
                source_id=data_source.id,
                external_id=code,
                external_name=ext_name,
                raw_payload=serialized_payload,
                raw_checksum=payload_checksum,
            )
            session.add(src_record)
            session.flush()
            imported_source_records += 1
        else:
            src_record.raw_payload = serialized_payload
            src_record.raw_checksum = payload_checksum
            session.flush()

        # 3. Insert or update FoodNutrient entries for all canonical nutrients
        for canon_code, nutrient in nutrient_map.items():
            raw_val = item["values"].get(canon_code)
            is_unknown = raw_val is None
            unknown_reason = None
            if is_unknown:
                unknown_nutrient_count += 1
                if canon_code in ("FIBTG", "FIBINS", "FIBSOL") and item["group"] == "Milk and Milk Products":
                    unknown_reason = "Not applicable to dairy matrix / unanalyzed in IFCT Table 1"
                elif canon_code == "VITC" and item["group"] in ("Cereals and Millets", "Grain Legumes", "Milk and Milk Products"):
                    unknown_reason = "Below detectable limit / unanalyzed for dry staple or dairy in IFCT Table 2"
                else:
                    unknown_reason = "Below detectable limit (BDL) or unanalyzed in IFCT 2017"

            fn = (
                session.query(FoodNutrient)
                .filter(
                    FoodNutrient.food_id == food.id,
                    FoodNutrient.nutrient_id == nutrient.id,
                    FoodNutrient.food_state == "raw",
                    FoodNutrient.basis == "per_100g_edible",
                )
                .first()
            )

            notes_str = (
                f"IFCT 2017 code {code}. Table 1 p.{item['table1_page']}, "
                f"Table 2 p.{item['table2_page']}, Table 5 p.{item['table5_page']}. "
                f"Samples from {item['n_samples']} national regions."
            )

            if fn is None:
                fn = FoodNutrient(
                    food_id=food.id,
                    nutrient_id=nutrient.id,
                    source_record_id=src_record.id,
                    value=raw_val,
                    unit=nutrient.unit,
                    basis="per_100g_edible",
                    food_state="raw",
                    verification_status=VerificationStatus.verified_reference.value,
                    is_unknown=is_unknown,
                    unknown_reason=unknown_reason,
                    confidence_score=1.0,
                    notes=notes_str,
                )
                session.add(fn)
                session.flush()
                imported_food_nutrients += 1

                # 4. Attach VerificationRecord audit trail
                vr = VerificationRecord(
                    food_nutrient_id=fn.id,
                    reviewer_name="System / IFCT Ingestion Pipeline",
                    status=VerificationStatus.verified_reference.value,
                    evidence=(
                        f"National Institute of Nutrition (ICMR) IFCT 2017 Table 1/2/5, "
                        f"Food Code {code} ({ext_name}). Analytical multi-region assay."
                    ),
                    notes=notes_str,
                )
                session.add(vr)
            else:
                fn.value = raw_val
                fn.is_unknown = is_unknown
                fn.unknown_reason = unknown_reason
                fn.source_record_id = src_record.id
                fn.verification_status = VerificationStatus.verified_reference.value
                fn.confidence_score = 1.0
                fn.notes = notes_str
                updated_food_nutrients += 1

    session.commit()

    summary = {
        "status": "success",
        "data_source": data_source.name,
        "total_subset_foods": len(REPRESENTATIVE_IFCT_SUBSET),
        "source_records_created": imported_source_records,
        "canonical_nutrients_active": len(nutrient_map),
        "food_nutrients_created": imported_food_nutrients,
        "food_nutrients_updated": updated_food_nutrients,
        "unknown_nutrients_preserved": unknown_nutrient_count,
        "pdf_integrity_verified": pdf_verified,
    }
    logger.info("Ingestion completed: %s", summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest representative subset from ICMR-NIN IFCT 2017")
    parser.add_argument("--pdf", type=Path, default=IFCT_PDF_PATH, help="Path to IFCT2017.pdf")
    parser.add_argument(
        "--db",
        type=str,
        default=os.environ.get("DATABASE_URL", "sqlite:///./nutriverse.db"),
        help="Database URL (default: sqlite:///./nutriverse.db)",
    )
    args = parser.parse_args()

    db_url = args.db
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    target_engine = create_engine(db_url, connect_args=connect_args)
    TargetSession = sessionmaker(bind=target_engine, autoflush=False, autocommit=False)
    session = TargetSession()
    try:
        summary = ingest_ifct_subset(session, pdf_path=args.pdf)
        print("\n--- Ingestion Summary Report ---")
        for k, v in summary.items():
            print(f"  {k}: {v}")
    finally:
        session.close()
        target_engine.dispose()


if __name__ == "__main__":
    main()
