"""Nutriverse — Deterministic Personalized Nutrition Recommendations Engine.

Phase 6.0 Implementation:
- Relates verified food composition records to user's personal nutrition targets.
- Deterministic ranking rules: target contribution percentage (primary), nutrient density per 100 kcal (secondary), alphabetical food name (tertiary).
- Never converts missing or unknown nutrient values into zero. Foods with unanalyzed or unknown target nutrients are explicitly excluded.
- Excludes unverified or legacy catalog records in strict mode (requires 'verified_reference').
- Enforces food-state integrity (distinguishes raw and cooked, requires explicit yield factor if state differs).
- Filters declared user allergens (e.g. dairy, peanuts, gluten, etc.).
- Preserves full source provenance, licensing, measurement basis, and verification status.
- Rejects unsupported micronutrient targets; does not invent unscientific personalized requirements.
- Distinguishes food portion contribution from user's remaining daily target.
- Pure read-only computation: never mutates cart, inventory, or order records.
"""

from __future__ import annotations

import json
import logging
import math
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from backend.app.main import (
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        NutritionProfile,
        SourceRecord,
        User,
        VerificationStatus,
    )
    from backend.app.nutrition_engine import (
        CalculationMode,
        IncompatibleFoodStateError,
        IncompatibleUnitError,
        calculate_food_portion_nutrients,
        resolve_serving_size_to_grams,
    )
    from backend.app.nutrition_targets import (
        calculate_nutrition_targets,
        resolve_method_identifier,
    )
except ImportError:
    from app.main import (
        DataSource,
        Food,
        FoodNutrient,
        Nutrient,
        NutritionProfile,
        SourceRecord,
        User,
        VerificationStatus,
    )
    from app.nutrition_engine import (
        CalculationMode,
        IncompatibleFoodStateError,
        IncompatibleUnitError,
        calculate_food_portion_nutrients,
        resolve_serving_size_to_grams,
    )
    from app.nutrition_targets import (
        calculate_nutrition_targets,
        resolve_method_identifier,
    )

logger = logging.getLogger("nutriverse.recommendations")

RECOMMENDATION_ENGINE_VERSION = "nutriverse-recs-v1"

# Standard non-clinical disclosure
CLINICAL_DISCLAIMER = (
    "Nutriverse food recommendations are informational and educational estimates derived from "
    "verified food composition tables and standard dietary planning formulas. They are not intended "
    "as clinical diagnoses, medical advice, disease treatment, or dietary prescriptions. "
    "Consult a qualified healthcare provider or registered dietitian before making significant dietary changes."
)

