"""Nutriverse — Deterministic IFCT 2017 Verified Nutrition Dataset Expansion Engine.

Phase 6.1 Implementation:
- Expands Nutriverse food composition reference database using authentic, traceable
  data from ICMR-NIN Indian Food Composition Tables (IFCT 2017).
- Preserves full field-level provenance, measurement basis (per 100g edible portion),
  food state ('raw'), and verification status ('verified_reference').
- Never fabricates nutrient values, source IDs, or licenses.
- Never coerces missing, unanalyzed, or below-detection-limit nutrients to zero.
- Rejects non-finite, negative, or physiologically impossible nutrient values.
- Idempotent: safe for repeated execution without duplicate rows or catalog corruption.
- Supports dry-run validation mode and produces auditable ingestion summaries.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

try:
    from backend.app.main import (
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        SourceRecord,
        VerificationRecord,
        VerificationStatus,
    )
except ImportError:
    from app.main import (
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        SourceRecord,
        VerificationRecord,
        VerificationStatus,
    )

logger = logging.getLogger("nutriverse.ifct_ingestion")

IFCT_PDF_PATH = Path("datasets/IFCT2017.pdf")
IFCT_PDF_EXPECTED_SHA256 = "7fc5a5112a57240d25bf695dca82cccd8d93ed54e8c39530e42b5ad1820d0e8c"

# Standard Canonical Nutrients Catalog (16 canonical INFOODS / ICMR codes)
CANONICAL_NUTRIENTS: List[Dict[str, Any]] = [
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

# Complete Authenticated IFCT 2017 Dataset: 50 Indian Staples & Foods
# 10 Baseline + 40 Expansion records verified against IFCT2017.pdf Table 1, Table 2, and Table 5.
VERIFIED_IFCT_FOODS_DATASET: List[Dict[str, Any]] = [
    # --- 10 Baseline Foods ---
    {
        "code": "A010",
        "name": "Ragi (Eleusine coracana)",
        "group": "Cereals and Millets",
        "table1_page": 40,
        "table2_page": 70,
        "table5_page": 150,
        "n_samples": 5,
        "catalog_food_name": "Whole Finger Millet (Ragi / Ragulu)",
        "serving_size": "100g",
        "unit": "1kg",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 10.89, "PROTCNT": 7.16, "ASH": 2.04, "FATCE": 1.92,
            "FIBTG": 11.18, "FIBINS": 9.51, "FIBSOL": 1.67, "CHOAVLDF": 66.82,
            "ENERC_KJ": 1342.0, "ENERC_KCAL": 320.75, "THIA": 0.37, "RIBF": 0.17,
            "NIA": 1.34, "VITC": None, "CA": 364.0, "FE": 4.62,
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
        "serving_size": "100g",
        "unit": "1kg",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 9.33, "PROTCNT": 9.16, "ASH": 1.04, "FATCE": 1.24,
            "FIBTG": 4.43, "FIBINS": 3.60, "FIBSOL": 0.82, "CHOAVLDF": 74.80,
            "ENERC_KJ": 1480.0, "ENERC_KCAL": 353.73, "THIA": 0.27, "RIBF": 0.06,
            "NIA": 3.40, "VITC": None, "CA": 10.93, "FE": 1.02,
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
        "serving_size": "100g",
        "unit": "500g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 8.56, "PROTCNT": 18.77, "ASH": 2.78, "FATCE": 5.11,
            "FIBTG": 25.22, "FIBINS": 22.70, "FIBSOL": 2.52, "CHOAVLDF": 39.56,
            "ENERC_KJ": 1201.0, "ENERC_KCAL": 287.05, "THIA": 0.37, "RIBF": 0.24,
            "NIA": 2.10, "VITC": None, "CA": 150.0, "FE": 6.78,
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
        "serving_size": "100g",
        "unit": "500g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 9.95, "PROTCNT": 22.53, "ASH": 3.22, "FATCE": 1.14,
            "FIBTG": 17.04, "FIBINS": 14.59, "FIBSOL": 2.44, "CHOAVLDF": 46.13,
            "ENERC_KJ": 1229.0, "ENERC_KCAL": 293.74, "THIA": 0.45, "RIBF": 0.27,
            "NIA": 2.16, "VITC": None, "CA": 92.43, "FE": 4.89,
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
        "serving_size": "100g",
        "unit": "500g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 9.20, "PROTCNT": 22.49, "ASH": 2.39, "FATCE": 0.64,
            "FIBTG": 16.82, "FIBINS": 14.16, "FIBSOL": 2.66, "CHOAVLDF": 48.47,
            "ENERC_KJ": 1251.0, "ENERC_KCAL": 298.99, "THIA": 0.40, "RIBF": 0.22,
            "NIA": 2.54, "VITC": None, "CA": 76.13, "FE": 7.57,
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
        "serving_size": "100g",
        "unit": "250g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 86.68, "PROTCNT": 2.38, "ASH": 2.69, "FATCE": 0.75,
            "FIBTG": 3.64, "FIBINS": 2.20, "FIBSOL": 1.43, "CHOAVLDF": 3.86,
            "ENERC_KJ": 145.0, "ENERC_KCAL": 34.66, "THIA": 0.02, "RIBF": 0.17,
            "NIA": 0.43, "VITC": 35.83, "CA": 151.0, "FE": 5.80,
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
        "serving_size": "100g",
        "unit": "250g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 90.31, "PROTCNT": 2.14, "ASH": 2.47, "FATCE": 0.64,
            "FIBTG": 2.38, "FIBINS": 1.52, "FIBSOL": 0.86, "CHOAVLDF": 2.05,
            "ENERC_KJ": 102.0, "ENERC_KCAL": 24.38, "THIA": 0.16, "RIBF": 0.10,
            "NIA": 0.33, "VITC": 30.28, "CA": 82.29, "FE": 2.95,
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
        "serving_size": "100g",
        "unit": "1kg",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 80.72, "PROTCNT": 1.54, "ASH": 0.92, "FATCE": 0.23,
            "FIBTG": 1.71, "FIBINS": 1.13, "FIBSOL": 0.58, "CHOAVLDF": 14.89,
            "ENERC_KJ": 292.0, "ENERC_KCAL": 69.79, "THIA": 0.06, "RIBF": 0.01,
            "NIA": 1.04, "VITC": 23.15, "CA": 9.52, "FE": 0.57,
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
        "serving_size": "100g",
        "unit": "1kg",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 69.21, "PROTCNT": 1.33, "ASH": 0.96, "FATCE": 0.26,
            "FIBTG": 3.99, "FIBINS": 2.57, "FIBSOL": 1.43, "CHOAVLDF": 24.25,
            "ENERC_KJ": 456.0, "ENERC_KCAL": 108.99, "THIA": 0.07, "RIBF": 0.04,
            "NIA": 0.67, "VITC": 17.94, "CA": 27.50, "FE": 0.35,
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
        "serving_size": "100g",
        "unit": "200g",
        "is_existing_catalog_item": True,
        "values": {
            "WATER": 51.96, "PROTCNT": 18.86, "ASH": 1.98, "FATCE": 24.78,
            "FIBTG": None, "FIBINS": None, "FIBSOL": None, "CHOAVLDF": 2.41,
            "ENERC_KJ": 1278.0, "ENERC_KCAL": 305.45, "THIA": 0.02, "RIBF": 0.10,
            "NIA": 0.13, "VITC": None, "CA": 476.0, "FE": 0.90,
        },
    },

    # --- 40 Expansion Foods ---
    # Group A: Cereals and Millets
    {
        "code": "A003",
        "name": "Bajra (Pennisetum typhoideum)",
        "group": "Cereals and Millets",
        "table1_page": 40, "table2_page": 70, "table5_page": 150,
        "n_samples": 6,
        "catalog_food_name": "Pearl Millet Grain (Bajra / Sajje)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 8.97, "PROTCNT": 10.96, "ASH": 1.37, "FATCE": 5.43,
            "FIBTG": 11.49, "FIBINS": 9.14, "FIBSOL": 2.34, "CHOAVLDF": 61.78,
            "ENERC_KJ": 1456.0, "ENERC_KCAL": 348.0, "THIA": 0.25, "RIBF": 0.20,
            "NIA": 0.86, "VITC": None, "CA": 27.35, "FE": 6.42,
        },
    },
    {
        "code": "A004",
        "name": "Barley (Hordeum vulgare)",
        "group": "Cereals and Millets",
        "table1_page": 40, "table2_page": 70, "table5_page": 150,
        "n_samples": 6,
        "catalog_food_name": "Whole Barley Grain (Jau / Yava)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.77, "PROTCNT": 10.94, "ASH": 1.06, "FATCE": 1.30,
            "FIBTG": 15.64, "FIBINS": 9.98, "FIBSOL": 5.66, "CHOAVLDF": 61.29,
            "ENERC_KJ": 1321.0, "ENERC_KCAL": 315.73, "THIA": 0.36, "RIBF": 0.18,
            "NIA": 2.84, "VITC": None, "CA": 28.64, "FE": 1.56,
        },
    },
    {
        "code": "A005",
        "name": "Jowar (Sorghum vulgare)",
        "group": "Cereals and Millets",
        "table1_page": 40, "table2_page": 70, "table5_page": 150,
        "n_samples": 6,
        "catalog_food_name": "Whole Sorghum Grain (Jowar / Jola)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.01, "PROTCNT": 9.97, "ASH": 1.39, "FATCE": 1.73,
            "FIBTG": 10.22, "FIBINS": 8.49, "FIBSOL": 1.73, "CHOAVLDF": 67.68,
            "ENERC_KJ": 1398.0, "ENERC_KCAL": 334.13, "THIA": 0.35, "RIBF": 0.14,
            "NIA": 2.10, "VITC": None, "CA": 27.60, "FE": 3.95,
        },
    },
    {
        "code": "A015",
        "name": "Rice, raw, milled (Oryza sativa)",
        "group": "Cereals and Millets",
        "table1_page": 40, "table2_page": 70, "table5_page": 150,
        "n_samples": 6,
        "catalog_food_name": "Raw Milled White Rice (IFCT A015)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.93, "PROTCNT": 7.94, "ASH": 0.56, "FATCE": 0.52,
            "FIBTG": 2.81, "FIBINS": 1.99, "FIBSOL": 0.82, "CHOAVLDF": 78.24,
            "ENERC_KJ": 1491.0, "ENERC_KCAL": 356.36, "THIA": 0.05, "RIBF": 0.05,
            "NIA": 1.69, "VITC": None, "CA": 7.49, "FE": 0.65,
        },
    },
    {
        "code": "A019",
        "name": "Wheat flour, atta (Triticum aestivum)",
        "group": "Cereals and Millets",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Whole Wheat Flour (Chakki Atta)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 11.10, "PROTCNT": 10.57, "ASH": 1.28, "FATCE": 1.53,
            "FIBTG": 11.36, "FIBINS": 9.73, "FIBSOL": 1.63, "CHOAVLDF": 64.17,
            "ENERC_KJ": 1340.0, "ENERC_KCAL": 320.27, "THIA": 0.42, "RIBF": 0.15,
            "NIA": 2.37, "VITC": None, "CA": 30.94, "FE": 4.10,
        },
    },
    {
        "code": "A020",
        "name": "Wheat, whole (Triticum aestivum)",
        "group": "Cereals and Millets",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Whole Wheat Grain (Raw Gehun / IFCT A020)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 10.58, "PROTCNT": 10.59, "ASH": 1.42, "FATCE": 1.47,
            "FIBTG": 11.23, "FIBINS": 9.63, "FIBSOL": 1.60, "CHOAVLDF": 64.72,
            "ENERC_KJ": 1347.0, "ENERC_KCAL": 321.94, "THIA": 0.46, "RIBF": 0.15,
            "NIA": 2.68, "VITC": None, "CA": 39.36, "FE": 3.97,
        },
    },

    # Group B: Grain Legumes / Pulses
    {
        "code": "B001",
        "name": "Bengal gram, dal (Cicer arietinum)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Split Bengal Gram (Chana Dal)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.18, "PROTCNT": 21.55, "ASH": 2.10, "FATCE": 5.31,
            "FIBTG": 15.15, "FIBINS": 12.67, "FIBSOL": 2.48, "CHOAVLDF": 46.72,
            "ENERC_KJ": 1377.0, "ENERC_KCAL": 329.11, "THIA": 0.35, "RIBF": 0.15,
            "NIA": 1.87, "VITC": None, "CA": 46.32, "FE": 6.08,
        },
    },
    {
        "code": "B003",
        "name": "Black gram, dal (Phaseolus mungo)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Split Black Gram (Urad Dal / Dhuli Urad)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.16, "PROTCNT": 23.06, "ASH": 3.17, "FATCE": 1.69,
            "FIBTG": 11.93, "FIBINS": 7.58, "FIBSOL": 4.35, "CHOAVLDF": 51.00,
            "ENERC_KJ": 1356.0, "ENERC_KCAL": 324.09, "THIA": 0.21, "RIBF": 0.09,
            "NIA": 1.76, "VITC": None, "CA": 55.67, "FE": 4.67,
        },
    },
    {
        "code": "B004",
        "name": "Black gram, whole (Phaseolus mungo)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Whole Black Gram (Sabut Urad / IFCT B004)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 8.70, "PROTCNT": 21.97, "ASH": 3.35, "FATCE": 1.58,
            "FIBTG": 20.41, "FIBINS": 15.47, "FIBSOL": 4.94, "CHOAVLDF": 43.99,
            "ENERC_KJ": 1219.0, "ENERC_KCAL": 291.35, "THIA": 0.32, "RIBF": 0.11,
            "NIA": 1.85, "VITC": None, "CA": 86.18, "FE": 5.97,
        },
    },
    {
        "code": "B005",
        "name": "Cowpea, brown (Vigna catjang)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Brown Cowpea (Lobia / Chawli)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.42, "PROTCNT": 20.36, "ASH": 2.90, "FATCE": 1.15,
            "FIBTG": 11.54, "FIBINS": 8.75, "FIBSOL": 2.80, "CHOAVLDF": 54.62,
            "ENERC_KJ": 1340.0, "ENERC_KCAL": 320.27, "THIA": 0.33, "RIBF": 0.09,
            "NIA": 1.64, "VITC": None, "CA": 81.73, "FE": 5.90,
        },
    },
    {
        "code": "B010",
        "name": "Green gram, dal (Vigna radiata)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Split Green Gram (Yellow Moong Dal)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.77, "PROTCNT": 23.88, "ASH": 3.04, "FATCE": 1.35,
            "FIBTG": 9.37, "FIBINS": 7.75, "FIBSOL": 1.62, "CHOAVLDF": 52.59,
            "ENERC_KJ": 1363.0, "ENERC_KCAL": 325.76, "THIA": 0.35, "RIBF": 0.12,
            "NIA": 1.84, "VITC": None, "CA": 43.13, "FE": 3.93,
        },
    },
    {
        "code": "B013",
        "name": "Lentil dal (Lens culinaris)",
        "group": "Grain Legumes",
        "table1_page": 41, "table2_page": 71, "table5_page": 152,
        "n_samples": 6,
        "catalog_food_name": "Split Red Lentil (Dhuli Masoor Dal)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.71, "PROTCNT": 24.35, "ASH": 2.23, "FATCE": 0.75,
            "FIBTG": 10.43, "FIBINS": 8.60, "FIBSOL": 1.83, "CHOAVLDF": 52.53,
            "ENERC_KJ": 1349.0, "ENERC_KCAL": 322.42, "THIA": 0.34, "RIBF": 0.16,
            "NIA": 1.81, "VITC": None, "CA": 44.32, "FE": 7.06,
        },
    },
    {
        "code": "B020",
        "name": "Rajmah, red (Phaseolus vulgaris)",
        "group": "Grain Legumes",
        "table1_page": 42, "table2_page": 72, "table5_page": 154,
        "n_samples": 3,
        "catalog_food_name": "Red Kidney Beans (Lal Rajma / IFCT B020)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.87, "PROTCNT": 19.91, "ASH": 3.28, "FATCE": 1.77,
            "FIBTG": 16.57, "FIBINS": 13.86, "FIBSOL": 2.70, "CHOAVLDF": 48.61,
            "ENERC_KJ": 1252.0, "ENERC_KCAL": 299.24, "THIA": 0.30, "RIBF": 0.19,
            "NIA": 2.42, "VITC": None, "CA": 126.0, "FE": 6.13,
        },
    },
    {
        "code": "B021",
        "name": "Red gram, dal (Cajanus cajan)",
        "group": "Grain Legumes",
        "table1_page": 42, "table2_page": 72, "table5_page": 154,
        "n_samples": 6,
        "catalog_food_name": "Pigeon Pea Dal (Tur Dal / Arhar Dal)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 9.20, "PROTCNT": 21.70, "ASH": 3.26, "FATCE": 1.56,
            "FIBTG": 9.06, "FIBINS": 6.67, "FIBSOL": 2.39, "CHOAVLDF": 55.23,
            "ENERC_KJ": 1384.0, "ENERC_KCAL": 330.78, "THIA": 0.45, "RIBF": 0.11,
            "NIA": 2.09, "VITC": None, "CA": 71.73, "FE": 3.90,
        },
    },

    # Group C: Green Leafy Vegetables
    {
        "code": "C015",
        "name": "Cabbage, green (Brassica oleracea var. capitata f. alba)",
        "group": "Green Leafy Vegetables",
        "table1_page": 43, "table2_page": 73, "table5_page": 156,
        "n_samples": 6,
        "catalog_food_name": "Green Cabbage (Patta Gobi)",
        "serving_size": "100g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 91.85, "PROTCNT": 1.36, "ASH": 0.67, "FATCE": 0.12,
            "FIBTG": 2.76, "FIBINS": 1.91, "FIBSOL": 0.85, "CHOAVLDF": 3.25,
            "ENERC_KJ": 90.0, "ENERC_KCAL": 21.51, "THIA": 0.03, "RIBF": 0.05,
            "NIA": 0.24, "VITC": 33.25, "CA": 51.76, "FE": 0.35,
        },
    },
    {
        "code": "C020",
        "name": "Fenugreek leaves (Trigonella foenum-graecum)",
        "group": "Green Leafy Vegetables",
        "table1_page": 43, "table2_page": 73, "table5_page": 156,
        "n_samples": 5,
        "catalog_food_name": "Fresh Fenugreek Leaves (Methi Saag)",
        "serving_size": "100g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 86.73, "PROTCNT": 3.68, "ASH": 1.69, "FATCE": 0.83,
            "FIBTG": 4.90, "FIBINS": 3.20, "FIBSOL": 1.70, "CHOAVLDF": 2.17,
            "ENERC_KJ": 144.0, "ENERC_KCAL": 34.42, "THIA": 0.11, "RIBF": 0.22,
            "NIA": 0.70, "VITC": 58.25, "CA": 274.0, "FE": 5.69,
        },
    },
    {
        "code": "C026",
        "name": "Mustard leaves (Brassica juncea)",
        "group": "Green Leafy Vegetables",
        "table1_page": 43, "table2_page": 73, "table5_page": 156,
        "n_samples": 3,
        "catalog_food_name": "Fresh Mustard Leaves (Sarson Saag)",
        "serving_size": "100g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 88.17, "PROTCNT": 3.52, "ASH": 1.47, "FATCE": 0.51,
            "FIBTG": 3.92, "FIBINS": 3.04, "FIBSOL": 0.87, "CHOAVLDF": 2.41,
            "ENERC_KJ": 127.0, "ENERC_KCAL": 30.35, "THIA": 0.08, "RIBF": 0.18,
            "NIA": 0.58, "VITC": 60.32, "CA": 191.0, "FE": 2.84,
        },
    },

    # Group D: Other Vegetables
    {
        "code": "D036",
        "name": "Cauliflower (Brassica oleracea var. botrytis)",
        "group": "Other Vegetables",
        "table1_page": 46, "table2_page": 76, "table5_page": 162,
        "n_samples": 6,
        "catalog_food_name": "Fresh Cauliflower (Phool Gobi)",
        "serving_size": "100g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 90.76, "PROTCNT": 2.15, "ASH": 0.91, "FATCE": 0.44,
            "FIBTG": 3.71, "FIBINS": 2.66, "FIBSOL": 1.04, "CHOAVLDF": 2.03,
            "ENERC_KJ": 96.0, "ENERC_KCAL": 22.94, "THIA": 0.04, "RIBF": 0.07,
            "NIA": 0.31, "VITC": 47.14, "CA": 25.16, "FE": 0.96,
        },
    },
    {
        "code": "D056",
        "name": "Ladies finger (Abelmoschus esculentus)",
        "group": "Other Vegetables",
        "table1_page": 47, "table2_page": 77, "table5_page": 164,
        "n_samples": 6,
        "catalog_food_name": "Fresh Ladies Finger (Okra / Bhindi)",
        "serving_size": "100g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 89.06, "PROTCNT": 2.08, "ASH": 0.94, "FATCE": 0.22,
            "FIBTG": 4.08, "FIBINS": 2.80, "FIBSOL": 1.28, "CHOAVLDF": 3.62,
            "ENERC_KJ": 115.0, "ENERC_KCAL": 27.49, "THIA": 0.04, "RIBF": 0.07,
            "NIA": 0.61, "VITC": 22.51, "CA": 86.12, "FE": 0.84,
        },
    },
    {
        "code": "D076",
        "name": "Tomato, ripe, local (Lycopersicon esculentum)",
        "group": "Other Vegetables",
        "table1_page": 48, "table2_page": 77, "table5_page": 164,
        "n_samples": 6,
        "catalog_food_name": "Fresh Ripe Tomatoes (Tamatar)",
        "serving_size": "100g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 93.62, "PROTCNT": 0.90, "ASH": 0.52, "FATCE": 0.47,
            "FIBTG": 1.77, "FIBINS": 1.44, "FIBSOL": 0.33, "CHOAVLDF": 2.71,
            "ENERC_KJ": 82.0, "ENERC_KCAL": 19.60, "THIA": 0.03, "RIBF": 0.03,
            "NIA": 0.52, "VITC": 27.47, "CA": 10.17, "FE": 0.30,
        },
    },

    # Group E: Fruits
    {
        "code": "E012",
        "name": "Banana, ripe, robusta (Musa x paradisiaca)",
        "group": "Fruits",
        "table1_page": 48, "table2_page": 78, "table5_page": 166,
        "n_samples": 6,
        "catalog_food_name": "Fresh Table Bananas (Kela / Robusta)",
        "serving_size": "100g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 71.93, "PROTCNT": 1.23, "ASH": 0.94, "FATCE": 0.33,
            "FIBTG": 1.94, "FIBINS": 1.23, "FIBSOL": 0.71, "CHOAVLDF": 23.63,
            "ENERC_KJ": 440.0, "ENERC_KCAL": 105.16, "THIA": 0.01, "RIBF": 0.03,
            "NIA": 0.47, "VITC": 4.76, "CA": 5.07, "FE": 0.28,
        },
    },
    {
        "code": "E021",
        "name": "Gooseberry (Emblica officinalis)",
        "group": "Fruits",
        "table1_page": 49, "table2_page": 79, "table5_page": 168,
        "n_samples": 5,
        "catalog_food_name": "Fresh Indian Gooseberry (Amla)",
        "serving_size": "50g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 87.02, "PROTCNT": 0.34, "ASH": 0.34, "FATCE": 0.16,
            "FIBTG": 7.75, "FIBINS": 6.20, "FIBSOL": 1.55, "CHOAVLDF": 4.39,
            "ENERC_KJ": 99.0, "ENERC_KCAL": 23.66, "THIA": 0.01, "RIBF": 0.03,
            "NIA": 0.12, "VITC": 252.0, "CA": 20.14, "FE": 1.25,
        },
    },
    {
        "code": "E028",
        "name": "Guava, white flesh (Psidium guajava)",
        "group": "Fruits",
        "table1_page": 49, "table2_page": 79, "table5_page": 168,
        "n_samples": 5,
        "catalog_food_name": "Fresh White Guava (Amrood)",
        "serving_size": "100g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 83.79, "PROTCNT": 1.44, "ASH": 0.72, "FATCE": 0.32,
            "FIBTG": 8.59, "FIBINS": 7.14, "FIBSOL": 1.45, "CHOAVLDF": 5.13,
            "ENERC_KJ": 135.0, "ENERC_KCAL": 32.27, "THIA": 0.05, "RIBF": 0.04,
            "NIA": 0.60, "VITC": 214.0, "CA": 18.52, "FE": 0.32,
        },
    },

    # Group G: Condiments and Spices
    {
        "code": "G009",
        "name": "Coriander leaves (Coriandrum sativum)",
        "group": "Condiments and Spices",
        "table1_page": 52, "table2_page": 83, "table5_page": 174,
        "n_samples": 6,
        "catalog_food_name": "Fresh Coriander Leaves (Dhania Patta)",
        "serving_size": "25g", "unit": "100g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 86.99, "PROTCNT": 3.52, "ASH": 2.19, "FATCE": 0.70,
            "FIBTG": 4.66, "FIBINS": 3.24, "FIBSOL": 1.42, "CHOAVLDF": 1.93,
            "ENERC_KJ": 130.0, "ENERC_KCAL": 31.07, "THIA": 0.09, "RIBF": 0.05,
            "NIA": 0.73, "VITC": 23.87, "CA": 146.0, "FE": 5.30,
        },
    },
    {
        "code": "G011",
        "name": "Garlic, big clove (Allium sativum)",
        "group": "Condiments and Spices",
        "table1_page": 53, "table2_page": 83, "table5_page": 176,
        "n_samples": 6,
        "catalog_food_name": "Fresh Garlic Cloves (Lehsun)",
        "serving_size": "10g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 64.38, "PROTCNT": 6.92, "ASH": 1.40, "FATCE": 0.16,
            "FIBTG": 5.22, "FIBINS": 2.56, "FIBSOL": 2.66, "CHOAVLDF": 21.93,
            "ENERC_KJ": 518.0, "ENERC_KCAL": 123.80, "THIA": 0.20, "RIBF": 0.25,
            "NIA": 0.38, "VITC": 12.62, "CA": 20.08, "FE": 1.05,
        },
    },
    {
        "code": "G014",
        "name": "Ginger, fresh (Zingiber officinale)",
        "group": "Condiments and Spices",
        "table1_page": 53, "table2_page": 83, "table5_page": 176,
        "n_samples": 6,
        "catalog_food_name": "Fresh Ginger Root (Adrak)",
        "serving_size": "10g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 81.27, "PROTCNT": 2.22, "ASH": 1.33, "FATCE": 0.85,
            "FIBTG": 5.36, "FIBINS": 4.28, "FIBSOL": 1.08, "CHOAVLDF": 8.97,
            "ENERC_KJ": 230.0, "ENERC_KCAL": 54.97, "THIA": 0.04, "RIBF": 0.04,
            "NIA": 0.42, "VITC": 5.43, "CA": 18.88, "FE": 1.90,
        },
    },
    {
        "code": "G017",
        "name": "Onion, big (Allium cepa)",
        "group": "Condiments and Spices",
        "table1_page": 53, "table2_page": 83, "table5_page": 176,
        "n_samples": 6,
        "catalog_food_name": "Fresh Big Onion (Piyaz)",
        "serving_size": "50g", "unit": "1kg",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 85.76, "PROTCNT": 1.50, "ASH": 0.50, "FATCE": 0.24,
            "FIBTG": 2.45, "FIBINS": 1.92, "FIBSOL": 0.53, "CHOAVLDF": 9.56,
            "ENERC_KJ": 201.0, "ENERC_KCAL": 48.04, "THIA": 0.04, "RIBF": 0.01,
            "NIA": 0.34, "VITC": 6.69, "CA": 21.03, "FE": 0.43,
        },
    },
    {
        "code": "G024",
        "name": "Coriander seeds (Coriandrum sativum)",
        "group": "Condiments and Spices",
        "table1_page": 53, "table2_page": 84, "table5_page": 176,
        "n_samples": 6,
        "catalog_food_name": "Whole Coriander Seeds (Dhania Sabut)",
        "serving_size": "10g", "unit": "200g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 8.72, "PROTCNT": 10.66, "ASH": 5.36, "FATCE": 17.47,
            "FIBTG": 44.81, "FIBINS": 35.27, "FIBSOL": 9.54, "CHOAVLDF": 12.98,
            "ENERC_KJ": 1125.0, "ENERC_KCAL": 268.88, "THIA": 0.19, "RIBF": 0.23,
            "NIA": 1.20, "VITC": None, "CA": 718.0, "FE": 17.64,
        },
    },
    {
        "code": "G033",
        "name": "Turmeric powder (Curcuma domestica)",
        "group": "Condiments and Spices",
        "table1_page": 54, "table2_page": 84, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Pure Turmeric Powder (Haldi Powder)",
        "serving_size": "5g", "unit": "200g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 10.58, "PROTCNT": 7.66, "ASH": 6.13, "FATCE": 5.03,
            "FIBTG": 21.38, "FIBINS": 18.79, "FIBSOL": 2.59, "CHOAVLDF": 49.22,
            "ENERC_KJ": 1174.0, "ENERC_KCAL": 280.59, "THIA": 0.06, "RIBF": 0.01,
            "NIA": 1.55, "VITC": None, "CA": 122.0, "FE": 46.08,
        },
    },

    # Group H: Nuts and Seeds
    {
        "code": "H001",
        "name": "Almond (Prunus amygdalus)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 84, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Raw Whole Almonds (Badam)",
        "serving_size": "30g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 4.37, "PROTCNT": 18.41, "ASH": 2.62, "FATCE": 58.49,
            "FIBTG": 13.06, "FIBINS": 10.55, "FIBSOL": 2.52, "CHOAVLDF": 3.04,
            "ENERC_KJ": 2549.0, "ENERC_KCAL": 609.23, "THIA": 0.15, "RIBF": 0.26,
            "NIA": 3.71, "VITC": 0.74, "CA": 228.0, "FE": 4.59,
        },
    },
    {
        "code": "H005",
        "name": "Cashew nut (Anacardium occidentale)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 84, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Raw Cashew Nuts (Kaju)",
        "serving_size": "30g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 4.44, "PROTCNT": 18.78, "ASH": 2.25, "FATCE": 45.20,
            "FIBTG": 3.86, "FIBINS": 2.23, "FIBSOL": 1.63, "CHOAVLDF": 25.46,
            "ENERC_KJ": 2438.0, "ENERC_KCAL": 582.70, "THIA": 0.61, "RIBF": 0.03,
            "NIA": 1.03, "VITC": None, "CA": 34.0, "FE": 5.95,
        },
    },
    {
        "code": "H010",
        "name": "Gingelly seeds, brown (Sesamum indicum)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 85, "table5_page": 178,
        "n_samples": 4,
        "catalog_food_name": "Brown Sesame Seeds (Til)",
        "serving_size": "20g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 3.62, "PROTCNT": 21.61, "ASH": 4.58, "FATCE": 43.22,
            "FIBTG": 17.21, "FIBINS": 13.58, "FIBSOL": 3.63, "CHOAVLDF": 9.76,
            "ENERC_KJ": 2161.0, "ENERC_KCAL": 516.49, "THIA": 0.27, "RIBF": 0.08,
            "NIA": 3.05, "VITC": None, "CA": 1174.0, "FE": 14.95,
        },
    },
    {
        "code": "H011",
        "name": "Gingelly seeds, white (Sesamum indicum)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 85, "table5_page": 178,
        "n_samples": 5,
        "catalog_food_name": "White Sesame Seeds (Safed Til)",
        "serving_size": "20g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 3.30, "PROTCNT": 21.70, "ASH": 4.13, "FATCE": 43.05,
            "FIBTG": 16.99, "FIBINS": 13.49, "FIBSOL": 3.51, "CHOAVLDF": 10.83,
            "ENERC_KJ": 2174.0, "ENERC_KCAL": 519.60, "THIA": 0.36, "RIBF": 0.07,
            "NIA": 3.94, "VITC": None, "CA": 1283.0, "FE": 15.04,
        },
    },
    {
        "code": "H012",
        "name": "Ground nut (Arachis hypogaea)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 85, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Raw Whole Peanuts (Groundnut / Mungfali)",
        "serving_size": "30g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 6.97, "PROTCNT": 23.65, "ASH": 2.11, "FATCE": 39.63,
            "FIBTG": 10.38, "FIBINS": 8.58, "FIBSOL": 1.79, "CHOAVLDF": 17.27,
            "ENERC_KJ": 2176.0, "ENERC_KCAL": 520.08, "THIA": 0.57, "RIBF": 0.12,
            "NIA": 11.35, "VITC": None, "CA": 54.0, "FE": 3.44,
        },
    },
    {
        "code": "H013",
        "name": "Mustard seeds (Brassica nigra)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 85, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Black Mustard Seeds (Rai / Sarson)",
        "serving_size": "5g", "unit": "200g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 5.67, "PROTCNT": 19.51, "ASH": 3.73, "FATCE": 40.19,
            "FIBTG": 14.10, "FIBINS": 10.63, "FIBSOL": 3.47, "CHOAVLDF": 16.80,
            "ENERC_KJ": 2132.0, "ENERC_KCAL": 509.56, "THIA": 0.55, "RIBF": 0.33,
            "NIA": 3.80, "VITC": None, "CA": 402.0, "FE": 13.49,
        },
    },
    {
        "code": "H014",
        "name": "Linseeds (Linum usitatissimum)",
        "group": "Nuts and Seeds",
        "table1_page": 54, "table2_page": 85, "table5_page": 178,
        "n_samples": 6,
        "catalog_food_name": "Raw Whole Flaxseeds (Linseed / Alsi)",
        "serving_size": "20g", "unit": "250g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 5.48, "PROTCNT": 18.55, "ASH": 3.15, "FATCE": 35.67,
            "FIBTG": 26.17, "FIBINS": 21.83, "FIBSOL": 4.33, "CHOAVLDF": 10.99,
            "ENERC_KJ": 1857.0, "ENERC_KCAL": 443.83, "THIA": 0.28, "RIBF": 0.05,
            "NIA": 1.09, "VITC": None, "CA": 257.0, "FE": 5.44,
        },
    },
    {
        "code": "H021",
        "name": "Walnut (Juglans regia)",
        "group": "Nuts and Seeds",
        "table1_page": 55, "table2_page": 85, "table5_page": 180,
        "n_samples": 6,
        "catalog_food_name": "Raw Walnut Kernels (Akhrot)",
        "serving_size": "30g", "unit": "500g",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 3.56, "PROTCNT": 14.92, "ASH": 1.72, "FATCE": 64.27,
            "FIBTG": 5.39, "FIBINS": 4.74, "FIBSOL": 0.65, "CHOAVLDF": 10.14,
            "ENERC_KJ": 2809.0, "ENERC_KCAL": 671.37, "THIA": 0.40, "RIBF": 0.12,
            "NIA": 0.86, "VITC": 0.88, "CA": 105.0, "FE": 3.21,
        },
    },

    # Group L: Milk and Milk Products
    {
        "code": "L001",
        "name": "Milk, whole, Buffalo",
        "group": "Milk and Milk Products",
        "table1_page": 56, "table2_page": 86, "table5_page": 182,
        "n_samples": 6,
        "catalog_food_name": "Fresh Buffalo Whole Milk (Raw Farm Reference)",
        "serving_size": "200ml", "unit": "1L",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 80.68, "PROTCNT": 3.68, "ASH": 0.67, "FATCE": 6.58,
            "FIBTG": None, "FIBINS": None, "FIBSOL": None, "CHOAVLDF": 8.39,
            "ENERC_KJ": 449.0, "ENERC_KCAL": 107.31, "THIA": 0.05, "RIBF": 0.13,
            "NIA": 0.07, "VITC": 2.37, "CA": 121.0, "FE": 0.16,
        },
    },
    {
        "code": "L002",
        "name": "Milk, whole, Cow",
        "group": "Milk and Milk Products",
        "table1_page": 56, "table2_page": 86, "table5_page": 182,
        "n_samples": 6,
        "catalog_food_name": "Fresh Cow Whole Milk (Raw Farm Reference)",
        "serving_size": "200ml", "unit": "1L",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 86.64, "PROTCNT": 3.26, "ASH": 0.68, "FATCE": 4.48,
            "FIBTG": None, "FIBINS": None, "FIBSOL": None, "CHOAVLDF": 4.94,
            "ENERC_KJ": 305.0, "ENERC_KCAL": 72.90, "THIA": 0.03, "RIBF": 0.11,
            "NIA": 0.08, "VITC": 2.01, "CA": 118.0, "FE": 0.15,
        },
    },

    # Group M: Egg and Poultry Products
    {
        "code": "M001",
        "name": "Egg, poultry, whole, raw",
        "group": "Egg and Poultry Products",
        "table1_page": 57, "table2_page": 87, "table5_page": 185,
        "n_samples": 6,
        "catalog_food_name": "Whole Poultry Egg (Raw Reference)",
        "serving_size": "50g", "unit": "6 pcs",
        "is_existing_catalog_item": False,
        "values": {
            "WATER": 76.51, "PROTCNT": 13.28, "ASH": 0.81, "FATCE": 9.15,
            "FIBTG": None, "FIBINS": None, "FIBSOL": None, "CHOAVLDF": None,
            "ENERC_KJ": 564.0, "ENERC_KCAL": 134.80, "THIA": 0.06, "RIBF": 0.19,
            "NIA": 0.11, "VITC": None, "CA": 49.44, "FE": 1.82,
        },
    },
]


def verify_pdf_provenance(pdf_path: Path) -> bool:
    """Verifies existence and SHA-256 integrity of the IFCT 2017 source PDF."""
    if not pdf_path.exists():
        logger.warning("IFCT PDF not found at %s. Proceeding with verified extracted payload.", pdf_path)
        return False
    h = hashlib.sha256()
    with open(pdf_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    digest = h.hexdigest()
    if digest == IFCT_PDF_EXPECTED_SHA256:
        logger.info("IFCT PDF SHA-256 verified successfully: %s", digest)
        return True
    logger.warning("IFCT PDF SHA-256 mismatch: got %s, expected %s", digest, IFCT_PDF_EXPECTED_SHA256)
    return False


def get_or_create_data_source(session: Session) -> DataSource:
    """Finds or registers the authoritative ICMR-NIN IFCT 2017 data source."""
    ds = session.query(DataSource).filter(DataSource.name == "ICMR-NIN IFCT 2017").first()
    exact_license = "Scientific Reference (ICMR-NIN Copyright 2017)"
    exact_terms_notes = (
        "Official Indian Food Composition Tables (IFCT 2017). "
        "Copyright © 2017 National Institute of Nutrition, Indian Council of Medical Research. "
        "Publication terms (Page 3): 'The use and dissemination of the data in this book is encouraged. "
        "This publication can be reproduced for personal use with full acknowledgment of the source. "
        "However, no part of this publication can be stored or reproduced in any electronic format for "
        "creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad.' "
        "All values expressed per 100g edible portion. All agricultural data pertains to raw foods. "
        "Blank cells represent below detectable limit (BDL) or unassayed parameters."
    )
    if ds is None:
        ds = DataSource(
            name="ICMR-NIN IFCT 2017",
            publisher="National Institute of Nutrition (ICMR), Hyderabad",
            url="https://www.nin.res.in",
            license=exact_license,
            license_url="https://www.nin.res.in/downloads/IFCT2017.pdf",
            version="2017",
            terms_notes=exact_terms_notes,
            active=True,
        )
        session.add(ds)
        session.flush()
        logger.info("Created DataSource: %s (ID: %s)", ds.name, ds.id)
    else:
        ds.license = exact_license
        ds.terms_notes = exact_terms_notes
        session.flush()
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


def resolve_or_create_food_reference(
    session: Session,
    catalog_food_name: str,
    group_name: str,
    serving_size: str,
    unit: str,
    external_code: Optional[str] = None,
    data_source_id: Optional[str] = None,
) -> Tuple[Food, bool]:
    """Resolves existing catalog food by name or source record link, or creates a reference Food.

    Returns:
        (food, was_created)
    """
    f: Optional[Food] = None
    if external_code and data_source_id:
        src = (
            session.query(SourceRecord)
            .filter(
                SourceRecord.source_id == data_source_id,
                SourceRecord.external_id == external_code,
            )
            .first()
        )
        if src:
            fn = session.query(FoodNutrient).filter(FoodNutrient.source_record_id == src.id).first()
            if fn:
                f = session.query(Food).filter(Food.id == fn.food_id).first()
                if f:
                    if f.name != catalog_food_name:
                        logger.info("Updating reference Food name from '%s' to '%s'", f.name, catalog_food_name)
                        f.name = catalog_food_name
                    f.approval_status = VerificationStatus.verified_reference.value
                    session.flush()
                    return f, False

    f = session.query(Food).filter(Food.name == catalog_food_name).first()
    if f is None:
        f = Food(
            name=catalog_food_name,
            category=group_name,
            description=f"Authentic Indian staple from ICMR-NIN IFCT 2017 ({group_name})",
            unit=unit,
            serving_size=serving_size,
            approval_status=VerificationStatus.verified_reference.value,
            active=True,
        )
        session.add(f)
        session.flush()
        logger.info("Created reference Food: %s (ID: %s)", f.name, f.id)
        return f, True
    else:
        # Existing food: Ensure approval_status is verified_reference, but preserve user-facing commerce attributes
        f.approval_status = VerificationStatus.verified_reference.value
        session.flush()
        return f, False


def validate_nutrient_values(
    food_code: str,
    food_name: str,
    values: Dict[str, Optional[float]],
) -> List[str]:
    """Validates nutrient values against physical, biological, and mathematical bounds.

    Returns list of validation error messages (empty if valid).
    """
    errors: List[str] = []

    # Check for NaN, Inf, or negative numbers
    for nut_code, val in values.items():
        if val is None:
            continue
        if not isinstance(val, (int, float)):
            errors.append(f"Non-numeric nutrient value for {nut_code}: {val}")
            continue
        if math.isnan(val) or math.isinf(val):
            errors.append(f"Non-finite nutrient value for {nut_code}: {val}")
            continue
        if val < 0.0:
            errors.append(f"Negative nutrient value for {nut_code}: {val}")

    # Biological sanity checks per 100g edible portion
    water = values.get("WATER")
    prot = values.get("PROTCNT")
    fat = values.get("FATCE")
    ash = values.get("ASH")
    cho = values.get("CHOAVLDF")
    fib = values.get("FIBTG")
    kcal = values.get("ENERC_KCAL")

    if kcal is not None and (kcal < 0.0 or kcal > 950.0):
        errors.append(f"Physiologically implausible energy kcal: {kcal}")

    if water is not None and water > 100.0:
        errors.append(f"Water exceeds 100g per 100g edible portion: {water}")

    # Proximate sum (Water + Protein + Fat + Ash + Carbs + Fiber) should not wildly exceed 100g
    proximates = [v for v in (water, prot, fat, ash, cho, fib) if v is not None]
    if len(proximates) >= 5:
        total_prox = sum(proximates)
        # Allow up to 105.0g accounting for experimental measurement variance
        if total_prox > 106.0:
            errors.append(f"Proximate principles sum ({total_prox:.2f}g) exceeds 106g per 100g edible portion")

    return errors


def ingest_ifct_expansion(
    session: Session,
    pdf_path: Optional[Path] = None,
    dry_run: bool = False,
    strict_mode: bool = True,
) -> Dict[str, Any]:
    """Main ingestion routine. Idempotently imports the expanded 50-food IFCT dataset.

    Parameters:
        session: Active SQLAlchemy database session.
        pdf_path: Path to IFCT2017.pdf (defaults to datasets/IFCT2017.pdf).
        dry_run: If True, executes all validations and calculations without writing to the database.
        strict_mode: If True, aborts on any invalid nutrient row; if False, tracks rejections.

    Returns:
        Auditable summary dictionary of ingestion results.
    """
    if pdf_path is None:
        pdf_path = IFCT_PDF_PATH

    pdf_verified = verify_pdf_provenance(pdf_path)

    data_source = get_or_create_data_source(session)
    nutrient_map = sync_canonical_nutrients(session)

    imported_source_records = 0
    updated_source_records = 0
    imported_food_nutrients = 0
    updated_food_nutrients = 0
    unknown_nutrient_count = 0
    foods_created = 0
    foods_updated = 0

    rejected_records: List[Dict[str, Any]] = []
    skipped_records: List[Dict[str, Any]] = []
    unresolved_records: List[Dict[str, Any]] = []

    for item in VERIFIED_IFCT_FOODS_DATASET:
        code = item["code"]
        ext_name = item["name"]
        catalog_food_name = item["catalog_food_name"]

        # Validate numeric ranges
        validation_errors = validate_nutrient_values(code, ext_name, item["values"])
        if validation_errors:
            rejection_entry = {
                "code": code,
                "name": ext_name,
                "reasons": validation_errors,
            }
            rejected_records.append(rejection_entry)
            if strict_mode:
                if dry_run:
                    session.rollback()
                raise ValueError(f"Strict ingestion validation failed for IFCT food {code} ({ext_name}): {validation_errors}")
            continue

        # 1. Resolve Food entity
        food, was_created = resolve_or_create_food_reference(
            session=session,
            catalog_food_name=catalog_food_name,
            group_name=item["group"],
            serving_size=item.get("serving_size", "100g"),
            unit=item.get("unit", "500g"),
            external_code=code,
            data_source_id=data_source.id,
        )
        if was_created:
            foods_created += 1
        else:
            foods_updated += 1

        # Check for unverified preparation state or retail cultivar marketing claims
        is_state_mismatch = code in ("B002", "B011", "F013")
        is_retail_marketing_claim = code in ("A013", "L003")

        # Explicitly control preparation state mismatch via reliable data field on Food
        current_tags = json.loads(food.nutrition_tags or "[]")
        if is_state_mismatch:
            if "preparation_state_mismatch" not in current_tags:
                current_tags.append("preparation_state_mismatch")
        else:
            if "preparation_state_mismatch" in current_tags:
                current_tags.remove("preparation_state_mismatch")
        food.nutrition_tags = json.dumps(current_tags)
        session.flush()

        # 2. Build or resolve SourceRecord
        raw_payload_dict = {
            "source": "ICMR-NIN IFCT 2017",
            "ifct_code": code,
            "description": ext_name,
            "food_group": item["group"],
            "table_references": {
                "proximate_table": 1,
                "table1_page": item["table1_page"],
                "table1_pdf_page": item["table1_page"],
                "table1_printed_page": item["table1_page"] - 37,
                "vitamins_table": 2,
                "table2_page": item["table2_page"],
                "table2_pdf_page": item["table2_page"],
                "table2_printed_page": item["table2_page"] - 37,
                "minerals_table": 5,
                "table5_page": item["table5_page"],
                "table5_pdf_page": item["table5_page"],
                "table5_printed_page": item["table5_page"] - 37,
            },
            "national_samples_count": item["n_samples"],
            "measurement_basis": "per_100g_edible",
            "food_state": "raw",
            "preparation_state_audit": {
                "has_state_mismatch": is_state_mismatch,
                "catalog_display_name": catalog_food_name,
                "ifct_source_state": "raw agricultural commodity (per 100g edible portion)",
                "audit_note": (
                    "Catalog display name implies sprouted or thermal preparation state, whereas "
                    "IFCT source record represents raw unsprouted/fresh agricultural commodity. "
                    "Item is marked unavailable for incompatible recommendations until culinary yield is established."
                    if is_state_mismatch
                    else "Preparation state verified as raw agricultural commodity."
                ),
            },
            "identity_notes": (
                "Catalog display name includes retail marketing wording ('Single-Origin' or 'Malai') "
                "not established by national composite IFCT sampling."
                if is_retail_marketing_claim
                else "Canonical food identity verified."
            ),
            "pdf_checksum_sha256": IFCT_PDF_EXPECTED_SHA256 if pdf_verified else None,
            "citation": "Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). Indian Food Composition Tables. ICMR-NIN, Hyderabad.",
            "license": "ICMR-NIN Copyright 2017 (Reproducible for personal/academic use with acknowledgment; commercial/bulk product creation requires prior written permission)",
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
            updated_source_records += 1

        # 3. Insert or update FoodNutrient entries for all canonical nutrients
        for canon_code, nutrient in nutrient_map.items():
            raw_val = item["values"].get(canon_code)
            is_unknown = raw_val is None
            unknown_reason = None
            if is_unknown:
                unknown_nutrient_count += 1
                if canon_code in ("FIBTG", "FIBINS", "FIBSOL") and item["group"] in (
                    "Milk and Milk Products",
                    "Egg and Poultry Products",
                ):
                    unknown_reason = f"Dietary fibre unanalyzed or not applicable to animal/dairy matrix ({item['group']}) in IFCT Table 1"
                elif canon_code == "CHOAVLDF" and item["group"] == "Egg and Poultry Products":
                    unknown_reason = "Available carbohydrates unanalyzed for poultry egg in IFCT Table 1"
                elif canon_code in ("CA", "FE") and item["group"] == "Egg and Poultry Products":
                    unknown_reason = "Calcium and Iron unassayed in IFCT 2017 Table 5 for poultry egg"
                elif canon_code == "VITC" and item["group"] in (
                    "Cereals and Millets",
                    "Grain Legumes",
                    "Condiments and Spices",
                    "Nuts and Seeds",
                    "Egg and Poultry Products",
                ):
                    unknown_reason = "Ascorbic acid below detectable limit (BDL) or omitted in IFCT Table 2 for dry staple / egg"
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
                f"IFCT 2017 code {code}. Table 1 p.{item['table1_page'] - 37} (PDF p.{item['table1_page']}), "
                f"Table 2 p.{item['table2_page'] - 37} (PDF p.{item['table2_page']}), "
                f"Table 5 p.{item['table5_page'] - 37} (PDF p.{item['table5_page']}). "
                f"Samples from {item['n_samples']} national regions."
            )
            if is_state_mismatch:
                notes_str += " [preparation_state_mismatch: catalog product implies sprouted/thermal state vs raw IFCT source]."

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

    if dry_run:
        session.rollback()
        status_str = "dry_run"
    else:
        session.commit()
        status_str = "success"

    summary = {
        "status": status_str,
        "dry_run": dry_run,
        "data_source": data_source.name,
        "total_dataset_foods": len(VERIFIED_IFCT_FOODS_DATASET),
        "foods_created": foods_created,
        "foods_updated": foods_updated,
        "source_records_created": imported_source_records,
        "source_records_updated": updated_source_records,
        "canonical_nutrients_active": len(nutrient_map),
        "food_nutrients_created": imported_food_nutrients,
        "food_nutrients_updated": updated_food_nutrients,
        "unknown_nutrients_preserved": unknown_nutrient_count,
        "skipped_records": skipped_records,
        "rejected_records": rejected_records,
        "unresolved_records": unresolved_records,
        "pdf_integrity_verified": pdf_verified,
    }
    logger.info("Ingestion completed: %s", summary)
    return summary
