"""Nutriverse Barcode Lookup, Normalization & Provenance Integration Service.

Phase 4 & 4.1 Implementation:
- Exact-match barcode resolution (local catalog first, cached external source records second, Open Food Facts third).
- Conservative barcode normalization: preserves leading zeroes, validates character set and length (3-32 alphanumeric).
- Retail GTIN Modulo-10 checksum calculation and validation utility for standard GTINs (EAN-8, UPC-A, EAN-13, ITF-14).
- Rejects fuzzy matches, substring matches, and name-based heuristic guessing.
- Validates returned product barcode against requested barcode (rejection of mismatches and redirects).
- Normalizes product identity fields (name, brand, quantity, serving size, ingredients, categories, packaging, countries, image).
- Strict provenance tracking:
  * Open Food Facts entries are always 'source_reported' (never 'verified_reference').
  * Local catalog membership alone never implies verification: legacy foods without traceable SourceRecords are 'pending_review'.
  * Only foods with traceable FoodNutrient records linked to scientific SourceRecords receive 'verified_reference'.
- Unknown/missing nutrients are explicitly preserved as None with is_unknown=True (never coerced to 0.0).
- Safe database caching: external products are saved as SourceRecords without corrupting local store catalog.
- Distinguishes invalid input (400), not found (404), upstream mismatch (422), upstream timeout (504), rate limit (429), and upstream failure (502).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from backend.app.main import (
        DataSource,
        Food,
        SourceRecord,
        VerificationStatus,
    )
    from backend.app.services.openfoodfacts import (
        OpenFoodFactsBarcodeMismatchError,
        OpenFoodFactsClient,
        OpenFoodFactsError,
        OpenFoodFactsRateLimitError,
        OpenFoodFactsTimeoutError,
    )
except ImportError:
    from app.main import (
        DataSource,
        Food,
        SourceRecord,
        VerificationStatus,
    )
    from app.services.openfoodfacts import (
        OpenFoodFactsBarcodeMismatchError,
        OpenFoodFactsClient,
        OpenFoodFactsError,
        OpenFoodFactsRateLimitError,
        OpenFoodFactsTimeoutError,
    )

logger = logging.getLogger("nutriverse.barcode_lookup")

OFF_DATASOURCE_NAME = "Open Food Facts"
ODBL_ATTRIBUTION = (
    "Contains information from Open Food Facts, which is made available here "
    "under the Open Database License (ODbL)."
)
IFCT_ATTRIBUTION = (
    "Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). "
    "Indian Food Composition Tables. National Institute of Nutrition, ICMR, Hyderabad."
)
LEGACY_CATALOG_ATTRIBUTION = (
    "Nutriverse store catalog profile; awaiting laboratory reference verification."
)


class BarcodeValidationError(ValueError):
    """Raised when an invalid barcode format is provided."""
    pass


RETAIL_GTIN_FORMATS = {
    8: "EAN-8",
    12: "UPC-A",
    13: "EAN-13",
    14: "ITF-14",
}


def compute_gtin_check_digit(digits: str) -> int:
    """Computes the standard GS1 Modulo-10 check digit for numeric GTIN payloads.

    Algorithm:
    Starting from the rightmost payload digit, multiply by alternating weights 3 and 1.
    Sum the products, then check_digit = (10 - (sum % 10)) % 10.
    """
    total = 0
    for i, char in enumerate(reversed(digits), start=1):
        weight = 3 if i % 2 == 1 else 1
        total += int(char) * weight
    return (10 - (total % 10)) % 10


def is_valid_gtin_checksum(barcode: str) -> bool:
    """Validates GS1 Modulo-10 checksum for standard numeric GTIN lengths (8, 12, 13, 14).

    Returns True for valid GTIN checksums, or True for non-standard lengths.
    Returns False if standard length numeric GTIN has an invalid check digit.
    """
    if not barcode.isdigit() or len(barcode) not in RETAIL_GTIN_FORMATS:
        return True
    expected = compute_gtin_check_digit(barcode[:-1])
    return int(barcode[-1]) == expected


def is_retail_gtin(barcode: str) -> bool:
    """Returns True if the barcode matches a standard retail GTIN format (8, 12, 13, 14 digits)."""
    return barcode.isdigit() and len(barcode) in RETAIL_GTIN_FORMATS


def get_gtin_format_name(barcode: str) -> Optional[str]:
    """Returns the retail GTIN format name, or None if not a standard GTIN format."""
    if barcode.isdigit():
        return RETAIL_GTIN_FORMATS.get(len(barcode))
    return None


def is_internal_sku(barcode: str) -> bool:
    """Returns True if the barcode represents an internal store SKU rather than a retail GTIN."""
    return not is_retail_gtin(barcode)


def validate_retail_gtin(barcode: str) -> None:
    """Validates retail GTIN formats (EAN-8, UPC-A, EAN-13, ITF-14) and their GS1 check digits.

    Raises BarcodeValidationError if format or check digit is invalid.
    """
    if not barcode.isdigit():
        raise BarcodeValidationError(f"Retail GTIN '{barcode}' must contain only numeric digits.")
    fmt = RETAIL_GTIN_FORMATS.get(len(barcode))
    if not fmt:
        raise BarcodeValidationError(
            f"Unsupported GTIN length ({len(barcode)}) for '{barcode}'. "
            f"Supported retail GTIN formats are EAN-8 (8 digits), UPC-A (12 digits), "
            f"EAN-13 (13 digits), and ITF-14 (14 digits)."
        )
    expected = compute_gtin_check_digit(barcode[:-1])
    actual = int(barcode[-1])
    if actual != expected:
        raise BarcodeValidationError(
            f"Invalid {fmt} check digit for barcode '{barcode}'. "
            f"Expected check digit {expected}, but received {actual}. "
            f"Barcode scan appears corrupted or malformed."
        )


def validate_internal_sku(sku: str) -> None:
    """Validates store-internal SKU identifiers separately from retail GTIN formats.

    Internal SKUs must be between 3 and 32 characters and contain only alphanumeric
    characters, hyphens, or underscores.
    """
    if not sku:
        raise BarcodeValidationError("Internal SKU cannot be empty.")
    if len(sku) < 3 or len(sku) > 32:
        raise BarcodeValidationError(
            f"Invalid internal SKU length ({len(sku)}) for '{sku}'. Must be between 3 and 32 characters."
        )
    import re
    if not re.match(r"^[A-Za-z0-9_-]+$", sku):
        raise BarcodeValidationError(
            f"Invalid internal SKU characters in '{sku}'. "
            f"Internal SKUs may only contain alphanumeric characters, hyphens, and underscores."
        )


def normalize_barcode(
    barcode: Any,
    allow_synthetic: Optional[bool] = None,
    validate_checksum: Optional[bool] = None,
) -> str:
    """Normalizes and validates a barcode or SKU according to environmental safety rules.

    Audit A Integrity Rules:
    1. Preserves leading zeros (string preserved without integer coercion).
    2. Separates retail GTIN validation from internal SKU validation.
    3. In production: retail GTINs (EAN-8, UPC-A, EAN-13, ITF-14) MUST have a valid GS1 Modulo-10 check digit.
       Invalid retail GTINs are NEVER silently accepted in production.
    4. Permits synthetic test GTINs only when explicitly enabled in development/test configuration
       (e.g., allow_synthetic=True, or ALLOW_SYNTHETIC_BARCODES=true in non-production environments).
    5. Internal SKUs (alphanumeric, non-GTIN length) are validated by internal SKU rules and do not require GTIN check digits.
    """
    if not isinstance(barcode, str):
        raise BarcodeValidationError("Barcode must be a string.")

    cleaned = barcode.strip()
    if not cleaned:
        raise BarcodeValidationError("Barcode cannot be empty.")

    if len(cleaned) < 3 or len(cleaned) > 32:
        raise BarcodeValidationError(
            f"Invalid barcode length ({len(cleaned)}) for '{cleaned}'. Barcodes must be between 3 and 32 characters."
        )

    if not cleaned.isalnum():
        raise BarcodeValidationError(
            f"Invalid barcode characters in '{cleaned}'. Barcodes must be alphanumeric."
        )

    # Determine environment permissions
    # In production, synthetic barcodes are strictly forbidden regardless of flags
    app_env = os.environ.get("APP_ENV", "production").strip().lower()
    is_production = (app_env == "production")

    # Backward compatibility with validate_checksum parameter
    if validate_checksum is not None and allow_synthetic is None:
        allow_synthetic = not validate_checksum

    if allow_synthetic is None:
        if is_production:
            allow_synthetic = False
        else:
            allow_synthetic = os.environ.get("ALLOW_SYNTHETIC_BARCODES", "false").strip().lower() in ("true", "1", "yes")

    # If in production, force allow_synthetic to False
    if is_production and allow_synthetic:
        logger.warning("allow_synthetic requested in production environment; forcing allow_synthetic=False for data integrity.")
        allow_synthetic = False

    # Dispatch: Retail GTIN vs Internal SKU
    if is_retail_gtin(cleaned):
        if not allow_synthetic:
            validate_retail_gtin(cleaned)
        else:
            if not is_valid_gtin_checksum(cleaned):
                fmt = get_gtin_format_name(cleaned)
                logger.info(
                    "Permitting synthetic test barcode '%s' (%s) under development/test configuration.",
                    cleaned,
                    fmt,
                )
    else:
        # Internal SKU validation (separate from retail GTIN)
        validate_internal_sku(cleaned)

    return cleaned


def get_or_create_off_datasource(session: Session) -> DataSource:
    """Retrieves or registers the canonical Open Food Facts DataSource."""
    source = session.scalar(select(DataSource).where(DataSource.name == OFF_DATASOURCE_NAME))
    if not source:
        source = DataSource(
            name=OFF_DATASOURCE_NAME,
            publisher="Open Food Facts Association (Paris, France)",
            url="https://world.openfoodfacts.org",
            license="Open Database License (ODbL) v1.0",
            license_url="https://opendatacommons.org/licenses/odbl/1-0/",
            version="API v2",
            terms_notes=(
                "Crowdsourced open database under ODbL §4.3. Attribution mandatory. "
                "Derivative database adaptations subject to ODbL §4.4."
            ),
            active=True,
        )
        session.add(source)
        try:
            session.commit()
            session.refresh(source)
        except Exception:
            session.rollback()
            source = session.scalar(select(DataSource).where(DataSource.name == OFF_DATASOURCE_NAME))
            if not source:
                raise
    return source


def _format_local_food_result(food: Food, clean_barcode: str) -> Dict[str, Any]:
    """Formats an exact local catalog match into the standard Phase 4 response structure.

    Audit A Integrity Rule:
    - Membership in the local store catalog alone NEVER marks nutrition as 'verified_reference'.
    - Only nutrients that possess a linked laboratory SourceRecord are marked as 'verified_reference'.
    - Legacy store catalog entries lacking a relational SourceRecord are reported as 'pending_review'.
    """
    nutrients: List[Dict[str, Any]] = []
    has_traceable_reference = False

    # 1. Relational FoodNutrient records inspection
    if getattr(food, "nutrients_rel", None) and len(food.nutrients_rel) > 0:
        verified_count = 0
        total_count = 0

        for fn in food.nutrients_rel:
            total_count += 1
            # Strict verification requirement: status must be verified_reference AND have a traceable source record
            is_verified = (
                fn.verification_status == VerificationStatus.verified_reference.value
                and fn.source_record_id is not None
            )

            if is_verified:
                verified_count += 1
                v_status = VerificationStatus.verified_reference.value
                u_reason = fn.unknown_reason
            else:
                v_status = (
                    fn.verification_status
                    if fn.verification_status != VerificationStatus.verified_reference.value
                    else VerificationStatus.pending_review.value
                )
                u_reason = fn.unknown_reason or (
                    "Lacks linked laboratory SourceRecord" if fn.source_record_id is None else None
                )

            nutrients.append({
                "canonical_code": fn.nutrient.canonical_code if fn.nutrient else "UNKNOWN",
                "nutrient_name": fn.nutrient.name if fn.nutrient else "Nutrient",
                "value": fn.value,
                "unit": fn.unit,
                "basis": fn.basis,
                "is_unknown": fn.is_unknown,
                "unknown_reason": u_reason,
                "verification_status": v_status,
                "source_record_id": fn.source_record_id,
            })

        if verified_count == total_count and total_count > 0:
            product_v_status = VerificationStatus.verified_reference.value
            has_traceable_reference = True
        else:
            product_v_status = VerificationStatus.pending_review.value

    # 2. Legacy catalog fields fallback (no relational FoodNutrient records)
    else:
        # Food membership in the store catalog does not imply laboratory verification
        product_v_status = VerificationStatus.pending_review.value
        legacy_reason = "Unverified legacy store catalog estimate without traceable laboratory SourceRecord"

        nutrients.extend([
            {
                "canonical_code": "ENERC_KCAL",
                "nutrient_name": "Energy (kcal)",
                "value": round(float(food.calories), 2),
                "unit": "kcal",
                "basis": "per_100g_edible",
                "is_unknown": False,
                "unknown_reason": legacy_reason,
                "verification_status": VerificationStatus.pending_review.value,
                "source_record_id": None,
            },
            {
                "canonical_code": "PROTCNT",
                "nutrient_name": "Protein",
                "value": round(float(food.protein_g), 2),
                "unit": "g",
                "basis": "per_100g_edible",
                "is_unknown": False,
                "unknown_reason": legacy_reason,
                "verification_status": VerificationStatus.pending_review.value,
                "source_record_id": None,
            },
            {
                "canonical_code": "CHOAVLDF",
                "nutrient_name": "Carbohydrates, available",
                "value": round(float(food.carbs_g), 2),
                "unit": "g",
                "basis": "per_100g_edible",
                "is_unknown": False,
                "unknown_reason": legacy_reason,
                "verification_status": VerificationStatus.pending_review.value,
                "source_record_id": None,
            },
            {
                "canonical_code": "FATCE",
                "nutrient_name": "Total Fat",
                "value": round(float(food.fat_g), 2),
                "unit": "g",
                "basis": "per_100g_edible",
                "is_unknown": False,
                "unknown_reason": legacy_reason,
                "verification_status": VerificationStatus.pending_review.value,
                "source_record_id": None,
            },
            {
                "canonical_code": "FIBTG",
                "nutrient_name": "Dietary Fibre",
                "value": round(float(food.fibre_g), 2),
                "unit": "g",
                "basis": "per_100g_edible",
                "is_unknown": False,
                "unknown_reason": legacy_reason,
                "verification_status": VerificationStatus.pending_review.value,
                "source_record_id": None,
            },
        ])

        # Parse vitamins_json if available
        try:
            vitamins = json.loads(food.vitamins_json or "{}")
            for k, v in vitamins.items():
                if v is not None:
                    unit = "mg" if "_mg" in k else ("mcg" if "_mcg" in k else "g")
                    code = k.upper().replace(f"_{unit.upper()}", "")
                    name = k.replace("_", " ").title()
                    nutrients.append({
                        "canonical_code": code,
                        "nutrient_name": name,
                        "value": float(v) if isinstance(v, (int, float)) else None,
                        "unit": unit,
                        "basis": "per_100g_edible",
                        "is_unknown": False,
                        "unknown_reason": legacy_reason,
                        "verification_status": VerificationStatus.pending_review.value,
                        "source_record_id": None,
                    })
        except Exception:
            pass

    # Build provenance-accurate source structure
    local_img_prov = {
        "url": food.image_source_url,
        "source_url": food.image_source_url,
        "license": "Proprietary / Nutriverse Catalog" if food.image_source_url else None,
        "license_status": "known" if food.image_source_url else "no_image",
        "contributor": "Nutriverse Whole Foods Catalog" if food.image_source_url else None,
        "attribution": "Product catalog photography copyright © Nutriverse." if food.image_source_url else "No product packaging image reported.",
    }

    if has_traceable_reference:
        source_info = {
            "name": "Nutriverse Authoritative Catalog (ICMR-NIN IFCT 2017 Ground Truth)",
            "record_id": food.id,
            "publisher": "National Institute of Nutrition (ICMR), Hyderabad",
            "license": "ICMR Analytical Food Composition Tables (Scholarly Reference)",
            "attribution": IFCT_ATTRIBUTION,
            "image_license": local_img_prov["license"],
            "image_attribution": local_img_prov["attribution"],
            "image_contributor": local_img_prov["contributor"],
            "image_provenance": local_img_prov,
            "retrieval_date": None,
        }
        license_attr = "Nutriverse Verified Whole Food Intelligence (ICMR-NIN IFCT 2017 Ground Truth)."
    else:
        source_info = {
            "name": "Nutriverse Store Catalog (Legacy Unverified)",
            "record_id": food.id,
            "publisher": "Nutriverse Product Catalog",
            "license": "Proprietary Store Catalog Data",
            "attribution": LEGACY_CATALOG_ATTRIBUTION,
            "image_license": local_img_prov["license"],
            "image_attribution": local_img_prov["attribution"],
            "image_contributor": local_img_prov["contributor"],
            "image_provenance": local_img_prov,
            "retrieval_date": None,
        }
        license_attr = "Nutriverse Whole Foods Catalog (Awaiting Independent Reference Verification)."

    return {
        "barcode": clean_barcode,
        "match_type": "local_catalog",
        "is_in_catalog": True,
        "product": {
            "id": food.id,
            "name": food.name,
            "brand": None,
            "category": food.category,
            "description": food.description,
            "serving_size": food.serving_size,
            "serving_quantity": None,
            "quantity": food.unit,
            "packaging": None,
            "countries": "India",
            "ingredients": food.ingredients,
            "image_url": food.image_source_url,
            "price_paise": food.price_paise,
            "stock_qty": food.stock_qty,
            "emoji": food.emoji,
            "nutrition_tags": json.loads(food.nutrition_tags or "[]"),
            "dietary_tags": json.loads(food.dietary_tags or "[]"),
        },
        "basis": "per_100g_edible",
        "nutrients": nutrients,
        "source": source_info,
        "verification_status": product_v_status,
        "license_attribution": license_attr,
    }


def _format_external_off_result(
    parsed: Dict[str, Any],
    clean_barcode: str,
    match_type: str,
    record_id: Optional[str] = None,
    retrieval_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Formats an Open Food Facts product result into the standard Phase 4 response structure.

    Audit B Integrity Rules:
    - Preserves specific image licence, attribution, source URL, and contributor metadata.
    - Represents unverified image licensing as 'unknown' rather than asserting blanket compliance.
    - Strictly isolates database ODbL rights from image copyright and permissions.
    """
    img_prov = parsed.get("image_provenance")
    if not img_prov:
        img_url = parsed.get("image_url")
        if img_url:
            img_prov = {
                "url": img_url,
                "source_url": img_url,
                "license": parsed.get("image_license") or "unknown",
                "license_status": "known" if parsed.get("image_license") else "unknown",
                "contributor": parsed.get("image_contributor"),
                "attribution": parsed.get("image_attribution") or "Product packaging photo via Open Food Facts. Specific image license unverified.",
            }
        else:
            img_prov = {
                "url": None,
                "source_url": None,
                "license": None,
                "license_status": "no_image",
                "contributor": None,
                "attribution": "No product packaging image reported.",
            }

    return {
        "barcode": clean_barcode,
        "match_type": match_type,
        "is_in_catalog": False,
        "product": {
            "id": None,
            "name": parsed.get("product_name") or parsed.get("external_name") or "Unknown Product",
            "brand": parsed.get("brand"),
            "category": parsed.get("category"),
            "description": None,
            "serving_size": parsed.get("serving_size") or "100g",
            "serving_quantity": parsed.get("serving_quantity"),
            "quantity": parsed.get("quantity"),
            "packaging": parsed.get("packaging"),
            "countries": parsed.get("countries"),
            "ingredients": parsed.get("ingredients"),
            "image_url": img_prov["url"],
            "price_paise": None,
            "stock_qty": 0,
            "emoji": "📦",
            "nutrition_tags": [],
            "dietary_tags": [],
        },
        "basis": parsed.get("basis", "per_100g"),
        "nutrients": parsed.get("nutrients", []),
        "source": {
            "name": OFF_DATASOURCE_NAME,
            "record_id": record_id,
            "publisher": "Open Food Facts Association (Paris, France)",
            "license": "Open Database License (ODbL) v1.0",
            "attribution": ODBL_ATTRIBUTION,
            "image_license": img_prov["license"],
            "image_attribution": img_prov["attribution"],
            "image_contributor": img_prov["contributor"],
            "image_provenance": img_prov,
            "retrieval_date": retrieval_date,
        },
        "verification_status": VerificationStatus.source_reported.value,
        "license_attribution": ODBL_ATTRIBUTION,
        "legal_disclaimer": (
            "Open Food Facts database data is made available under the Open Database License (ODbL) v1.0. "
            "Product packaging imagery is subject to individual contributor copyright and applicable "
            "Creative Commons licenses (or unknown where unverified). Inclusion of attribution does not "
            "constitute an independent legal warranty of third-party copyright compliance or analytical accuracy."
        ),
    }