# Supported target nutrients mapped to canonical INFOODS/ICMR codes and target engine fields
SUPPORTED_RECOMMENDATION_NUTRIENTS: Dict[str, Dict[str, Any]] = {
    "protein": {
        "canonical_code": "PROTCNT",
        "name": "Protein",
        "unit": "g",
        "target_path": ("macronutrient_targets", "protein", "target_g_day"),
        "reference_source": "ICMR-NIN 2020 / US IOM Acceptable Macronutrient Distribution Range (AMDR 10%–35%)",
        "density_label": "g / 100 kcal",
    },
    "dietary_fiber": {
        "canonical_code": "FIBTG",
        "name": "Total Dietary Fibre",
        "unit": "g",
        "target_path": ("macronutrient_targets", "dietary_fiber", "target_g_day"),
        "reference_source": "ICMR-NIN 2020 (30g/2,000 kcal) / US IOM 2005 Adequate Intake (14g/1,000 kcal)",
        "density_label": "g / 100 kcal",
    },
    "fiber": {
        "canonical_code": "FIBTG",
        "name": "Total Dietary Fibre",
        "unit": "g",
        "target_path": ("macronutrient_targets", "dietary_fiber", "target_g_day"),
        "reference_source": "ICMR-NIN 2020 (30g/2,000 kcal) / US IOM 2005 Adequate Intake (14g/1,000 kcal)",
        "density_label": "g / 100 kcal",
    },
    "energy": {
        "canonical_code": "ENERC_KCAL",
        "name": "Energy (kcal)",
        "unit": "kcal",
        "target_path": ("energy_targets", "daily_energy_target_kcal"),
        "reference_source": "Predictive energy expenditure (Mifflin-St Jeor / ICMR-NIN / Schofield with PAL)",
        "density_label": "kcal / 100g",
    },
    "calories": {
        "canonical_code": "ENERC_KCAL",
        "name": "Energy (kcal)",
        "unit": "kcal",
        "target_path": ("energy_targets", "daily_energy_target_kcal"),
        "reference_source": "Predictive energy expenditure (Mifflin-St Jeor / ICMR-NIN / Schofield with PAL)",
        "density_label": "kcal / 100g",
    },
    "fat": {
        "canonical_code": "FATCE",
        "name": "Total Fat",
        "unit": "g",
        "target_path": ("macronutrient_targets", "fat", "target_g_day"),
        "reference_source": "AMDR 20%–35% total daily energy (ICMR-NIN 2020 / US IOM)",
        "density_label": "g / 100 kcal",
    },
    "carbohydrates": {
        "canonical_code": "CHOAVLDF",
        "name": "Carbohydrates, available",
        "unit": "g",
        "target_path": ("macronutrient_targets", "carbohydrates", "target_g_day"),
        "reference_source": "AMDR 45%–65% total daily energy (ICMR-NIN 2020 / US IOM)",
        "density_label": "g / 100 kcal",
    },
    "carbs": {
        "canonical_code": "CHOAVLDF",
        "name": "Carbohydrates, available",
        "unit": "g",
        "target_path": ("macronutrient_targets", "carbohydrates", "target_g_day"),
        "reference_source": "AMDR 45%–65% total daily energy (ICMR-NIN 2020 / US IOM)",
        "density_label": "g / 100 kcal",
    },
}

# Allergen keywords mapping
COMMON_ALLERGEN_PATTERNS: Dict[str, List[str]] = {
    "dairy": ["dairy", "milk", "paneer", "curd", "yoghurt", "yogurt", "cheese", "ghee", "butter", "cream", "whey", "casein"],
    "milk": ["dairy", "milk", "paneer", "curd", "yoghurt", "yogurt", "cheese", "ghee", "butter", "cream", "whey", "casein"],
    "lactose": ["dairy", "milk", "paneer", "curd", "yoghurt", "yogurt", "cheese", "ghee", "butter", "cream", "whey", "casein"],
    "peanut": ["peanut", "peanuts", "groundnut", "groundnuts"],
    "peanuts": ["peanut", "peanuts", "groundnut", "groundnuts"],
    "groundnut": ["peanut", "peanuts", "groundnut", "groundnuts"],
    "gluten": ["gluten", "wheat", "atta", "maida", "barley", "rye", "seitan", "semolina", "suji"],
    "wheat": ["wheat", "atta", "maida", "semolina", "suji"],
    "tree nut": ["almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan", "macadamia", "nut"],
    "tree nuts": ["almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan", "macadamia", "nut"],
    "nut": ["almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan", "peanut", "nut"],
    "nuts": ["almond", "walnut", "cashew", "pistachio", "hazelnut", "pecan", "peanut", "nut"],
    "soy": ["soy", "soya", "tofu", "edamame", "tempeh", "soybean"],
    "soya": ["soy", "soya", "tofu", "edamame", "tempeh", "soybean"],
    "egg": ["egg", "eggs", "albumin"],
    "eggs": ["egg", "eggs", "albumin"],
    "fish": ["fish", "salmon", "tuna", "cod", "anchovy"],
    "shellfish": ["shellfish", "prawn", "prawns", "shrimp", "crab", "lobster"],
    "sesame": ["sesame", "til", "tahini"],
    "mustard": ["mustard", "sarson", "rai"],
}


class RecommendationError(Exception):
    """Base exception for recommendation service errors."""
    pass


class UnsupportedTargetNutrientError(RecommendationError):
    """Raised when recommendations are requested for a nutrient lacking verified personal targets."""
    pass


class TargetEligibilityError(RecommendationError):
    """Raised when user profile lacks consent, is ineligible, or is missing required targets."""
    pass


class InvalidPortionError(RecommendationError):
    """Raised when an invalid, negative, or non-finite portion mass is specified."""
    pass


