"""Nutriverse — Deterministic Nutrition Calculation Engine.

Provides mathematically rigorous, transparent, and reproducible nutrition calculations:
- Explicit per-100-g scaling: nutrient_amount = nutrient_per_100g * ingredient_mass_g / 100.
- Explicit mass conversions with verified conversion factors.
- Strict volume handling: requires explicit food density (g/ml) or verified aqueous liquid context;
  arbitrary universal 1.0 g/ml density assumptions for solids/oils are strictly prohibited.
- Explicit serving size handling: unambiguously parses mass in grams from food.serving_size;
  silent fallback to 100g on ambiguous serving strings is strictly prohibited.
- Non-finite numeric rejection: NaN, +inf, -inf, and negative values raise IncompatibleUnitError.
- Food-state integrity: never presents raw nutrition values as cooked without a validated conversion yield.
- Nutrient-specific independent completeness: unknown vitamins do not invalidate known calories.
- Rigorous distinction between documented zero (0.0) and unknown/missing (None).
- Strict verification mode: unverified, source-reported, and legacy catalog data never contribute to strict totals.
- Full provenance: version, formula, timestamps, assumptions, and source record IDs.
- Recipe ingredient scaling and per-serving division with mathematical consistency.
"""

from __future__ import annotations

import json
import logging
import math
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

try:
    from backend.app.main import (
        Food,
        FoodNutrient,
        Nutrient,
        Recipe,
        RecipeIngredient,
        SourceRecord,
        VerificationStatus,
    )
except ImportError:
    from app.main import (
        Food,
        FoodNutrient,
        Nutrient,
        Recipe,
        RecipeIngredient,
        SourceRecord,
        VerificationStatus,
    )

logger = logging.getLogger("nutriverse.nutrition_engine")

CALCULATION_VERSION = "nutriverse-calc-v1"
CALCULATION_FORMULA = "nutrient_amount = nutrient_per_100g * ingredient_mass_g / 100"

# Supported mass units with conversion factors to grams (g)
SUPPORTED_MASS_UNITS: Dict[str, float] = {
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "mg": 0.001,
    "milligram": 0.001,
    "milligrams": 0.001,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "kilograms": 1000.0,
    "oz": 28.349523125,
    "ounce": 28.349523125,
    "ounces": 28.349523125,
    "lb": 453.59237,
    "pound": 453.59237,
    "pounds": 453.59237,
}

# Supported volume units (requires explicit density factor)
SUPPORTED_VOLUME_UNITS: Dict[str, float] = {
    "ml": 1.0,
    "milliliter": 1.0,
    "milliliters": 1.0,
    "l": 1000.0,
    "liter": 1000.0,
    "liters": 1000.0,
}

# Recognised aqueous liquid categories/names where water-equivalent density (1.0 g/ml) is physically valid
AQUEOUS_LIQUID_INDICATORS = {
    "beverage", "beverages", "drink", "drinks", "water", "juice", "tea", "coffee", "infusion"
}


class CalculationMode(str, Enum):
    STRICT_VERIFIED = "strict_verified"
    STANDARD = "standard"


class NutritionCalculationError(Exception):
    """Base exception for nutrition calculation failures."""
    pass


class IncompatibleUnitError(NutritionCalculationError):
    """Raised when an ingredient specifies an unsupported, non-finite, or ambiguous unit."""
    pass


class IncompatibleFoodStateError(NutritionCalculationError):
    """Raised when food state and nutrient basis are physically incompatible."""
    pass


