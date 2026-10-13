#!/usr/bin/env python3
"""Nutriverse — CLI Ingestion Script for IFCT 2017 Dataset Expansion (Phase 6.1).

Executes idempotent ingestion of 50 verified Indian foods from ICMR-NIN IFCT 2017.
Supports dry-run validation, strict error enforcement, and JSON reporting.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.services.ifct_ingestion import (
    IFCT_PDF_PATH,
    VERIFIED_IFCT_FOODS_DATASET,
    ingest_ifct_expansion,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("nutriverse.ingest_ifct_expansion")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Phase 6.1 expanded Indian foods dataset from ICMR-NIN IFCT 2017"
    )
    parser.add_argument(
        "--pdf",
        type=Path,
        default=REPO_ROOT / "datasets" / "IFCT2017.pdf",
        help="Path to IFCT2017.pdf",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=os.environ.get("DATABASE_URL", "sqlite:///./nutriverse.db"),
        help="Database URL (default: sqlite:///./nutriverse.db)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate validation and calculations without database writes",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=True,
        help="Enforce strict biological and physical validation bounds",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        help="Optional path to write JSON summary report",
    )
    args = parser.parse_args()

    db_url = args.db
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    target_engine = create_engine(db_url, connect_args=connect_args)
    TargetSession = sessionmaker(bind=target_engine, autoflush=False, autocommit=False)
    session = TargetSession()

    try:
        summary = ingest_ifct_expansion(
            session=session,
            pdf_path=args.pdf,
            dry_run=args.dry_run,
            strict_mode=args.strict,
        )
        print("\n==================================================")
        print("   Nutriverse IFCT 2017 Expansion Ingestion Report")
        print("==================================================")
        print(f"  Status:                       {summary['status'].upper()}")
        print(f"  Dry Run:                      {summary['dry_run']}")
        print(f"  Data Source:                  {summary['data_source']}")
        print(f"  PDF Integrity Verified:       {summary['pdf_integrity_verified']}")
        print(f"  Total Dataset Foods:          {summary['total_dataset_foods']}")
        print(f"  Foods Created:                {summary['foods_created']}")
        print(f"  Foods Updated (Existing):     {summary['foods_updated']}")
        print(f"  SourceRecords Created:        {summary['source_records_created']}")
        print(f"  SourceRecords Updated:        {summary['source_records_updated']}")
        print(f"  Active Canonical Nutrients:   {summary['canonical_nutrients_active']}")
        print(f"  FoodNutrients Created:        {summary['food_nutrients_created']}")
        print(f"  FoodNutrients Updated:        {summary['food_nutrients_updated']}")
        print(f"  Unknown Nutrients Preserved:  {summary['unknown_nutrients_preserved']}")
        print(f"  Rejected Records:             {len(summary['rejected_records'])}")
        print(f"  Skipped Records:              {len(summary['skipped_records'])}")
        print(f"  Unresolved Records:           {len(summary['unresolved_records'])}")
        print("==================================================\n")

        if args.json_output:
            with open(args.json_output, "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2)
            print(f"Wrote full JSON report to {args.json_output}")

    finally:
        session.close()
        target_engine.dispose()


if __name__ == "__main__":
    main()