def extract_target_value_from_estimate(
    estimate: Dict[str, Any],
    target_nutrient_key: str,
) -> Tuple[float, str, str, str]:
    """Resolves target amount, unit, canonical code, and reference source from an estimate dict.

    Returns:
        (target_amount, unit, canonical_code, reference_source)

    Raises:
        UnsupportedTargetNutrientError if nutrient is not supported.
    """
    key_lower = target_nutrient_key.strip().lower()
    if key_lower not in SUPPORTED_RECOMMENDATION_NUTRIENTS:
        supported_keys = sorted(list(set(SUPPORTED_RECOMMENDATION_NUTRIENTS.keys())))
        raise UnsupportedTargetNutrientError(
            f"Personalized targets for nutrient '{target_nutrient_key}' are not supported. "
            "To prevent fabricating unverified clinical requirements, Nutriverse only generates recommendations "
            f"for nutrients with established peer-reviewed targets. Supported target nutrients: {supported_keys}."
        )

    meta = SUPPORTED_RECOMMENDATION_NUTRIENTS[key_lower]
    path = meta["target_path"]
    unit = meta["unit"]
    canonical_code = meta["canonical_code"]
    reference_source = meta["reference_source"]

    # Traverse nested dictionary
    curr: Any = estimate
    for step in path:
        if not isinstance(curr, dict) or step not in curr:
            raise UnsupportedTargetNutrientError(
                f"Nutrient target field '{'.'.join(path)}' not found in target estimate."
            )
        curr = curr[step]

    try:
        val = float(curr)
        if math.isnan(val) or math.isinf(val) or val <= 0:
            raise ValueError("Target value must be a positive finite number.")
    except Exception as exc:
        raise TargetEligibilityError(
            f"Invalid target amount for nutrient '{target_nutrient_key}': {exc}"
        )

    return val, unit, canonical_code, reference_source


def check_food_allergen_conflict(
    food: Food,
    user_allergies_str: Optional[str],
) -> Optional[str]:
    """Determines whether a food conflicts with any user-declared allergies.

    Returns the matching allergy term if a conflict is detected, else None.
    """
    if not user_allergies_str:
        return None

    cleaned_str = user_allergies_str.strip().lower()
    if cleaned_str in {"", "none", "no", "n/a", "nil", "none declared", "no allergies"}:
        return None

    # Parse individual allergy tokens
    tokens = [t.strip().lower() for t in re.split(r"[,;/]+", cleaned_str) if t.strip()]

    # Collect searchable food text
    food_text_corpus = f"{food.name} {food.category} {food.ingredients} {food.dietary_tags}".lower()

    for token in tokens:
        if not token:
            continue
        # Direct word/phrase match
        pattern = rf"\b{re.escape(token)}\b"
        if re.search(pattern, food_text_corpus):
            return token

        # Check known synonymous patterns for token or its component words (e.g. "lactose" in "lactose intolerance")
        sub_words = [w for w in re.split(r"\s+", token) if w and w not in {"intolerance", "allergy", "allergies", "sensitive", "sensitivity"}]
        for candidate_term in [token] + sub_words:
            synonyms = COMMON_ALLERGEN_PATTERNS.get(candidate_term, [])
            for syn in synonyms:
                syn_pattern = rf"\b{re.escape(syn)}\b"
                if re.search(syn_pattern, food_text_corpus):
                    return candidate_term

    return None


