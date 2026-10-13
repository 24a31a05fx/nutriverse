"""Nutriverse — Deterministic Personalized Nutrition Target Estimation Engine.

Phase 5.1 Hardened Implementation:
- Scientific, deterministic estimation of Basal Metabolic Rate (BMR), Total Daily
  Energy Expenditure (TDEE), and daily caloric/macronutrient targets.
- Uses documented, established reference equations:
  * Primary: Mifflin-St Jeor (1990) predictive equation for resting energy expenditure.
  * Secondary: ICMR-NIN (2020) Reference Equations for Indian reference adults (applying
    the authoritative -10% male / -9% female body-composition adjustment to Schofield baseline).
  * Tertiary: Schofield (1985) / FAO/WHO/UNU (1985) unadjusted weight-based BMR equations.
- Strict distinctions:
  * Baseline BMR vs. physical activity adjusted TDEE vs. goal-adjusted daily target.
  * Estimated energy expenditure vs. measured food nutrient composition.
  * Programmatic software guardrails vs. individualized clinical prescriptions.
  * Official dietary reference allowances vs. illustrative planning midpoints.
- Enforces programmatic software guardrails (1200 kcal/day for adult women, 1500 kcal/day for adult men)
  derived from general NIH/ACSM guidelines for unmonitored dietary plans, explicitly flagged as non-clinical floors.
- Strict input validation: unit normalization, plausible physiological ranges,
  rejection of non-finite numbers (NaN/Inf), negative values, and pediatric inputs (<18).
- Discloses complete calculation metadata, assumptions, applicable population, and clinical disclaimers.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union


class TargetEstimationError(Exception):
    """Base error for personalized nutrition target estimation."""
    pass


class TargetEstimationValidationError(TargetEstimationError):
    """Raised when an input value, unit, or combination is invalid, non-finite, or implausible."""
    pass


class TargetIneligiblePopulationError(TargetEstimationError):
    """Raised when demographic inputs fall outside the validated reference population (e.g. pediatric age)."""
    pass


class Sex(str, Enum):
    female = "female"
    male = "male"


class ActivityLevel(str, Enum):
    sedentary = "sedentary"               # PAL 1.20
    lightly_active = "lightly_active"     # PAL 1.375
    moderately_active = "moderately_active"  # PAL 1.55
    very_active = "very_active"           # PAL 1.725
    extra_active = "extra_active"         # PAL 1.90


class Goal(str, Enum):
    maintain = "maintain"                 # 0 kcal adjustment
    mild_weight_loss = "mild_weight_loss"  # -300 kcal/day (safe deficit ~0.3 kg/wk)
    weight_loss = "weight_loss"           # -500 kcal/day (moderate deficit ~0.5 kg/wk)
    mild_weight_gain = "mild_weight_gain"  # +300 kcal/day (gentle surplus)
    weight_gain = "weight_gain"           # +500 kcal/day (moderate surplus)


class EstimationMethod(str, Enum):
    mifflin_st_jeor = "mifflin_st_jeor"
    icmr_nin_2020 = "icmr_nin_2020"
    schofield_1985 = "schofield_1985"


# Physical Activity Level (PAL) Multipliers
# Reference: FAO/WHO/UNU Human Energy Requirements (2004)
ACTIVITY_PAL_MAP: Dict[str, Tuple[float, str]] = {
    "sedentary": (1.20, "Desk work, minimal movement, little or no structured exercise"),
    "lightly_active": (1.375, "Light exercise or recreational sports 1–3 days per week"),
    "moderately_active": (1.55, "Moderate physical exercise or sports 3–5 days per week"),
    "very_active": (1.725, "Hard physical training or demanding athletics 6–7 days per week"),
    "extra_active": (1.90, "Vigorous athletic training, heavy physical labor, or multiple daily sessions"),
}

# Goal Adjustments (kcal/day)
# Documented caloric adjustments based on standard energy balance principles
GOAL_ADJUSTMENT_MAP: Dict[str, Tuple[int, str]] = {
    "maintain": (0, "Maintain current body weight with balanced energy intake"),
    "mild_weight_loss": (-300, "Gradual, sustainable energy deficit (~0.3 kg/week rate)"),
    "weight_loss": (-500, "Moderate energy deficit (~0.5 kg/week rate)"),
    "mild_weight_gain": (300, "Gentle caloric surplus for lean tissue accretion (~0.3 kg/week)"),
    "weight_gain": (500, "Moderate caloric surplus for weight gain (~0.5 kg/week)"),
}

# Method Metadata, Citations & Limitations
METHOD_METADATA: Dict[str, Dict[str, str]] = {
    "mifflin_st_jeor": {
        "identifier": "mifflin_st_jeor_1990",
        "name": "Mifflin-St Jeor Predictive Equation (1990)",
        "version": "1.1.0",
        "citation": (
            "Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. "
            "A new predictive equation for resting energy expenditure in healthy individuals. "
            "Am J Clin Nutr. 1990;51(2):241-247."
        ),
        "equation_formula": (
            "Men: 10*Weight(kg) + 6.25*Height(cm) - 5*Age(y) + 5 | "
            "Women: 10*Weight(kg) + 6.25*Height(cm) - 5*Age(y) - 161"
        ),
        "applicable_population": (
            "Healthy adult men and women, ages 19–78. Validated across non-obese and obese adults "
            "in a US clinical outpatient setting (accuracy within ±10% of measured REE in ~82% of non-obese individuals)."
        ),
        "limitations": (
            "Predicts Resting Energy Expenditure (REE) at complete rest; does not measure body composition, "
            "thyroid activity, or athletic muscle mass directly. Tends to underestimate in elite athletes and "
            "may overestimate in frail older adults with sarcopenia."
        ),
    },
    "icmr_nin_2020": {
        "identifier": "icmr_nin_2020",
        "name": "ICMR-NIN Reference Equations for Indian Adults (2020)",
        "version": "1.1.0",
        "citation": (
            "Indian Council of Medical Research - National Institute of Nutrition (ICMR-NIN). "
            "Nutrient Requirements for Indians: Recommended Dietary Allowances and Estimated Average Requirements. "
            "Hyderabad, 2020, Section 2 (Energy Requirements)."
        ),
        "equation_formula": (
            "Indian Adult Males: Schofield(W) * 0.90 (-10% Indian body-composition adjustment) | "
            "Indian Adult Females: Schofield(W) * 0.91 (-9% Indian body-composition adjustment). "
            "Schofield base: 18–29y (M: 15.057W+692.2, F: 14.818W+486.6), 30–59y (M: 11.472W+873.1, F: 8.126W+845.6), 60+y (M: 11.711W+587.7, F: 9.082W+658.5)."
        ),
        "applicable_population": "Indian reference adult population aged 18–60+ years.",
        "limitations": (
            "Applies a population-level -10% (males) and -9% (females) adjustment to international Schofield equations "
            "to account for documented lower lean mass and higher relative body fat in Indian reference cohorts. "
            "May not reflect individuals with high athletic muscle mass or non-Indian ancestry."
        ),
    },
    "schofield_1985": {
        "identifier": "schofield_1985",
        "name": "Schofield / FAO/WHO/UNU Weight-Based BMR Equations (1985)",
        "version": "1.0.0",
        "citation": (
            "Schofield WN. Predicting basal metabolic rate, new standards and review of previous work. "
            "Hum Nutr Clin Nutr. 1985;39 Suppl 1:5-41. Endorsed by FAO/WHO/UNU (1985/2004)."
        ),
        "equation_formula": (
            "Uncorrected Schofield equations: 18–29y (M: 15.057W+692.2, F: 14.818W+486.6), "
            "30–59y (M: 11.472W+873.1, F: 8.126W+845.6), 60+y (M: 11.711W+587.7, F: 9.082W+658.5)."
        ),
        "applicable_population": "International adult populations, ages 18–60+ years.",
        "limitations": (
            "Derived largely from European and North American historical cohorts; known to overestimate BMR "
            "in South Asian and tropical populations by approximately 9%–12%."
        ),
    },
}

# Programmatic Software Guardrail Thresholds (kcal/day)
# Source: Conventional clinical practice guidelines (e.g. NIH NHLBI Obesity Guidelines, ACSM)
# Note: These are non-clinical programmatic software floors to avoid unmonitored very-low-calorie diets (VLCDs);
# they do NOT constitute individualized medical prescriptions or guarantees of safety.
GUARDRAIL_THRESHOLDS: Dict[str, float] = {
    "female": 1200.0,
    "male": 1500.0,
}
# Backward compatibility alias
SAFETY_FLOORS = GUARDRAIL_THRESHOLDS

# Plausible Adult Physiological Bounds
MIN_AGE = 18
MAX_AGE = 100
MIN_HEIGHT_CM = 100.0   # ~3 ft 3 in
MAX_HEIGHT_CM = 250.0   # ~8 ft 2 in
MIN_WEIGHT_KG = 30.0    # ~66 lbs
MAX_WEIGHT_KG = 300.0   # ~660 lbs


def resolve_method_identifier(method_str: Optional[str]) -> str:
    """Normalizes and resolves supported calculation method identifiers and aliases."""
    m = str(method_str or "mifflin_st_jeor").strip().lower()
    aliases: Dict[str, str] = {
        "mifflin": "mifflin_st_jeor",
        "mifflin_st_jeor": "mifflin_st_jeor",
        "mifflin_st_jeor_1990": "mifflin_st_jeor",
        "mifflin-st-jeor-v1": "mifflin_st_jeor",
        "icmr": "icmr_nin_2020",
        "icmr_nin": "icmr_nin_2020",
        "icmr_nin_2020": "icmr_nin_2020",
        "schofield": "schofield_1985",
        "schofield_1985": "schofield_1985",
    }
    if m in aliases:
        return aliases[m]
    if m in METHOD_METADATA:
        return m
    valid_options = ", ".join(METHOD_METADATA.keys())
    raise TargetEstimationValidationError(
        f"Unsupported estimation method '{method_str}'. Supported options are: {valid_options}."
    )


def _validate_finite_positive(val: Any, field_name: str) -> float:
    """Validates that a value is numeric, finite, non-negative, and strictly greater than zero."""
    if val is None:
        raise TargetEstimationValidationError(f"Missing required field: '{field_name}'.")
    try:
        f_val = float(val)
    except (TypeError, ValueError) as exc:
        raise TargetEstimationValidationError(
            f"Field '{field_name}' must be a valid numeric number, received: '{val}'"
        ) from exc

    if math.isnan(f_val):
        raise TargetEstimationValidationError(f"Field '{field_name}' cannot be NaN (Not a Number).")
    if math.isinf(f_val):
        raise TargetEstimationValidationError(f"Field '{field_name}' cannot be infinity.")
    if f_val <= 0:
        raise TargetEstimationValidationError(f"Field '{field_name}' must be strictly positive (> 0), received: {f_val}")

    return f_val


def normalize_height_to_cm(height_value: Any, unit: str = "cm") -> float:
    """Normalizes height from supported units (cm, m, in, ft_in) into centimeters."""
    u_clean = str(unit).strip().lower()

    if u_clean in ("cm", "centimeter", "centimeters"):
        cm = _validate_finite_positive(height_value, "height")
    elif u_clean in ("m", "meter", "meters"):
        m = _validate_finite_positive(height_value, "height")
        cm = m * 100.0
    elif u_clean in ("in", "inch", "inches"):
        inches = _validate_finite_positive(height_value, "height")
        cm = inches * 2.54
    elif u_clean in ("ft_in", "feet_inches"):
        # Format can be string "5'10", "5ft 10in", or dict/tuple {"feet": 5, "inches": 10}
        if isinstance(height_value, dict):
            ft = _validate_finite_positive(height_value.get("feet", 0), "height.feet")
            inch = _validate_finite_positive(height_value.get("inches", 0), "height.inches")
            cm = (ft * 12.0 + inch) * 2.54
        elif isinstance(height_value, (list, tuple)) and len(height_value) == 2:
            ft = _validate_finite_positive(height_value[0], "height.feet")
            inch = _validate_finite_positive(height_value[1], "height.inches")
            cm = (ft * 12.0 + inch) * 2.54
        elif isinstance(height_value, str):
            import re
            m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*(?:ft|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|\")?)?\s*$", height_value)
            if not m:
                raise TargetEstimationValidationError(
                    f"Unsupported height format '{height_value}' for unit 'ft_in'. Expected e.g. \"5'10\" or 5 ft 10 in."
                )
            ft = float(m.group(1))
            inch = float(m.group(2) or 0.0)
            if ft < 0 or inch < 0:
                raise TargetEstimationValidationError("Height components cannot be negative.")
            cm = (ft * 12.0 + inch) * 2.54
        else:
            raise TargetEstimationValidationError(
                f"Unsupported height data type for ft_in unit: {type(height_value).__name__}"
            )
    else:
        raise TargetEstimationValidationError(
            f"Unsupported height unit '{unit}'. Supported units are 'cm', 'm', 'in', and 'ft_in'."
        )

    if cm < MIN_HEIGHT_CM or cm > MAX_HEIGHT_CM:
        raise TargetEstimationValidationError(
            f"Normalized height of {cm:.1f} cm is outside supported adult physiological plausibility range "
            f"({MIN_HEIGHT_CM:.0f}–{MAX_HEIGHT_CM:.0f} cm)."
        )

    return round(cm, 2)


def normalize_weight_to_kg(weight_value: Any, unit: str = "kg") -> float:
    """Normalizes weight from supported units (kg, lbs) into kilograms."""
    u_clean = str(unit).strip().lower()

    if u_clean in ("kg", "kilogram", "kilograms"):
        kg = _validate_finite_positive(weight_value, "weight")
    elif u_clean in ("lbs", "lb", "pound", "pounds"):
        lbs = _validate_finite_positive(weight_value, "weight")
        kg = lbs * 0.45359237
    else:
        raise TargetEstimationValidationError(
            f"Unsupported weight unit '{unit}'. Supported units are 'kg' and 'lbs'."
        )

    if kg < MIN_WEIGHT_KG or kg > MAX_WEIGHT_KG:
        raise TargetEstimationValidationError(
            f"Normalized weight of {kg:.1f} kg is outside supported adult physiological plausibility range "
            f"({MIN_WEIGHT_KG:.0f}–{MAX_WEIGHT_KG:.0f} kg)."
        )

    return round(kg, 2)


def validate_age_years(age_value: Any) -> int:
    """Validates age in years and checks adult population eligibility."""
    if age_value is None:
        raise TargetEstimationValidationError("Missing required field: 'age'.")
    try:
        f_age = float(age_value)
    except (TypeError, ValueError) as exc:
        raise TargetEstimationValidationError(f"Age must be a valid integer number, received: '{age_value}'") from exc

    if math.isnan(f_age) or math.isinf(f_age):
        raise TargetEstimationValidationError("Age cannot be NaN or infinity.")

    age = int(round(f_age))

    if age < MIN_AGE:
        raise TargetIneligiblePopulationError(
            f"Nutriverse adult predictive equations are strictly validated for adults aged 18 and older "
            f"(received age {age}). Pediatric and adolescent nutritional requirements require clinical growth charts "
            f"and supervision by a licensed pediatric dietitian or healthcare professional."
        )

    if age > MAX_AGE:
        raise TargetEstimationValidationError(
            f"Age {age} exceeds supported predictive range (18–{MAX_AGE} years)."
        )

    return age


def validate_sex(sex_value: Any) -> str:
    """Validates biological sex required for equation coefficients."""
    if not sex_value:
        raise TargetEstimationValidationError("Missing required field: 'sex' (female or male).")
    s_clean = str(sex_value).strip().lower()
    if s_clean not in ("female", "male"):
        raise TargetEstimationValidationError(
            f"Invalid biological sex '{sex_value}'. Standard predictive equations require 'female' or 'male' "
            f"due to documented physiological differences in average baseline lean mass and organ metabolic rate."
        )
    return s_clean


def validate_activity_level(activity_value: Any) -> Tuple[str, float, str]:
    """Resolves activity level to a canonical name, PAL multiplier, and description."""
    if activity_value is None:
        raise TargetEstimationValidationError("Missing required field: 'activity_level'.")

    # If numeric PAL was supplied directly
    if isinstance(activity_value, (int, float)) and not isinstance(activity_value, bool):
        f_pal = float(activity_value)
        if math.isnan(f_pal) or math.isinf(f_pal):
            raise TargetEstimationValidationError("Activity level PAL multiplier cannot be NaN or infinity.")
        if f_pal < 1.1 or f_pal > 2.5:
            raise TargetEstimationValidationError(
                f"Numeric Physical Activity Level (PAL) {f_pal} is outside physiological range (1.10–2.50)."
            )
        # Find closest canonical name
        closest_name = min(ACTIVITY_PAL_MAP.keys(), key=lambda k: abs(ACTIVITY_PAL_MAP[k][0] - f_pal))
        _, desc = ACTIVITY_PAL_MAP[closest_name]
        return closest_name, round(f_pal, 3), f"Custom PAL multiplier: {f_pal:.3f} ({desc})"

    # String activity name
    act_str = str(activity_value).strip().lower().replace(" ", "_").replace("-", "_")
    if act_str in ACTIVITY_PAL_MAP:
        pal, desc = ACTIVITY_PAL_MAP[act_str]
        return act_str, pal, desc

    aliases: Dict[str, str] = {
        "desk": "sedentary",
        "low": "lightly_active",
        "light": "lightly_active",
        "moderate": "moderately_active",
        "mod": "moderately_active",
        "high": "very_active",
        "heavy": "very_active",
        "athlete": "extra_active",
        "extreme": "extra_active",
    }
    if act_str in aliases:
        canonical = aliases[act_str]
        pal, desc = ACTIVITY_PAL_MAP[canonical]
        return canonical, pal, desc

    valid_options = ", ".join(ACTIVITY_PAL_MAP.keys())
    raise TargetEstimationValidationError(
        f"Invalid activity_level '{activity_value}'. Valid options are: {valid_options}."
    )


def validate_goal(goal_value: Any) -> Tuple[str, int, str]:
    """Resolves goal to canonical identifier, energy adjustment (kcal/day), and description."""
    if goal_value is None:
        goal_value = "maintain"

    g_str = str(goal_value).strip().lower().replace(" ", "_").replace("-", "_")
    if g_str in GOAL_ADJUSTMENT_MAP:
        adj, desc = GOAL_ADJUSTMENT_MAP[g_str]
        return g_str, adj, desc

    aliases: Dict[str, str] = {
        "balanced": "maintain",
        "balanced_nutrition": "maintain",
        "balanced_nourishment": "maintain",
        "maintenance": "maintain",
        "loss": "weight_loss",
        "fat_loss": "weight_loss",
        "mild_loss": "mild_weight_loss",
        "gain": "weight_gain",
        "muscle_gain": "mild_weight_gain",
        "bulk": "weight_gain",
    }
    if g_str in aliases:
        canonical = aliases[g_str]
        adj, desc = GOAL_ADJUSTMENT_MAP[canonical]
        return canonical, adj, desc

    valid_options = ", ".join(GOAL_ADJUSTMENT_MAP.keys())
    raise TargetEstimationValidationError(
        f"Invalid goal '{goal_value}'. Valid options are: {valid_options}."
    )


def calculate_bmr_mifflin_st_jeor(weight_kg: float, height_cm: float, age_years: int, sex: str) -> float:
    """Calculates Resting Energy Expenditure using the Mifflin-St Jeor (1990) equation.

    Formula:
      Men:   10 * W(kg) + 6.25 * H(cm) - 5 * Age(y) + 5
      Women: 10 * W(kg) + 6.25 * H(cm) - 5 * Age(y) - 161
    """
    base = 10.0 * weight_kg + 6.25 * height_cm - 5.0 * age_years
    if sex == "male":
        return round(base + 5.0, 1)
    else:
        return round(base - 161.0, 1)


def calculate_bmr_schofield_1985(weight_kg: float, age_years: int, sex: str) -> float:
    """Calculates unadjusted baseline BMR using Schofield (1985) / FAO/WHO/UNU equations.

    Age brackets:
      18–29 years: M: 15.057*W + 692.2, F: 14.818*W + 486.6
      30–59 years: M: 11.472*W + 873.1, F: 8.126*W + 845.6
      60+ years:   M: 11.711*W + 587.7, F: 9.082*W + 658.5
    """
    if sex == "male":
        if age_years < 30:
            bmr = 15.057 * weight_kg + 692.2
        elif age_years < 60:
            bmr = 11.472 * weight_kg + 873.1
        else:
            bmr = 11.711 * weight_kg + 587.7
    else:
        if age_years < 30:
            bmr = 14.818 * weight_kg + 486.6
        elif age_years < 60:
            bmr = 8.126 * weight_kg + 845.6
        else:
            bmr = 9.082 * weight_kg + 658.5
    return round(bmr, 1)


def calculate_bmr_icmr_nin_2020(weight_kg: float, age_years: int, sex: str) -> float:
    """Calculates BMR using ICMR-NIN (2020) reference equations for Indian reference adults.

    Applies the authoritative ICMR-NIN (2020) body-composition correction factor:
    - 10% reduction for adult males (Schofield * 0.90)
    - 9% reduction for adult females (Schofield * 0.91)
    Reference: ICMR-NIN 2020, Nutrient Requirements for Indians, Section 2 (Energy Requirements).
    """
    raw_schofield = calculate_bmr_schofield_1985(weight_kg=weight_kg, age_years=age_years, sex=sex)
    if sex == "male":
        bmr = raw_schofield * 0.90
    else:
        bmr = raw_schofield * 0.91
    return round(bmr, 1)


def calculate_macronutrient_distribution(
    daily_energy_kcal: float,
    weight_kg: float,
    goal: str,
    method: str = "mifflin_st_jeor",
) -> Dict[str, Any]:
    """Calculates evidence-based macronutrient target distributions.

    References:
    - ICMR-NIN 2020 RDA & WHO/FAO 2007: Protein base 0.83 g/kg body weight for maintenance.
    - AMDR (Acceptable Macronutrient Distribution Ranges):
      * Protein: 10%–35% of total energy (4.0 kcal/g)
      * Fat: 20%–35% of total energy (9.0 kcal/g)
      * Carbohydrate: 45%–65% of total energy (4.0 kcal/g)
    - Dietary Fiber: 14 g per 1,000 kcal intake (US IOM AI; ICMR-NIN 2020 minimum 30g/day for Indian adults).
    """
    # 1. Protein Target
    if goal in ("mild_weight_loss", "weight_loss"):
        protein_g_per_kg = 1.0
        protein_basis = "Nutriverse planning target: 1.0 g/kg body weight to preserve lean mass during caloric deficit (within AMDR 10%–35%)"
    else:
        protein_g_per_kg = 0.83
        protein_basis = "ICMR-NIN 2020 & WHO reference allowance: 0.83 g/kg body weight for healthy adult maintenance"

    protein_grams = round(weight_kg * protein_g_per_kg, 1)
    protein_kcal = round(protein_grams * 4.0, 1)

    # AMDR Bounds for Protein
    protein_amdr_min_g = round((daily_energy_kcal * 0.10) / 4.0, 1)
    protein_amdr_max_g = round((daily_energy_kcal * 0.35) / 4.0, 1)

    # Clamp target grams within AMDR if body weight produces an outlier
    if protein_grams < protein_amdr_min_g:
        protein_grams = protein_amdr_min_g
        protein_kcal = round(protein_grams * 4.0, 1)
    elif protein_grams > protein_amdr_max_g:
        protein_grams = protein_amdr_max_g
        protein_kcal = round(protein_grams * 4.0, 1)

    protein_pct = round((protein_kcal / daily_energy_kcal) * 100.0, 1)

    # 2. Total Fat Target (Nutriverse planning midpoint of 25% of energy, within AMDR 20%–35%)
    fat_amdr_min_g = round((daily_energy_kcal * 0.20) / 9.0, 1)
    fat_amdr_max_g = round((daily_energy_kcal * 0.35) / 9.0, 1)
    fat_kcal_target = daily_energy_kcal * 0.25
    fat_grams = round(fat_kcal_target / 9.0, 1)
    fat_kcal = round(fat_grams * 9.0, 1)  # Recomputed to ensure grams * 9 exactly matches reported kcal
    fat_pct = round((fat_kcal / daily_energy_kcal) * 100.0, 1)

    # 3. Carbohydrate Target (Remainder of energy)
    carb_kcal_raw = round(daily_energy_kcal - (protein_kcal + fat_kcal), 1)
    carb_grams = round(carb_kcal_raw / 4.0, 1)
    carb_kcal = round(carb_grams * 4.0, 1)  # Recomputed to ensure grams * 4 exactly matches reported kcal
    carb_pct = round((carb_kcal / daily_energy_kcal) * 100.0, 1)
    carb_amdr_min_g = round((daily_energy_kcal * 0.45) / 4.0, 1)
    carb_amdr_max_g = round((daily_energy_kcal * 0.65) / 4.0, 1)

    if 45.0 <= carb_pct <= 65.0:
        carb_basis = f"Nutriverse planning allocation: Remaining energy ({carb_pct:.1f}%), within standard AMDR 45%–65%"
    elif carb_pct < 45.0:
        carb_basis = f"Nutriverse planning allocation: Remaining energy ({carb_pct:.1f}%), below AMDR 45% floor due to prioritized lean-mass protein allocation"
    else:
        carb_basis = f"Nutriverse planning allocation: Remaining energy ({carb_pct:.1f}%), above AMDR 65% ceiling due to low fat and protein proportions"

    # 4. Dietary Fiber Target
    is_icmr = "icmr" in str(method).lower()
    if is_icmr:
        # ICMR-NIN 2020 official recommendation: 30g per 2,000 kcal intake (~15g/1,000 kcal).
        # Nutriverse applies an illustrative software planning floor of 30g/day for whole-food Indian diet patterns.
        official_fiber_g = round(15.0 * (daily_energy_kcal / 1000.0), 1)
        planning_floor_g = 30.0
        fiber_grams = round(max(planning_floor_g, official_fiber_g), 1)
        fiber_basis = (
            "ICMR-NIN 2020 official recommendation: 30g per 2,000 kcal intake (15g/1,000 kcal). "
            "Nutriverse applies an illustrative minimum planning floor of 30g/day for whole-food Indian diet patterns."
        )
        fiber_standard = "ICMR-NIN 2020 (30g/2,000 kcal)"
        floor_applied = fiber_grams == planning_floor_g and official_fiber_g < planning_floor_g
    else:
        # US IOM 2005 Adequate Intake: 14g per 1,000 kcal daily intake.
        # Nutriverse applies an illustrative software planning floor of 25g/day (based on adult female median AI).
        official_fiber_g = round(14.0 * (daily_energy_kcal / 1000.0), 1)
        planning_floor_g = 25.0
        fiber_grams = round(max(planning_floor_g, official_fiber_g), 1)
        fiber_basis = (
            "US IOM (2005) Adequate Intake: 14g per 1,000 kcal daily energy intake. "
            "Nutriverse applies an illustrative minimum planning floor of 25g/day (based on adult female median AI)."
        )
        fiber_standard = "US IOM 2005 Adequate Intake (14g/1,000 kcal)"
        floor_applied = fiber_grams == planning_floor_g and official_fiber_g < planning_floor_g

    reported_energy_sum_kcal = round(protein_kcal + fat_kcal + carb_kcal, 1)

    return {
        "protein": {
            "target_g_day": protein_grams,
            "target_kcal_day": protein_kcal,
            "energy_percentage": protein_pct,
            "reference_basis": protein_basis,
            "amdr_range_g_day": {"min": protein_amdr_min_g, "max": protein_amdr_max_g},
            "amdr_percentage_range": "10%–35% of total daily energy",
            "energy_density_kcal_per_g": 4.0,
        },
        "fat": {
            "target_g_day": fat_grams,
            "target_kcal_day": fat_kcal,
            "energy_percentage": fat_pct,
            "reference_basis": "Nutriverse illustrative planning midpoint: 25% total energy (within the 20%–35% AMDR established by ICMR-NIN 2020 and US IOM)",
            "amdr_range_g_day": {"min": fat_amdr_min_g, "max": fat_amdr_max_g},
            "amdr_percentage_range": "20%–35% of total daily energy",
            "energy_density_kcal_per_g": 9.0,
        },
        "carbohydrates": {
            "target_g_day": carb_grams,
            "target_kcal_day": carb_kcal,
            "energy_percentage": carb_pct,
            "reference_basis": carb_basis,
            "amdr_range_g_day": {"min": carb_amdr_min_g, "max": carb_amdr_max_g},
            "amdr_percentage_range": "45%–65% of total daily energy",
            "energy_density_kcal_per_g": 4.0,
        },
        "dietary_fiber": {
            "target_g_day": fiber_grams,
            "official_reference_g_day": official_fiber_g,
            "planning_floor_g_day": planning_floor_g,
            "planning_floor_applied": floor_applied,
            "floor_applied": floor_applied,
            "standard_applied": fiber_standard,
            "reference_basis": fiber_basis,
            "unit": "g/day",
        },
        "macro_energy_accounting": {
            "total_reported_macro_kcal_day": reported_energy_sum_kcal,
            "daily_energy_target_kcal": daily_energy_kcal,
            "discrepancy_kcal": round(abs(reported_energy_sum_kcal - daily_energy_kcal), 1),
            "accounting_disclosure": (
                "Macronutrient calories are calculated directly from reported grams using Atwater factors "
                "(4 kcal/g protein, 9 kcal/g fat, 4 kcal/g carbohydrate). Minor differences from daily_energy_target_kcal "
                "are strictly due to single-decimal gram rounding (±0.1g = ±0.4–0.9 kcal) and are disclosed rather than force-reconciled."
            ),
        },
    }


def calculate_nutrition_targets(
    *,
    age: Any,
    sex: Any,
    height: Any,
    height_unit: str = "cm",
    weight: Any,
    weight_unit: str = "kg",
    activity_level: Any,
    goal: Any = "maintain",
    method: str = "mifflin_st_jeor",
    optional_allergies: Optional[str] = None,
    optional_preferences: Optional[str] = None,
) -> Dict[str, Any]:
    """Main entrypoint: Deterministically estimates personalized nutrition targets.

    Validates inputs, normalizes units, calculates BMR, TDEE, goal-adjusted energy,
    applies programmatic software guardrails, and derives evidence-based macronutrient ranges.
    Returns complete reproduction metadata and clinical limitations.
    """
    # 1. Input Validation & Unit Normalization
    age_years = validate_age_years(age)
    norm_sex = validate_sex(sex)
    norm_height_cm = normalize_height_to_cm(height, unit=height_unit)
    norm_weight_kg = normalize_weight_to_kg(weight, unit=weight_unit)
    canonical_act, pal_multiplier, act_desc = validate_activity_level(activity_level)
    canonical_goal, goal_adjustment_kcal, goal_desc = validate_goal(goal)
    resolved_method = resolve_method_identifier(method)

    # 2. Biometric Indicators
    height_m = norm_height_cm / 100.0
    bmi = round(norm_weight_kg / (height_m * height_m), 2)

    if bmi < 18.5:
        bmi_class = "Underweight (< 18.5 kg/m²)"
    elif bmi < 25.0:
        bmi_class = "Normal weight (18.5–24.9 kg/m²)"
    elif bmi < 30.0:
        bmi_class = "Overweight (25.0–29.9 kg/m²)"
    else:
        bmi_class = "Obese (≥ 30.0 kg/m²)"

    # 3. BMR Estimation
    if resolved_method == "mifflin_st_jeor":
        bmr_kcal = calculate_bmr_mifflin_st_jeor(
            weight_kg=norm_weight_kg,
            height_cm=norm_height_cm,
            age_years=age_years,
            sex=norm_sex,
        )
    elif resolved_method == "icmr_nin_2020":
        bmr_kcal = calculate_bmr_icmr_nin_2020(
            weight_kg=norm_weight_kg,
            age_years=age_years,
            sex=norm_sex,
        )
    elif resolved_method == "schofield_1985":
        bmr_kcal = calculate_bmr_schofield_1985(
            weight_kg=norm_weight_kg,
            age_years=age_years,
            sex=norm_sex,
        )
    else:
        raise TargetEstimationValidationError(f"Unhandled method: {resolved_method}")

    # 4. TDEE & Goal Adjustment (Order of operations: TDEE = BMR * PAL, raw target = TDEE + adjustment)
    tdee_kcal = round(bmr_kcal * pal_multiplier, 1)
    raw_daily_target_kcal = round(tdee_kcal + goal_adjustment_kcal, 1)

    # 5. Programmatic Software Guardrail Floor
    guardrail_threshold = GUARDRAIL_THRESHOLDS[norm_sex]
    guardrail_applied = raw_daily_target_kcal < guardrail_threshold
    daily_energy_target_kcal = max(raw_daily_target_kcal, guardrail_threshold)

    # 6. Warnings & Clinical Limitations
    warnings: List[str] = []

    if guardrail_applied:
        warnings.append(
            f"Programmatic guardrail applied: Raw goal-adjusted estimate ({raw_daily_target_kcal:.0f} kcal/day) falls below "
            f"Nutriverse's default software floor ({guardrail_threshold:.0f} kcal/day for adult {norm_sex}s, derived from general NIH/ACSM unmonitored diet guidelines). "
            f"This programmatic floor is a non-clinical guardrail and does NOT guarantee individual safety. "
            f"A caloric target this low indicates an aggressive deficit that requires professional evaluation by a registered dietitian or physician."
        )

    # Deficit proportion check
    if canonical_goal in ("mild_weight_loss", "weight_loss") and tdee_kcal > 0:
        deficit_kcal = tdee_kcal - raw_daily_target_kcal
        deficit_pct = (deficit_kcal / tdee_kcal) * 100.0
        if deficit_pct > 25.0:
            warnings.append(
                f"Caution: Requested deficit is {deficit_pct:.1f}% below estimated maintenance expenditure ({tdee_kcal:.0f} kcal/day). "
                f"Deficits exceeding 25% increase the risk of rapid lean mass loss, metabolic adaptation, and micronutrient inadequacy. Professional guidance is advised."
            )

    if bmi < 18.5 and canonical_goal in ("mild_weight_loss", "weight_loss"):
        warnings.append(
            f"Clinical Alert: Current BMI is in the underweight range ({bmi:.1f} kg/m²). "
            f"Caloric restriction is generally contraindicated in underweight individuals; consult a healthcare professional before pursuing weight reduction."
        )

    if bmi >= 40.0:
        warnings.append(
            f"Screening Alert: BMI is {bmi:.1f} kg/m² (Class III obesity). Predictive equations may overestimate resting metabolic rate "
            f"due to altered adipose-to-lean tissue ratios. Direct indirect calorimetry under medical supervision is recommended for precise expenditure assessment."
        )

    if age_years >= 75:
        warnings.append(
            f"Age notice: Predictive equations have wider margins of error in older adults ({age_years} years) "
            f"due to progressive age-related sarcopenia and changes in lean body mass."
        )

    if resolved_method == "mifflin_st_jeor":
        if age_years == 18:
            warnings.append(
                "Population notice: The Mifflin-St Jeor (1990) equation was originally validated in subjects aged 19–78. "
                "Application to age 18 reflects clinical convention extending adult formulas to young adulthood."
            )
        elif age_years > 78:
            warnings.append(
                f"Population notice: The Mifflin-St Jeor (1990) equation was validated up to age 78 (received age {age_years}). "
                "In individuals over 78, resting metabolic rate may be overestimated due to age-related loss of metabolically active lean mass."
            )

    # 7. Macronutrient Distribution
    macros = calculate_macronutrient_distribution(
        daily_energy_kcal=daily_energy_target_kcal,
        weight_kg=norm_weight_kg,
        goal=canonical_goal,
        method=resolved_method,
    )

    calculation_id = str(uuid.uuid4())
    calc_time = datetime.now(timezone.utc).isoformat()

    return {
        "calculation_id": calculation_id,
        "timestamp": calc_time,
        "method": METHOD_METADATA[resolved_method],
        "inputs": {
            "age_years": age_years,
            "sex": norm_sex,
            "height": {
                "value": height,
                "unit": height_unit,
                "normalized_cm": norm_height_cm,
            },
            "weight": {
                "value": weight,
                "unit": weight_unit,
                "normalized_kg": norm_weight_kg,
            },
            "activity_level": {
                "name": canonical_act,
                "pal_multiplier": pal_multiplier,
                "description": act_desc,
            },
            "goal": {
                "name": canonical_goal,
                "energy_adjustment_kcal": goal_adjustment_kcal,
                "description": goal_desc,
            },
            "optional_dietary": {
                "allergies": optional_allergies or "None declared",
                "food_preferences": optional_preferences or "Standard diet",
            },
        },
        "biometric_indicators": {
            "bmi": bmi,
            "bmi_classification": bmi_class,
            "screening_note": (
                "BMI is a statistical screening index based on weight and height. It does not measure body fat distribution, "
                "muscle mass, or metabolic health directly, and does NOT constitute a clinical diagnosis of obesity or disease."
            ),
        },
        "energy_targets": {
            "bmr_kcal_day": bmr_kcal,
            "tdee_kcal_day": tdee_kcal,
            "raw_daily_target_kcal": raw_daily_target_kcal,
            "daily_energy_target_kcal": daily_energy_target_kcal,
            "guardrail_applied": guardrail_applied,
            "guardrail_threshold_kcal": guardrail_threshold,
            "guardrail_type": "programmatic_unmonitored_minimum_floor",
            "guardrail_basis": (
                f"General NIH/ACSM guideline floor for unmonitored dietary plans ({guardrail_threshold:.0f} kcal/day for {norm_sex}s). "
                "Serves as a software guardrail, not an individualized clinical prescription."
            ),
            # Backward-compatibility aliases
            "safety_floor_applied": guardrail_applied,
            "safety_floor_threshold_kcal": guardrail_threshold,
        },
        "macronutrient_targets": macros,
        "warnings": warnings,
        "assumptions_and_limitations": [
            "Estimates reflect statistical population medians and do not account for individual metabolic adaptation, thyroid function, or athletic body composition.",
            "Predictive equations calculate resting energy; actual non-exercise activity thermogenesis (NEAT) varies considerably between individuals.",
            "These targets are educational estimates and do NOT constitute medical, diagnostic, or therapeutic prescriptions.",
        ],
        "disclaimer": (
            "Nutriverse personalized nutrition targets are scientific estimates for dietary planning only. "
            "They are not medical prescriptions, clinical diagnoses, or guaranteed outcomes. "
            "Individuals with chronic medical conditions, pregnant or lactating individuals, or those with eating disorders "
            "should consult a licensed physician or registered dietitian before modifying dietary intake."
        ),
    }