def parse_gram_weight_from_text(text: str) -> Optional[float]:
    """Extracts numeric gram weight from strings like '100g', '250 g', '0.5 kg'.

    Returns None if text does not unambiguously specify a mass in grams or kilograms.
    Rejects ambiguous counts or descriptive text like '1 bowl', '1 bunch', 'medium'.
    """
    if not text:
        return None
    cleaned = text.strip().lower()

    # Match kg first
    kg_match = re.search(r"^([\d\.]+)\s*(?:kg|kilogram|kilograms)$", cleaned)
    if kg_match:
        try:
            val = float(kg_match.group(1))
            if val > 0 and math.isfinite(val):
                return val * 1000.0
        except ValueError:
            pass

    # Match g (must be exact quantity + unit, not arbitrary strings)
    g_match = re.search(r"^([\d\.]+)\s*(?:g|gram|grams)$", cleaned)
    if g_match:
        try:
            val = float(g_match.group(1))
            if val > 0 and math.isfinite(val):
                return val
        except ValueError:
            pass

    # Match leading quantity + unit with pack descriptor (e.g. '100g pack', '250 g bunch')
    leading_match = re.search(r"^([\d\.]+)\s*(?:g|gram|grams)\b", cleaned)
    if leading_match:
        try:
            val = float(leading_match.group(1))
            if val > 0 and math.isfinite(val):
                return val
        except ValueError:
            pass

    leading_kg_match = re.search(r"^([\d\.]+)\s*(?:kg|kilogram|kilograms)\b", cleaned)
    if leading_kg_match:
        try:
            val = float(leading_kg_match.group(1))
            if val > 0 and math.isfinite(val):
                return val * 1000.0
        except ValueError:
            pass

    return None


# Documented empirical food densities (g/ml) grounded in standard food composition references
DOCUMENTED_FOOD_DENSITIES: Dict[str, float] = {
    "oil": 0.92,
    "ghee": 0.93,
    "butter": 0.91,
    "syrup": 1.33,
    "honey": 1.42,
    "vinegar": 1.01,
}


def get_documented_food_density(food: Optional[Food]) -> Optional[float]:
    """Retrieves documented empirical density for recognized food types."""
    if not food:
        return None
    name_lower = (food.name or "").lower()
    cat_lower = (food.category or "").lower()
    for kw, density in DOCUMENTED_FOOD_DENSITIES.items():
        if kw in name_lower or kw in cat_lower:
            return density
    return None


def resolve_serving_size_to_grams(food: Optional[Food]) -> Tuple[Optional[float], Optional[str]]:
    """Resolves food.serving_size into grams if unambiguous mass or documented volume."""
    if not food or not food.serving_size:
        return None, None
    text = food.serving_size.strip().lower()

    # 1. Direct mass match (e.g. '100g', '30g', '0.5 kg')
    direct_mass = parse_gram_weight_from_text(text)
    if direct_mass is not None:
        return direct_mass, f"Resolved 1 serving = {direct_mass}g based on unambiguous serving_size '{food.serving_size}'."

    # 2. Volume in serving_size (e.g. '15ml', '250 ml')
    vol_match = re.search(r"^([\d\.]+)\s*(?:ml|milliliter|milliliters)\b", text)
    if vol_match:
        try:
            vol_ml = float(vol_match.group(1))
            if vol_ml > 0 and math.isfinite(vol_ml):
                if is_aqueous_food(food):
                    return vol_ml * 1.0, f"Resolved 1 serving = {vol_ml}g using aqueous density for '{food.serving_size}'."
                density = get_documented_food_density(food)
                if density is not None:
                    calc_g = round(vol_ml * density, 2)
                    return calc_g, f"Resolved 1 serving = {calc_g}g for '{food.name}' using documented food density {density} g/ml on '{food.serving_size}'."
        except ValueError:
            pass

    return None, None


def is_aqueous_food(food: Optional[Food]) -> bool:
    """Checks whether a food entity is documented as an aqueous liquid with 1.0 g/ml density."""
    if not food:
        return False
    name_lower = (food.name or "").lower()
    cat_lower = (food.category or "").lower()
    return any(ind in name_lower or ind in cat_lower for ind in AQUEOUS_LIQUID_INDICATORS)