def check_food_preparation_state_mismatch(
    food: Food,
    session: Optional[Session] = None,
) -> Optional[str]:
    """Inspects explicit, reliable data fields to determine if a food has an unverified preparation-state mismatch.

    Rather than fragile display-name matching, this inspects:
    1. food.nutrition_tags containing "preparation_state_mismatch".
    2. Associated FoodNutrient records containing "[preparation_state_mismatch" in notes.
    3. Associated SourceRecord raw_payload containing preparation_state_audit.has_state_mismatch == True.

    Returns an explicit exclusion reason string if a mismatch is detected, or None if clear.
    """
    # 1. Explicit data field on Food: nutrition_tags
    try:
        tags = json.loads(food.nutrition_tags or "[]")
        if "preparation_state_mismatch" in tags:
            return (
                "Excluded: Preparation state mismatch recorded on food record (nutrition_tags='preparation_state_mismatch'). "
                "Marked unavailable for recommendations until verified sprouted/thermal nutrient profile "
                "or culinary conversion yield is established."
            )
    except (ValueError, TypeError):
        pass

    # 2. Explicit data fields on associated FoodNutrient and SourceRecord
    nutrients = food.nutrients_rel or []
    for fn in nutrients:
        if fn.notes and "preparation_state_mismatch" in fn.notes:
            return (
                "Excluded: Preparation state mismatch documented in FoodNutrient record notes. "
                "Marked unavailable for recommendations until verified sprouted/thermal nutrient profile "
                "or culinary conversion yield is established."
            )
        sr = fn.source_record
        if sr and sr.raw_payload:
            try:
                payload = json.loads(sr.raw_payload)
                prep_audit = payload.get("preparation_state_audit", {})
                if prep_audit.get("has_state_mismatch") is True:
                    audit_note = prep_audit.get("audit_note") or "Preparation state mismatch in source provenance."
                    return (
                        f"Excluded: Preparation state mismatch in source provenance ({audit_note}). "
                        "Marked unavailable for recommendations until verified sprouted/thermal nutrient profile "
                        "or culinary conversion yield is established."
                    )
            except (ValueError, TypeError):
                pass

    return None


def get_food_source_provenance(
    session: Session,
    source_record_ids: List[str],
) -> List[Dict[str, Any]]:
    """Retrieves source record provenance and licensing information for food nutrients."""
    if not source_record_ids:
        return []

    records = (
        session.query(SourceRecord)
        .join(DataSource, SourceRecord.source_id == DataSource.id)
        .filter(SourceRecord.id.in_(source_record_ids))
        .all()
    )

    provenance_list: List[Dict[str, Any]] = []
    for rec in records:
        ds = rec.data_source
        ds_name = ds.name if ds else "Unknown"
        is_ifct = bool(ds and "IFCT" in ds.name)
        is_off = bool(ds and "Open Food Facts" in ds.name)

        provenance_list.append({
            "source_record_id": rec.id,
            "external_id": rec.external_id,
            "external_name": rec.external_name,
            "data_source_name": ds_name,
            "publisher": ds.publisher if ds else "Unknown",
            "license": ds.license if ds else "Unknown",
            "license_url": ds.license_url if ds else None,
            "retrieval_date": rec.retrieval_date.isoformat() if rec.retrieval_date else None,
            "analytical_basis": "Laboratory analytical chemistry per 100g edible portion (raw agricultural matrix)" if is_ifct else "Product packaging label declaration",
            "scholarly_citation": (
                "Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). Indian Food Composition Tables. "
                "National Institute of Nutrition, Indian Council of Medical Research, Department of Health Research, "
                "Ministry of Health and Family Welfare, Government of India, Hyderabad."
                if is_ifct
                else (
                    "Open Food Facts Association (Paris, France). Crowdsourced packaged product database."
                    if is_off
                    else None
                )
            ),
            "copyright_notice": (
                "© 2017 National Institute of Nutrition (ICMR). All rights reserved."
                if is_ifct
                else (ds.license if ds else "Unknown")
            ),
        })

    return provenance_list