def lookup_exact_barcode(
    barcode: str,
    session: Session,
    off_client: Optional[OpenFoodFactsClient] = None,
    force_refresh: bool = False,
    allow_synthetic: Optional[bool] = None,
    validate_checksum: Optional[bool] = None,
    max_cache_age_days: Optional[int] = 30,
) -> Optional[Dict[str, Any]]:
    """Performs an exact barcode lookup with strict provenance, checksum validation, and normalization.

    Workflow:
    1. Normalizes and validates the barcode string format against environment policies.
    2. Exact match check against active local Food records.
    3. Check against previously cached external SourceRecord in database (unless force_refresh is requested).
    4. Query upstream Open Food Facts API with code equality validation and controlled retry.
    5. Safely caches or refreshes successful upstream response as a SourceRecord.
    6. Return explicit None when no exact match exists anywhere.
    """
    clean_barcode = normalize_barcode(
        barcode,
        allow_synthetic=allow_synthetic,
        validate_checksum=validate_checksum,
    )

    # 1. Exact local catalog search first
    local_food = session.scalar(
        select(Food).where(Food.barcode == clean_barcode, Food.active.is_(True))
    )
    if local_food:
        logger.info("Barcode %s resolved via exact local catalog match (%s)", clean_barcode, local_food.id)
        return _format_local_food_result(local_food, clean_barcode)

    # 2. Check local database cache for previous OFF lookups
    client = off_client or OpenFoodFactsClient()
    off_source = get_or_create_off_datasource(session)

    cached_record = session.scalar(
        select(SourceRecord).where(
            SourceRecord.source_id == off_source.id,
            SourceRecord.external_id == clean_barcode,
        )
    )

    if cached_record and not force_refresh:
        is_stale = False
        if max_cache_age_days is not None and cached_record.retrieval_date:
            try:
                retrieval_dt = (
                    cached_record.retrieval_date.replace(tzinfo=timezone.utc)
                    if cached_record.retrieval_date.tzinfo is None
                    else cached_record.retrieval_date
                )
                age_days = (datetime.now(timezone.utc) - retrieval_dt).total_seconds() / 86400.0
                if age_days > max_cache_age_days:
                    is_stale = True
                    logger.info("Cached SourceRecord %s is stale (age %.1f days); refreshing upstream", cached_record.id, age_days)
            except Exception:
                is_stale = False

        if not is_stale:
            logger.info("Barcode %s resolved via cached Open Food Facts SourceRecord (%s)", clean_barcode, cached_record.id)
            try:
                raw_payload = json.loads(cached_record.raw_payload)
                parsed = client.parse_product_payload(raw_payload)
                retrieval_dt = (
                    cached_record.retrieval_date.replace(tzinfo=timezone.utc)
                    if cached_record.retrieval_date and cached_record.retrieval_date.tzinfo is None
                    else cached_record.retrieval_date
                )
                return _format_external_off_result(
                    parsed=parsed,
                    clean_barcode=clean_barcode,
                    match_type="external_cached",
                    record_id=cached_record.id,
                    retrieval_date=retrieval_dt.isoformat() if retrieval_dt else None,
                )
            except Exception as exc:
                logger.warning("Failed to deserialize cached payload for barcode %s: %s; falling back to upstream", clean_barcode, exc)

    # 3. Query Open Food Facts upstream
    logger.info("Querying Open Food Facts for barcode %s (force_refresh=%s)", clean_barcode, force_refresh)
    raw_upstream = client.fetch_product(clean_barcode)
    if not raw_upstream:
        logger.info("Barcode %s not found in local catalog or Open Food Facts", clean_barcode)
        return None

    # Validate returned barcode against requested barcode (reject redirects and fuzzy hits)
    product = raw_upstream.get("product", {})
    returned_code = str(product.get("code") or raw_upstream.get("code") or "").strip()
    if returned_code and returned_code != clean_barcode:
        logger.error(
            "Rejecting ambiguous barcode lookup: requested '%s' but received '%s'",
            clean_barcode,
            returned_code,
        )
        raise OpenFoodFactsBarcodeMismatchError(
            f"Returned product code '{returned_code}' does not match requested barcode '{clean_barcode}'."
        )

    parsed = client.parse_product_payload(raw_upstream)

    # 4. Safely persist or refresh database cache as a SourceRecord
    record_id: Optional[str] = None
    retrieval_time = datetime.now(timezone.utc)
    try:
        if cached_record:
            if cached_record.raw_checksum != parsed.get("raw_checksum"):
                logger.info("Updating cached SourceRecord %s with fresh payload from upstream", cached_record.id)
                cached_record.raw_payload = parsed.get("raw_payload", "{}")
                cached_record.raw_checksum = parsed.get("raw_checksum")
                cached_record.external_name = parsed.get("external_name", "Open Food Facts Product")[:255]
            cached_record.retrieval_date = retrieval_time
            session.commit()
            session.refresh(cached_record)
            record_id = cached_record.id
        else:
            new_sr = SourceRecord(
                source_id=off_source.id,
                external_id=clean_barcode,
                external_name=parsed.get("external_name", "Open Food Facts Product")[:255],
                raw_payload=parsed.get("raw_payload", "{}"),
                raw_checksum=parsed.get("raw_checksum"),
                retrieval_date=retrieval_time,
            )
            session.add(new_sr)
            session.commit()
            session.refresh(new_sr)
            record_id = new_sr.id
            logger.info("Cached Open Food Facts result for barcode %s as SourceRecord %s", clean_barcode, record_id)
    except Exception as exc:
        session.rollback()
        logger.warning("Could not persist Open Food Facts cache for barcode %s: %s", clean_barcode, exc)
        record_id = cached_record.id if cached_record else None

    return _format_external_off_result(
        parsed=parsed,
        clean_barcode=clean_barcode,
        match_type="external_fresh",
        record_id=record_id,
        retrieval_date=retrieval_time.isoformat(),
    )