def convert_quantity_to_grams(
    quantity: float,
    unit: str,
    food: Optional[Food] = None,
    density_g_ml: Optional[float] = None,
) -> Tuple[float, List[str]]:
    """Converts ingredient quantity and unit into mass in grams.

    Requirements enforced:
    - Rejects NaN, +inf, -inf, and negative numbers with IncompatibleUnitError.
    - Uses exact mass factors for g, mg, kg, oz, lb.
    - Requires explicit density_g_ml for volume units (ml, l) unless food is verified aqueous liquid.
    - Resolves 'serving' strictly against food.serving_size if unambiguous.
    - Does NOT silently replace ambiguous servings with 100g.
    - Rejects ambiguous measures ('cup', 'piece', 'pinch', 'handful') without food-specific weights.
    """
    # 1. Finite numeric validation
    if not isinstance(quantity, (int, float)) or math.isnan(quantity) or math.isinf(quantity):
        raise IncompatibleUnitError(f"Quantity must be a finite positive number (got {quantity}).")
    if quantity < 0:
        raise IncompatibleUnitError(f"Quantity cannot be negative ({quantity}).")

    clean_unit = unit.strip().lower()
    assumptions: List[str] = []

    # 2. Direct Mass Units
    if clean_unit in SUPPORTED_MASS_UNITS:
        mass_g = quantity * SUPPORTED_MASS_UNITS[clean_unit]
        return mass_g, assumptions

    # 3. Volume Units
    if clean_unit in SUPPORTED_VOLUME_UNITS:
        vol_ml = quantity * SUPPORTED_VOLUME_UNITS[clean_unit]

        # Case A: Explicit density provided
        if density_g_ml is not None:
            if not isinstance(density_g_ml, (int, float)) or math.isnan(density_g_ml) or math.isinf(density_g_ml) or density_g_ml <= 0:
                raise IncompatibleUnitError(f"Density must be a positive finite number in g/ml (got {density_g_ml}).")
            mass_g = vol_ml * float(density_g_ml)
            assumptions.append(
                f"Converted volume '{quantity} {unit}' to mass using explicit density {density_g_ml} g/ml."
            )
            return mass_g, assumptions

        # Case B: Verified aqueous liquid
        if is_aqueous_food(food):
            mass_g = vol_ml * 1.0
            assumptions.append(
                f"Assumed 1.0 g/ml aqueous density for liquid beverage food '{food.name if food else 'Beverage'}'. "
            )
            return mass_g, assumptions

        # Case C: Documented food-specific density (e.g. edible culinary oils / ghee)
        food_density = get_documented_food_density(food)
        if food_density is not None:
            mass_g = vol_ml * food_density
            assumptions.append(
                f"Converted volume '{quantity} {unit}' for '{food.name}' using documented food-specific density {food_density} g/ml."
            )
            return mass_g, assumptions

        # Case D: Rejection of universal density assumption
        raise IncompatibleUnitError(
            f"Volume unit '{unit}' cannot be converted to mass for food '{food.name if food else 'Unknown'}' "
            "without an explicit density factor (g/ml). Nutriverse engine does not assume universal 1 g/ml density "
            "for non-aqueous foods, oils, or solids. Please specify mass (g, kg, oz, lb) or provide 'density_g_ml'."
        )

    # 4. Serving Units (strictly resolved against food.serving_size)
    if clean_unit in ("serving", "servings"):
        if food and food.serving_size:
            parsed_g, serving_note = resolve_serving_size_to_grams(food)
            if parsed_g is not None and parsed_g > 0:
                mass_g = quantity * parsed_g
                if serving_note:
                    assumptions.append(serving_note)
                return mass_g, assumptions

        # Ambiguous or missing serving size: Strictly reject rather than silently defaulting to 100g
        food_desc = food.name if food else "Unknown"
        serving_desc = food.serving_size if (food and food.serving_size) else "not specified"
        raise IncompatibleUnitError(
            f"Cannot resolve unit '{unit}' for food '{food_desc}': serving size is {serving_desc} and "
            "does not define an unambiguous gram weight. Nutriverse engine does not silently substitute "
            "arbitrary 100g defaults for ambiguous serving strings. Please specify mass in grams."
        )

    # 5. Package Units (strictly resolved against food.unit)
    if clean_unit in ("pack", "package", "bag", "container"):
        if food and food.unit:
            parsed_g = parse_gram_weight_from_text(food.unit)
            if parsed_g is not None and parsed_g > 0:
                mass_g = quantity * parsed_g
                assumptions.append(
                    f"Resolved 1 pack = {parsed_g}g based on unambiguous package unit '{food.unit}'."
                )
                return mass_g, assumptions

        food_desc = food.name if food else "Unknown"
        pack_desc = food.unit if (food and food.unit) else "not specified"
        raise IncompatibleUnitError(
            f"Cannot resolve package unit '{unit}' for food '{food_desc}': package size is {pack_desc} and does not define an unambiguous mass."
        )

    # 5. Unsupported or ambiguous household measures
    raise IncompatibleUnitError(
        f"Unsupported or ambiguous unit '{unit}'. Nutriverse engine does not assume "
        "universal cup, piece, pinch, or handful gram weights without an explicit food reference. "
        "Supported units: g, mg, kg, oz, lb, ml/l (with density), or unambiguous food-defined 'serving'."
    )