def compute_food_completeness(nutrients_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates data completeness metrics across tracked canonical nutrients.

    Never coerces unknown nutrients to zero.
    """
    total = len(nutrients_dict)
    if total == 0:
        return {
            "total_tracked": 0,
            "known_count": 0,
            "unknown_count": 0,
            "completeness_ratio": 0.0,
        }

    known_count = sum(1 for n in nutrients_dict.values() if not n.get("is_unknown", False) and n.get("amount") is not None)
    unknown_count = total - known_count
    ratio = round(known_count / total, 3)

    return {
        "total_tracked": total,
        "known_count": known_count,
        "unknown_count": unknown_count,
        "completeness_ratio": ratio,
    }


def generate_recommendations(
    session: Session,
    target_nutrient: str,
    target_estimate: Dict[str, Any],
    user_allergies: Optional[str] = None,
    limit: int = 5,
    portion_override_g: Optional[float] = None,
    strict_verified: bool = True,
    food_state: str = "raw",
    conversion_yield_factor: Optional[float] = None,
    stale_target_warning: bool = False,
    retired_version_warning: bool = False,
) -> Dict[str, Any]:
    """Generates deterministic, traceable food recommendations for a specific nutrient target.

    Ranking Rules:
    1. Primary: Target contribution percentage (contribution_amount / user_target * 100), descending.
    2. Secondary: Nutrient density per 100 kcal (contribution_amount / portion_kcal * 100), descending.
    3. Tertiary: Food name alphabetical order (case-insensitive), ascending.

    Integrity Guarantees:
    - Never converts unknown or missing nutrients to 0.0. Foods missing the target nutrient are excluded.
    - Excludes unverified foods in strict mode.
    - Excludes foods conflicting with user-declared allergies.
    - Clearly distinguishes portion contribution from remaining daily target.
    - Attaches full provenance, measurement basis, and clinical disclaimers.
    """
    if limit <= 0 or limit > 50:
        limit = 5

    if portion_override_g is not None:
        if (
            not isinstance(portion_override_g, (int, float))
            or math.isnan(portion_override_g)
            or math.isinf(portion_override_g)
            or portion_override_g <= 0
            or portion_override_g > 2000.0
        ):
            raise InvalidPortionError(
                f"Invalid portion_override_g '{portion_override_g}'. Must be a positive finite number between 1g and 2000g."
            )

    user_target, unit, canonical_code, ref_source = extract_target_value_from_estimate(
        target_estimate, target_nutrient
    )

    # Warnings collection
    warnings: List[str] = []
    if stale_target_warning:
        warnings.append(
            "Target freshness notice: Stored profile targets differ from current engine calculation. "
            "Recommendations are evaluated against your freshly calculated metabolic requirements, "
            "but saving updated targets is recommended."
        )
    if retired_version_warning:
        warnings.append(
            "Notice: Stored profile references a retired or legacy calculation formula. "
            "Evaluated using current default Mifflin-St Jeor (1990) baseline."
        )

    # Query all active foods
    active_foods = session.query(Food).filter(Food.active.is_(True)).all()

    candidates: List[Dict[str, Any]] = []
    excluded_candidates: List[Dict[str, Any]] = []

    calc_mode = CalculationMode.STRICT_VERIFIED if strict_verified else CalculationMode.STANDARD

    for food in active_foods:
        # 1. Allergen Check
        allergen_match = check_food_allergen_conflict(food, user_allergies)
        if allergen_match:
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": f"Excluded due to conflict with declared allergy '{allergen_match}'.",
            })
            continue

        # 2. Preparation State Integrity Check:
        # Exclude foods whose explicit data fields flag a preparation state mismatch (e.g. sprouted or thermal
        # state not substantiated by the raw agricultural IFCT source record), until an empirical conversion factor is established.
        prep_mismatch_reason = check_food_preparation_state_mismatch(food, session)
        if prep_mismatch_reason:
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": prep_mismatch_reason,
            })
            continue

        # 2. Determine Portion Mass and Documented Serving vs Normalized 100g Fallback
        if portion_override_g is not None:
            portion_g = float(portion_override_g)
            portion_type = "explicit_override"
            is_standardized_100g_fallback = False
            portion_basis_note = f"Explicit comparison portion override: {portion_g:.1f} g."
        else:
            resolved_g, note = resolve_serving_size_to_grams(food)
            if resolved_g is not None and resolved_g > 0:
                portion_g = resolved_g
                portion_type = "documented_serving"
                is_standardized_100g_fallback = False
                portion_basis_note = note or f"Documented serving size: {portion_g:.1f} g."
            else:
                portion_g = 100.0
                portion_type = "standardized_comparison_100g"
                is_standardized_100g_fallback = True
                portion_basis_note = (
                    "Standardized 100.0 g edible comparison portion used because this food lacks an unambiguous "
                    "mass-based serving size. This 100 g portion is a normalized reference baseline, not a verified typical serving size."
                )

        # 3. Calculate Portion Nutrients via Nutrition Engine
        try:
            portion_calc = calculate_food_portion_nutrients(
                food=food,
                mass_g=portion_g,
                session=session,
                mode=calc_mode,
                food_state=food_state,
                conversion_yield_factor=conversion_yield_factor,
            )
        except Exception as exc:
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": f"Portion calculation error: {exc}",
            })
            continue

        nutrients_map = portion_calc.get("nutrients", {})
        target_nut_info = nutrients_map.get(canonical_code)

        # 4. Handle Missing / Unknown Target Nutrient
        if not target_nut_info:
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": f"Nutrient '{canonical_code}' is missing from food records. (Missing values are never treated as zero).",
            })
            continue

        if target_nut_info.get("is_unknown", False) or target_nut_info.get("amount") is None:
            unknown_reason = target_nut_info.get("unknown_reason") or "Nutrient value is unanalyzed or unverified."
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": f"Nutrient '{canonical_code}' is unknown: {unknown_reason}",
            })
            continue

        amount = float(target_nut_info["amount"])
        if amount <= 0.0:
            excluded_candidates.append({
                "food_id": food.id,
                "food_name": food.name,
                "reason": f"Zero or negligible contribution of '{canonical_code}' ({amount} {unit}).",
            })
            continue

        # 5. Extract Portion Energy for Density Calculation
        energy_nut_info = nutrients_map.get("ENERC_KCAL")
        portion_energy_kcal: Optional[float] = None
        if energy_nut_info and not energy_nut_info.get("is_unknown") and energy_nut_info.get("amount") is not None:
            portion_energy_kcal = float(energy_nut_info["amount"])

        # Nutrient density calculation with compatible units:
        # - For energy (kcal): density is kcal per 100g portion mass
        # - For macronutrients (grams): density is grams per 100 kcal food energy
        is_energy_target = target_nutrient.lower() in ("energy", "calories")
        nutrient_density: Optional[float] = None
        density_label: Optional[str] = None

        if is_energy_target:
            if portion_g > 0:
                nutrient_density = round((amount / portion_g) * 100.0, 1)
                density_label = "kcal / 100g portion mass"
        else:
            if portion_energy_kcal is not None and portion_energy_kcal > 0:
                nutrient_density = round((amount / portion_energy_kcal) * 100.0, 2)
                density_label = f"g {target_nut_info['name']} / 100 kcal energy"

        # Target contribution percentage and uncovered target difference
        contribution_pct = round((amount / user_target) * 100.0, 1)
        uncovered_target_difference = max(0.0, round(user_target - amount, 1))

        # Provenance
        source_record_ids = portion_calc.get("source_record_ids", [])
        provenance = get_food_source_provenance(session, source_record_ids)
        completeness = compute_food_completeness(nutrients_map)

        # Objective, non-prescriptive explanation
        portion_label = "100 g comparison portion" if is_standardized_100g_fallback else f"{portion_g:.0f} g portion"
        if uncovered_target_difference > 0:
            target_context = (
                f"uncovered daily target balance is {uncovered_target_difference:.1f} {unit} "
                "(does not account for other daily meals; no single food is expected to meet 100% of daily intake)"
            )
        else:
            target_context = (
                f"exceeds the 24-hour target reference by {abs(round(user_target - amount, 1)):.1f} {unit} "
                "if consumed entirely in this single portion"
            )

        density_snippet = f" Nutrient density: {nutrient_density:.2f} {density_label}." if nutrient_density is not None else ""
        explanation = (
            f"A {portion_label} provides {amount:.1f} {unit} of {target_nut_info['name']}, "
            f"corresponding to {contribution_pct:.1f}% of your daily {user_target:.1f} {unit} target; {target_context}.{density_snippet}"
        )

        candidates.append({
            "food_id": food.id,
            "food_name": food.name,
            "category": food.category,
            "emoji": food.emoji or "🥗",
            "price_paise": food.price_paise,
            "portion": {
                "mass_g": round(portion_g, 1),
                "food_state": food_state,
                "portion_type": portion_type,
                "is_standardized_100g_fallback": is_standardized_100g_fallback,
                "serving_size_catalog_raw": food.serving_size,
                "basis": "per_100g_edible" if portion_g == 100.0 else "specified_portion",
                "basis_notes": portion_basis_note,
                "edible_weight_assumption": "100% edible portion basis (excludes non-edible kitchen refuse like peels, pits, or bones).",
            },
            "nutrient_contribution": {
                "target_nutrient": target_nutrient.lower(),
                "canonical_code": canonical_code,
                "nutrient_name": target_nut_info["name"],
                "amount": round(amount, 2),
                "unit": unit,
                "user_target": round(user_target, 1),
                "target_contribution_pct": contribution_pct,
                "remaining_target": uncovered_target_difference,
                "uncovered_target_difference": uncovered_target_difference,
                "portion_energy_kcal": round(portion_energy_kcal, 1) if portion_energy_kcal is not None else None,
                "nutrient_density": nutrient_density,
                "nutrient_density_per_100kcal": nutrient_density if not is_energy_target else None,
                "density_label": density_label,
                "verification_status": target_nut_info.get("verification_status", VerificationStatus.pending_review.value),
            },
            "explanation": explanation,
            "source_provenance": provenance,
            "data_completeness": completeness,
        })

    # 6. Deterministic Sorting:
    # 1. contribution_pct descending (-c["nutrient_contribution"]["target_contribution_pct"])
    # 2. nutrient_density descending (-c["nutrient_contribution"]["nutrient_density"] or -1.0)
    # 3. food_name ascending (alphabetical tie-breaker)
    def sort_key(c: Dict[str, Any]) -> Tuple[float, float, str]:
        pct = -float(c["nutrient_contribution"]["target_contribution_pct"])
        density = c["nutrient_contribution"]["nutrient_density"]
        dens_val = -float(density) if (density is not None and not math.isnan(density) and not math.isinf(density)) else 1e9
        name = c["food_name"].lower()
        return (pct, dens_val, name)

    candidates.sort(key=sort_key)
    recommended = candidates[:limit]

    # Additional contextual warning if strict mode yielded 0 candidates
    if len(recommended) == 0:
        warnings.append(
            f"No foods in the database currently meet all strict verification, allergen, and portion criteria for nutrient '{target_nutrient}'. "
            "Nutriverse never invents unverified food composition records or synthetic nutrient contributions."
        )

    return {
        "engine_version": RECOMMENDATION_ENGINE_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "target_nutrient": {
            "query_key": target_nutrient.lower(),
            "canonical_code": canonical_code,
            "name": SUPPORTED_RECOMMENDATION_NUTRIENTS[target_nutrient.lower()]["name"],
            "unit": unit,
            "user_target": round(user_target, 1),
            "reference_standard": ref_source,
        },
        "query_parameters": {
            "limit": limit,
            "portion_override_g": portion_override_g,
            "strict_verified": strict_verified,
            "food_state": food_state,
            "declared_allergies": user_allergies or "None declared",
        },
        "counts": {
            "total_active_foods_evaluated": len(active_foods),
            "eligible_candidates_found": len(candidates),
            "recommendations_returned": len(recommended),
            "excluded_count": len(excluded_candidates),
        },
        "ranking_semantics": {
            "primary_criterion": "Target contribution percentage (portion nutrient amount / daily target * 100), descending.",
            "secondary_criterion": "Nutrient density (grams per 100 kcal energy for macronutrients; kcal per 100g mass for energy), descending.",
            "tertiary_criterion": "Alphabetical food name (case-insensitive), ascending tie-breaker.",
            "disclaimer": "This deterministic ranking is an objective nutritional portion comparison against your personal target. It is not an algorithmic health score and does not imply that the top result is universally superior or required for your diet.",
        },
        "target_comparison_disclosure": (
            "Nutriverse recommendations evaluate individual food portions against your 24-hour metabolic targets. "
            "They do not track meal consumption, treat contributions as remaining requirements, or claim that any "
            "single food closes a dietary gap. A varied intake of diverse whole foods is required for balanced nutrition."
        ),
        "recommendations": recommended,
        "excluded_candidates_summary": excluded_candidates[:10],
        "excluded_candidates": excluded_candidates,
        "warnings": warnings,
        "disclaimer": CLINICAL_DISCLAIMER,
    }