def calculate_food_portion_nutrients(
    food: Food,
    mass_g: float,
    session: Session,
    mode: CalculationMode = CalculationMode.STANDARD,
    food_state: str = "raw",
    conversion_yield_factor: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculates all nutrients for a given food and mass in grams.

    Enforces food-state integrity:
    - Never presents raw nutrition values as valid cooked nutrition values without a validated conversion factor.
    - If food_state differs from source basis and no conversion yield is provided, marks the nutrient as unavailable.
    - In STRICT_VERIFIED mode, excludes non-reference and legacy unverified values.
    """
    scale_factor = mass_g / 100.0
    assumptions: List[str] = []

    # Query relational FoodNutrient rows
    relational_nutrients = (
        session.query(FoodNutrient)
        .join(Nutrient, FoodNutrient.nutrient_id == Nutrient.id)
        .filter(FoodNutrient.food_id == food.id)
        .all()
    )

    nutrient_results: Dict[str, Dict[str, Any]] = {}
    source_record_ids: Set[str] = set()

    if relational_nutrients:
        for fn in relational_nutrients:
            nutrient = fn.nutrient
            code = nutrient.canonical_code

            # Check verification mode compatibility
            if mode == CalculationMode.STRICT_VERIFIED:
                if fn.verification_status != VerificationStatus.verified_reference.value:
                    nutrient_results[code] = {
                        "name": nutrient.name,
                        "canonical_code": code,
                        "amount": None,
                        "unit": fn.unit,
                        "is_unknown": True,
                        "unknown_reason": f"Excluded: verification status '{fn.verification_status}' does not meet strict verified threshold.",
                        "verification_status": fn.verification_status,
                        "source_record_id": fn.source_record_id,
                    }
                    continue

            # Food-state integrity validation
            if fn.food_state != food_state:
                if conversion_yield_factor is not None and conversion_yield_factor > 0:
                    effective_scale = scale_factor * float(conversion_yield_factor)
                    state_conv_note = f"Converted nutrient '{code}' from '{fn.food_state}' to '{food_state}' using explicit yield factor {conversion_yield_factor}."
                    if state_conv_note not in assumptions:
                        assumptions.append(state_conv_note)
                else:
                    # Mismatch without conversion yield: strictly mark unavailable
                    state_mismatch_note = (
                        f"Requested food state '{food_state}' differs from source state '{fn.food_state}' for food '{food.name}'; "
                        "nutrition marked unavailable due to absence of verified cooking yield conversion."
                    )
                    if state_mismatch_note not in assumptions:
                        assumptions.append(state_mismatch_note)
                    nutrient_results[code] = {
                        "name": nutrient.name,
                        "canonical_code": code,
                        "amount": None,
                        "unit": fn.unit,
                        "is_unknown": True,
                        "unknown_reason": (
                            f"Incompatible food state: source data basis is '{fn.food_state}', but requested state is '{food_state}' "
                            "without an explicit, validated cooking conversion yield factor. Raw nutrition cannot be presented as cooked."
                        ),
                        "verification_status": fn.verification_status,
                        "source_record_id": fn.source_record_id,
                    }
                    continue
            else:
                effective_scale = scale_factor

            # Preserve explicit NULL / Unknown
            if fn.is_unknown or fn.value is None:
                nutrient_results[code] = {
                    "name": nutrient.name,
                    "canonical_code": code,
                    "amount": None,
                    "unit": fn.unit,
                    "is_unknown": True,
                    "unknown_reason": fn.unknown_reason or "Below detectable limit or unanalyzed in source table",
                    "verification_status": fn.verification_status,
                    "source_record_id": fn.source_record_id,
                }
            else:
                scaled_amount = round(fn.value * effective_scale, 4)
                nutrient_results[code] = {
                    "name": nutrient.name,
                    "canonical_code": code,
                    "amount": scaled_amount,
                    "unit": fn.unit,
                    "is_unknown": False,
                    "unknown_reason": None,
                    "verification_status": fn.verification_status,
                    "source_record_id": fn.source_record_id,
                }
                if fn.source_record_id:
                    source_record_ids.add(fn.source_record_id)
    else:
        # Fallback to legacy flat columns with explicit documentation
        legacy_macros = [
            ("ENERC_KCAL", "Energy (kcal)", "kcal", food.calories),
            ("PROTCNT", "Protein", "g", food.protein_g),
            ("CHOAVLDF", "Carbohydrates, available", "g", food.carbs_g),
            ("FATCE", "Total Fat", "g", food.fat_g),
            ("FIBTG", "Total Dietary Fibre", "g", food.fibre_g),
        ]

        if mode == CalculationMode.STRICT_VERIFIED:
            # Legacy unverified catalog foods MUST be excluded in strict mode
            for code, name, unit, _ in legacy_macros:
                nutrient_results[code] = {
                    "name": name,
                    "canonical_code": code,
                    "amount": None,
                    "unit": unit,
                    "is_unknown": True,
                    "unknown_reason": f"Excluded: food '{food.name}' lacks verified reference records (legacy catalog data is unverified).",
                    "verification_status": VerificationStatus.pending_review.value,
                    "source_record_id": None,
                }
        else:
            if food_state != "raw" and conversion_yield_factor is None:
                for code, name, unit, _ in legacy_macros:
                    nutrient_results[code] = {
                        "name": name,
                        "canonical_code": code,
                        "amount": None,
                        "unit": unit,
                        "is_unknown": True,
                        "unknown_reason": f"Incompatible food state: legacy catalog values pertain to raw basis; requested '{food_state}' without yield conversion.",
                        "verification_status": VerificationStatus.pending_review.value,
                        "source_record_id": None,
                    }
            else:
                effective_scale = scale_factor * (float(conversion_yield_factor) if conversion_yield_factor else 1.0)
                assumptions.append(
                    f"Food '{food.name}' lacks relational FoodNutrient records. Used legacy flat catalog values as unverified reference."
                )
                for code, name, unit, val in legacy_macros:
                    scaled_amount = round(val * effective_scale, 4)
                    nutrient_results[code] = {
                        "name": name,
                        "canonical_code": code,
                        "amount": scaled_amount,
                        "unit": unit,
                        "is_unknown": False,
                        "unknown_reason": None,
                        "verification_status": VerificationStatus.pending_review.value,
                        "source_record_id": None,
                    }

    return {
        "food_id": food.id,
        "food_name": food.name,
        "mass_g": round(mass_g, 2),
        "scale_factor": round(scale_factor, 4),
        "nutrients": nutrient_results,
        "source_record_ids": sorted(list(source_record_ids)),
        "assumptions": assumptions,
    }


def aggregate_combination_nutrients(
    contributions: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Aggregates multiple food nutrient contributions deterministically.

    Requirements:
    - Never converts None to zero.
    - Evaluates each nutrient independently: missing vitamin data does NOT invalidate known calories.
    - Distinguishes complete totals from partial sums.
    - Explicitly flags partial results with unknown contributors and reasons.
    - Accurately tracks completeness ratios (known_contributors / total_contributors).
    """
    aggregated: Dict[str, Dict[str, Any]] = {}

    for contrib in contributions:
        nutrients = contrib.get("nutrients", {})
        food_name = contrib.get("food_name", "Unknown")
        food_id = contrib.get("food_id", "")

        for code, nut_data in nutrients.items():
            if code not in aggregated:
                aggregated[code] = {
                    "name": nut_data["name"],
                    "canonical_code": code,
                    "amount": 0.0,
                    "unit": nut_data["unit"],
                    "is_complete": True,
                    "known_contributors_count": 0,
                    "total_contributors_count": 0,
                    "unknown_contributors": [],
                    "verification_statuses": set(),
                    "source_record_ids": set(),
                }

            agg = aggregated[code]
            agg["total_contributors_count"] += 1
            if nut_data.get("source_record_id"):
                agg["source_record_ids"].add(nut_data["source_record_id"])
            agg["verification_statuses"].add(nut_data.get("verification_status", "pending_review"))

            if nut_data.get("is_unknown") or nut_data.get("amount") is None:
                agg["is_complete"] = False
                agg["unknown_contributors"].append({
                    "food_id": food_id,
                    "food_name": food_name,
                    "reason": nut_data.get("unknown_reason") or "Missing or unknown nutrient value",
                })
            else:
                agg["amount"] += nut_data["amount"]
                agg["known_contributors_count"] += 1

    # Finalize totals per nutrient
    results: Dict[str, Dict[str, Any]] = {}
    for code, agg in aggregated.items():
        v_statuses = agg["verification_statuses"]
        if v_statuses == {VerificationStatus.verified_reference.value}:
            final_status = VerificationStatus.verified_reference.value
        elif VerificationStatus.rejected.value in v_statuses:
            final_status = VerificationStatus.rejected.value
        elif VerificationStatus.source_reported.value in v_statuses:
            final_status = VerificationStatus.source_reported.value
        elif VerificationStatus.label_derived.value in v_statuses:
            final_status = VerificationStatus.label_derived.value
        else:
            final_status = VerificationStatus.pending_review.value

        total_contribs = agg["total_contributors_count"]
        known_contribs = agg["known_contributors_count"]
        completeness_ratio = round(known_contribs / total_contribs, 4) if total_contribs > 0 else 0.0

        if known_contribs == total_contribs and total_contribs > 0:
            completeness_status = "complete"
            is_partial = False
            total_amount = round(agg["amount"], 4)
            partial_amount = None
        elif known_contribs > 0:
            completeness_status = "partial"
            is_partial = True
            total_amount = round(agg["amount"], 4)
            partial_amount = round(agg["amount"], 4)
        else:
            completeness_status = "unknown"
            is_partial = False
            total_amount = None
            partial_amount = None

        results[code] = {
            "name": agg["name"],
            "canonical_code": code,
            "total_amount": total_amount,
            "partial_amount": partial_amount,
            "unit": agg["unit"],
            "is_complete": agg["is_complete"],
            "is_partial": is_partial,
            "completeness_status": completeness_status,
            "completeness_ratio": completeness_ratio,
            "known_contributors_count": known_contribs,
            "total_contributors_count": total_contribs,
            "unknown_contributors": agg["unknown_contributors"],
            "verification_status": final_status,
            "source_record_ids": sorted(list(agg["source_record_ids"])),
        }

    return results


def calculate_combination_nutrition(
    items: List[Dict[str, Any]],
    session: Session,
    mode: str = "standard",
) -> Dict[str, Any]:
    """Calculates nutrition for a list of food items and quantities.

    Preserves existing API contracts while enforcing deterministic integrity:
    - Retains legacy response keys ('total_calories', 'total_protein_g', etc.).
    - Evaluates each nutrient independently.
    - Rejects invalid units, negative quantities, or non-finite numbers.
    - Documents explicit defaults when quantity is omitted.
    """
    if not items:
        raise NutritionCalculationError("Items list cannot be empty.")

    calc_mode = (
        CalculationMode.STRICT_VERIFIED
        if mode == "strict_verified"
        else CalculationMode.STANDARD
    )

    contributing_foods: List[Dict[str, Any]] = []
    item_contributions: List[Dict[str, Any]] = []
    all_assumptions: List[str] = []
    total_price_paise = 0
    contributing_nutrients_set: Set[str] = set()

    for item in items:
        food_id = item.get("food_id")
        if not food_id:
            continue
        food = session.get(Food, food_id)
        if not food:
            continue

        raw_qty_input = item.get("quantity")
        if raw_qty_input is None:
            raw_qty = 1.0
            all_assumptions.append(f"Omitted quantity for food '{food.name}' defaulted to 1.0.")
        else:
            try:
                raw_qty = float(raw_qty_input)
            except (ValueError, TypeError) as exc:
                raise IncompatibleUnitError(f"Quantity must be a valid number (got {raw_qty_input}).") from exc

        unit = item.get("unit", "serving")
        food_state = item.get("food_state", "raw")
        density_g_ml = item.get("density_g_ml") or item.get("density")
        if density_g_ml is not None:
            try:
                density_g_ml = float(density_g_ml)
            except (ValueError, TypeError) as exc:
                raise IncompatibleUnitError(f"Density must be a valid number in g/ml (got {density_g_ml}).") from exc

        conversion_yield_factor = item.get("conversion_yield_factor")
        if conversion_yield_factor is not None:
            try:
                conversion_yield_factor = float(conversion_yield_factor)
            except (ValueError, TypeError) as exc:
                raise IncompatibleUnitError(f"Yield factor must be a valid number (got {conversion_yield_factor}).") from exc

        mass_g, assumptions = convert_quantity_to_grams(
            quantity=raw_qty,
            unit=unit,
            food=food,
            density_g_ml=density_g_ml,
        )
        all_assumptions.extend(assumptions)

        portion = calculate_food_portion_nutrients(
            food=food,
            mass_g=mass_g,
            session=session,
            mode=calc_mode,
            food_state=food_state,
            conversion_yield_factor=conversion_yield_factor,
        )
        item_contributions.append(portion)
        all_assumptions.extend(portion["assumptions"])

        # Price calculation with Decimal round-half-up
        item_price_paise = int(
            (Decimal(str(food.price_paise)) * Decimal(str(raw_qty))).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        total_price_paise += item_price_paise

        # Tags
        tags = json.loads(food.nutrition_tags or "[]")
        for t in tags:
            contributing_nutrients_set.add(t)

        nut_dict = portion["nutrients"]
        cal_entry = nut_dict.get("ENERC_KCAL", {})
        prot_entry = nut_dict.get("PROTCNT", {})
        cal_val = cal_entry.get("amount")
        p_val = prot_entry.get("amount")

        contributing_foods.append({
            "food_id": food.id,
            "name": food.name,
            "quantity": raw_qty,
            "unit": unit,
            "mass_g": portion["mass_g"],
            "calories": cal_val if cal_val is not None else 0.0,
            "protein_g": p_val if p_val is not None else 0.0,
            "price_paise": item_price_paise,
            "nutrients": portion["nutrients"],
        })

    aggregated_nutrients = aggregate_combination_nutrients(item_contributions)

    # Legacy field mappings for 100% backward compatibility
    cal_obj = aggregated_nutrients.get("ENERC_KCAL", {})
    prot_obj = aggregated_nutrients.get("PROTCNT", {})
    carb_obj = aggregated_nutrients.get("CHOAVLDF", {})
    fat_obj = aggregated_nutrients.get("FATCE", {})
    fib_obj = aggregated_nutrients.get("FIBTG", {})

    cal_total = cal_obj.get("total_amount") or 0.0
    prot_total = prot_obj.get("total_amount") or 0.0
    carb_total = carb_obj.get("total_amount") or 0.0
    fat_total = fat_obj.get("total_amount") or 0.0
    fib_total = fib_obj.get("total_amount") or 0.0

    all_complete = all(n["is_complete"] for n in aggregated_nutrients.values())
    incomplete_nutrients = [
        k for k, v in aggregated_nutrients.items() if not v["is_complete"]
    ]

    all_source_records = set()
    for portion in item_contributions:
        all_source_records.update(portion.get("source_record_ids", []))

    provenance = {
        "calculation_version": CALCULATION_VERSION,
        "formula": CALCULATION_FORMULA,
        "calculation_mode": calc_mode.value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "assumptions": sorted(list(set(all_assumptions))),
        "source_record_ids": sorted(list(all_source_records)),
    }

    return {
        # Legacy backward-compatible fields
        "items": contributing_foods,
        "total_calories": round(cal_total, 1),
        "total_protein_g": round(prot_total, 1),
        "total_carbs_g": round(carb_total, 1),
        "total_fat_g": round(fat_total, 1),
        "total_fibre_g": round(fib_total, 1),
        "total_price_paise": total_price_paise,
        "contributing_nutrients": sorted(list(contributing_nutrients_set)),
        "disclaimer": "Calculated deterministically from whole-food nutritional reference sheets per 100g edible portion. Cooking and prep methods can influence final values.",

        # New Deterministic Nutrition Engine Fields
        "nutrients": aggregated_nutrients,
        "completeness": {
            "is_complete": all_complete,
            "incomplete_nutrients": incomplete_nutrients,
        },
        "provenance": provenance,
    }


def calculate_recipe_nutrition(
    recipe_id: str,
    session: Session,
    servings: Optional[int] = None,
    mode: str = "standard",
) -> Dict[str, Any]:
    """Calculates nutrition for a recipe using its ingredient components.

    Resolves relational RecipeIngredient rows where populated, or parses ingredients_json.
    Ensures mathematical consistency between total and per-serving amounts.
    Flags unresolved ingredients explicitly without guessing.
    """
    recipe = session.get(Recipe, recipe_id)
    if not recipe or not recipe.active:
        raise NutritionCalculationError(f"Recipe '{recipe_id}' not found or inactive.")

    effective_servings = servings or recipe.servings or 1
    if effective_servings <= 0:
        raise NutritionCalculationError("Servings must be a positive integer.")

    items_to_calculate: List[Dict[str, Any]] = []
    unresolved_ingredients: List[Dict[str, Any]] = []

    # 1. Try relational RecipeIngredient rows
    relational_ingredients = (
        session.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).all()
    )

    if relational_ingredients:
        for ri in relational_ingredients:
            items_to_calculate.append({
                "food_id": ri.food_id,
                "quantity": ri.quantity,
                "unit": ri.unit,
                "food_state": "raw",
            })
    else:
        # 2. Parse ingredients_json dynamically and resolve against foods table
        try:
            parsed_json = json.loads(recipe.ingredients_json or "[]")
        except Exception:
            parsed_json = []

        for ing in parsed_json:
            name = ing.get("name", "").strip()
            qty_str = str(ing.get("qty", 1)).strip()
            unit = ing.get("unit", "g").strip()

            try:
                qty_val = float(qty_str)
            except ValueError:
                qty_val = 1.0

            # Match food in catalog
            food = session.query(Food).filter(Food.name == name).first()
            if not food:
                food = session.query(Food).filter(Food.name.ilike(f"%{name}%")).first()

            if food:
                items_to_calculate.append({
                    "food_id": food.id,
                    "quantity": qty_val,
                    "unit": unit,
                    "food_state": "raw",
                })
            else:
                unresolved_ingredients.append({
                    "name": name,
                    "quantity": qty_val,
                    "unit": unit,
                    "reason": "Food item not found in catalog.",
                })

    if not items_to_calculate:
        return {
            "recipe_id": recipe.id,
            "recipe_name": recipe.name,
            "servings": effective_servings,
            "status": "incomplete",
            "error": "No resolvable ingredients found for recipe.",
            "unresolved_ingredients": unresolved_ingredients,
        }

    combo_result = calculate_combination_nutrition(
        items=items_to_calculate,
        session=session,
        mode=mode,
    )

    # Compute per-serving breakdown
    per_serving_nutrients: Dict[str, Dict[str, Any]] = {}
    for code, nut in combo_result["nutrients"].items():
        total_amt = nut["total_amount"]
        serving_amt = round(total_amt / effective_servings, 4) if total_amt is not None else None

        per_serving_nutrients[code] = {
            "name": nut["name"],
            "canonical_code": code,
            "amount": serving_amt,
            "unit": nut["unit"],
            "is_complete": nut["is_complete"],
            "is_partial": nut["is_partial"],
            "completeness_status": nut["completeness_status"],
            "verification_status": nut["verification_status"],
        }

    has_unresolved = len(unresolved_ingredients) > 0
    recipe_complete = combo_result["completeness"]["is_complete"] and not has_unresolved

    return {
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
        "servings": effective_servings,
        "total_recipe_nutrition": combo_result["nutrients"],
        "per_serving_nutrition": per_serving_nutrients,
        "total_calories": combo_result["total_calories"],
        "calories_per_serving": round(combo_result["total_calories"] / effective_servings, 1),
        "total_protein_g": combo_result["total_protein_g"],
        "protein_per_serving_g": round(combo_result["total_protein_g"] / effective_servings, 1),
        "total_carbs_g": combo_result["total_carbs_g"],
        "total_fat_g": combo_result["total_fat_g"],
        "total_fibre_g": combo_result["total_fibre_g"],
        "ingredients": combo_result["items"],
        "unresolved_ingredients": unresolved_ingredients,
        "completeness": {
            "is_complete": recipe_complete,
            "has_unresolved_ingredients": has_unresolved,
            "incomplete_nutrients": combo_result["completeness"]["incomplete_nutrients"],
        },
        "provenance": combo_result["provenance"],
    }
