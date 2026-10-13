"""Open Food Facts API Client & Provenance Integration Service.

Provides an isolated, production-grade integration with Open Food Facts
following official API policies:
- User-Agent specification complying with OFF terms.
- Explicit rate-limit and timeout handling.
- Deterministic extraction and checksumming for SourceRecord provenance.
- Field-level verification assignment as 'source_reported' (never 'verified_reference').
- Explicit distinction between reported 0.0 and missing/unknown nutrient values (None).
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, Optional

import httpx

try:
    from backend.app.main import VerificationStatus
except ImportError:
    from app.main import VerificationStatus

logger = logging.getLogger("nutriverse.openfoodfacts")

DEFAULT_OFF_BASE_URL = "https://world.openfoodfacts.org"
DEFAULT_USER_AGENT = "NutriverseApp/1.0 (Web/Backend; contact: dev@nutriverse.in)"
DEFAULT_TIMEOUT_SECONDS = 5.0

# Canonical nutrient mapping from Open Food Facts nutriments dict
NUTRIENT_KEY_MAP = {
    "energy-kcal_100g": ("ENERC_KCAL", "kcal", "Energy (kcal)"),
    "energy-kj_100g": ("ENERC_KJ", "kJ", "Energy (kJ)"),
    "proteins_100g": ("PROTCNT", "g", "Protein"),
    "carbohydrates_100g": ("CHOAVLDF", "g", "Carbohydrates, available"),
    "fat_100g": ("FATCE", "g", "Total Fat"),
    "fiber_100g": ("FIBTG", "g", "Dietary Fibre"),
    "sodium_100g": ("NA", "mg", "Sodium"),
    "calcium_100g": ("CA", "mg", "Calcium"),
    "iron_100g": ("FE", "mg", "Iron"),
    "vitamin-c_100g": ("VITC", "mg", "Vitamin C"),
}


class OpenFoodFactsError(Exception):
    """Base exception for Open Food Facts service."""
    pass


class OpenFoodFactsRateLimitError(OpenFoodFactsError):
    """Raised when encountering HTTP 429 Too Many Requests."""
    pass


class OpenFoodFactsTimeoutError(OpenFoodFactsError):
    """Raised when an API request times out."""
    pass


class OpenFoodFactsBarcodeMismatchError(OpenFoodFactsError):
    """Raised when upstream API returns a product with a different barcode."""
    pass


def extract_image_provenance(product: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts granular image URL, license, contributor, and attribution metadata from an Open Food Facts product.

    Audit B Rules:
    1. Do not assign one blanket image licence to every image.
    2. Preserve available image-specific licence, attribution, source URL, and contributor metadata.
    3. If the licence cannot be established, represent it as 'unknown' and avoid claiming verified licence compliance.
    4. If no image URL exists, represent status as 'no_image'.
    5. Keep image licensing distinct from database licensing.
    """
    image_url = product.get("image_front_url") or product.get("image_url")
    if not image_url:
        return {
            "url": None,
            "source_url": None,
            "license": None,
            "license_status": "no_image",
            "contributor": None,
            "attribution": "No product packaging image reported.",
        }

    # 1. Contributor extraction
    contributor = None
    images_dict = product.get("images")
    if isinstance(images_dict, dict):
        front_img = images_dict.get("front_en") or images_dict.get("front") or images_dict.get("1")
        if isinstance(front_img, dict):
            contributor = front_img.get("uploader") or front_img.get("photographer")
        if not contributor:
            for k, img_info in images_dict.items():
                if isinstance(img_info, dict) and (img_info.get("uploader") or img_info.get("photographer")):
                    contributor = img_info.get("uploader") or img_info.get("photographer")
                    break

    if not contributor:
        photographers = product.get("photographers_tags") or product.get("photographers")
        if isinstance(photographers, list) and photographers:
            contributor = str(photographers[0])
        elif isinstance(photographers, str) and photographers.strip():
            contributor = photographers.strip()
        elif product.get("creator"):
            contributor = str(product.get("creator")).strip()

    # 2. License extraction
    raw_license = None
    if isinstance(images_dict, dict):
        front_img = images_dict.get("front_en") or images_dict.get("front") or images_dict.get("1")
        if isinstance(front_img, dict):
            raw_license = front_img.get("license") or front_img.get("licence")
        if not raw_license:
            for k, img_info in images_dict.items():
                if isinstance(img_info, dict) and (img_info.get("license") or img_info.get("licence")):
                    raw_license = img_info.get("license") or img_info.get("licence")
                    break

    if not raw_license:
        raw_license = (
            product.get("image_licence")
            or product.get("image_license")
            or product.get("image_front_licence")
            or product.get("image_front_license")
        )

    # 3. Determine normalized license and license_status
    if raw_license:
        lic_clean = str(raw_license).strip()
        lic_lower = lic_clean.lower()
        if "cc-by-sa-4.0" in lic_lower or "cc by-sa 4.0" in lic_lower:
            norm_license = "Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)"
        elif "cc-by-sa-3.0" in lic_lower or "cc by-sa 3.0" in lic_lower:
            norm_license = "Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)"
        elif "cc-by-sa-2.0" in lic_lower or "cc by-sa 2.0" in lic_lower:
            norm_license = "Creative Commons Attribution-ShareAlike 2.0 (CC BY-SA 2.0)"
        elif "cc-by-sa" in lic_lower or "cc by-sa" in lic_lower:
            norm_license = "Creative Commons Attribution-ShareAlike (CC BY-SA)"
        elif "cc0" in lic_lower or "public domain" in lic_lower:
            norm_license = "Creative Commons Zero (CC0 1.0) / Public Domain"
        elif "free" in lic_lower:
            norm_license = "Open Food Facts Contributor Free License"
        else:
            norm_license = lic_clean

        license_status = "known"
    else:
        norm_license = "unknown"
        license_status = "unknown"

    # 4. Formulate specific attribution
    if license_status == "known":
        if contributor:
            attribution = f"Product packaging photo by '{contributor}' via Open Food Facts under {norm_license}."
        else:
            attribution = f"Product packaging photo via Open Food Facts contributors under {norm_license}."
    else:
        if contributor:
            attribution = f"Product photo contributed by '{contributor}' via Open Food Facts. Specific image license unverified."
        else:
            attribution = "Product photo via Open Food Facts. Contributor and specific image license unverified."

    return {
        "url": image_url,
        "source_url": image_url,
        "license": norm_license,
        "license_status": license_status,
        "contributor": contributor,
        "attribution": attribution,
    }


class OpenFoodFactsClient:
    """Isolated client for Open Food Facts API v2."""

    def __init__(
        self,
        base_url: str = DEFAULT_OFF_BASE_URL,
        user_agent: str = DEFAULT_USER_AGENT,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        client: Optional[httpx.Client] = None,
        max_retries: int = 1,
    ):
        self.base_url = base_url.rstrip("/")
        self.user_agent = user_agent
        self.timeout = timeout
        self._external_client = client
        self.max_retries = max_retries

    def _get_response(self, endpoint: str, params: Dict[str, Any]) -> httpx.Response:
        if self._external_client is not None:
            return self._external_client.get(endpoint, params=params)
        with httpx.Client(
            headers={
                "User-Agent": self.user_agent,
                "Accept": "application/json",
            },
            timeout=self.timeout,
        ) as http_client:
            return http_client.get(endpoint, params=params)

    def fetch_product(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Fetches product details from OFF v2 API for a given barcode.

        Returns raw parsed JSON dictionary if found, or None if product does not exist.
        Raises OpenFoodFactsRateLimitError on 429, OpenFoodFactsTimeoutError on timeout,
        OpenFoodFactsBarcodeMismatchError if upstream product code mismatches,
        or OpenFoodFactsError on network failures.
        """
        clean_barcode = barcode.strip()
        if not clean_barcode or not clean_barcode.isalnum() or len(clean_barcode) < 3 or len(clean_barcode) > 32:
            raise ValueError(f"Invalid barcode format: '{barcode}'")

        endpoint = f"{self.base_url}/api/v2/product/{clean_barcode}.json"
        params = {
            "fields": (
                "code,product_name,product_name_en,brands,quantity,serving_size,serving_quantity,"
                "ingredients_text,ingredients_text_en,categories,packaging,countries,"
                "image_url,image_front_url,images,image_licence,image_license,photographers_tags,photographers,creator,"
                "nutriments,status,nutrition_data_per"
            )
        }

        attempts = 0
        last_error: Optional[Exception] = None

        while attempts <= self.max_retries:
            attempts += 1
            try:
                response = self._get_response(endpoint, params=params)

                if response.status_code == 429:
                    logger.warning("Open Food Facts rate limit hit (HTTP 429) for barcode %s", clean_barcode)
                    raise OpenFoodFactsRateLimitError("Open Food Facts API rate limit exceeded.")

                if response.status_code == 404:
                    return None

                response.raise_for_status()
                data = response.json()

                # Status 0 in OFF indicates product not found
                if data.get("status") == 0 or "product" not in data:
                    return None

                product = data.get("product", {})
                returned_code = str(product.get("code") or data.get("code") or "").strip()
                if returned_code and returned_code != clean_barcode:
                    logger.warning(
                        "Open Food Facts returned mismatched barcode: requested '%s', received '%s'",
                        clean_barcode,
                        returned_code,
                    )
                    raise OpenFoodFactsBarcodeMismatchError(
                        f"Returned product code '{returned_code}' does not match requested barcode '{clean_barcode}'"
                    )

                return data

            except OpenFoodFactsRateLimitError:
                raise
            except OpenFoodFactsBarcodeMismatchError:
                raise
            except httpx.TimeoutException as exc:
                logger.warning("Open Food Facts timeout for barcode %s: %s (attempt %d)", clean_barcode, exc, attempts)
                last_error = exc
                if attempts > self.max_retries:
                    raise OpenFoodFactsTimeoutError(f"Request timed out contacting Open Food Facts: {exc}") from exc
            except httpx.HTTPStatusError as exc:
                logger.error("Open Food Facts HTTP error %s for barcode %s", exc.response.status_code, clean_barcode)
                if exc.response.status_code in (500, 502, 503, 504) and attempts <= self.max_retries:
                    last_error = exc
                    continue
                raise OpenFoodFactsError(f"Open Food Facts HTTP {exc.response.status_code}: {exc}") from exc
            except (httpx.RequestError, json.JSONDecodeError) as exc:
                logger.error("Open Food Facts request error for barcode %s: %s (attempt %d)", clean_barcode, exc, attempts)
                last_error = exc
                if attempts > self.max_retries:
                    raise OpenFoodFactsError(f"Failed to fetch data from Open Food Facts: {exc}") from exc

        if last_error:
            raise OpenFoodFactsError(f"Failed to fetch data from Open Food Facts after retries: {last_error}")
        return None

    def parse_product_payload(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parses and structures OFF product response into provenance-ready record.

        Distinguishes missing nutrients (None with is_unknown=True) from reported values.
        Assigns verification status as 'source_reported'.
        Computes SHA-256 hash of payload.
        """
        product = raw_data.get("product", {})
        code = str(product.get("code") or raw_data.get("code", "")).strip()
        product_name = product.get("product_name") or product.get("product_name_en") or "Unknown Product"
        brands = (product.get("brands") or "").strip()
        categories = (product.get("categories") or "").strip()
        packaging = (product.get("packaging") or "").strip()
        countries = (product.get("countries") or "").strip()
        quantity = (product.get("quantity") or "").strip()
        ingredients_text = (product.get("ingredients_text") or product.get("ingredients_text_en") or "").strip()
        serving_size = (product.get("serving_size") or "100g").strip()
        image_url = product.get("image_front_url") or product.get("image_url")
        raw_basis = (product.get("nutrition_data_per") or "100g").strip().lower()
        if raw_basis in ("100ml", "100 ml"):
            basis_str = "per_100ml"
        elif raw_basis in ("serving", "portion"):
            basis_str = "per_serving"
        elif raw_basis in ("100g", "100 g"):
            basis_str = "per_100g"
        else:
            basis_str = f"per_{raw_basis}"

        serving_quantity = None
        raw_sq = product.get("serving_quantity")
        if raw_sq is not None:
            try:
                sq_val = float(raw_sq)
                import math
                if not (math.isnan(sq_val) or math.isinf(sq_val) or sq_val <= 0):
                    serving_quantity = sq_val
            except (ValueError, TypeError):
                serving_quantity = None

        nutriments = product.get("nutriments", {})

        serialized_payload = json.dumps(raw_data, sort_keys=True)
        checksum = hashlib.sha256(serialized_payload.encode("utf-8")).hexdigest()

        extracted_nutrients = []
        for off_key, (canonical_code, unit, nutrient_name) in NUTRIENT_KEY_MAP.items():
            if off_key in nutriments and nutriments[off_key] is not None:
                try:
                    val = float(nutriments[off_key])
                    import math
                    # Reject non-finite values (NaN, Inf) and physically impossible negative values
                    if math.isnan(val) or math.isinf(val) or val < 0:
                        raise ValueError(f"Nutrient value {val} is non-finite or negative.")

                    # OFF sometimes reports sodium in grams; if key is sodium_100g and unit is mg, convert if needed
                    if canonical_code == "NA":
                        unit_str = nutriments.get("sodium_unit", "g").lower()
                        if unit_str == "g":
                            val = val * 1000.0  # convert g to mg
                            unit = "mg"
                    elif canonical_code in ("CA", "FE", "VITC"):
                        unit_str = nutriments.get(f"{off_key.replace('_100g', '')}_unit", "mg").lower()
                        if unit_str == "g":
                            val = val * 1000.0
                            unit = "mg"

                    extracted_nutrients.append({
                        "canonical_code": canonical_code,
                        "nutrient_name": nutrient_name,
                        "value": round(val, 4),
                        "unit": unit,
                        "basis": basis_str,
                        "is_unknown": False,
                        "unknown_reason": None,
                        "verification_status": VerificationStatus.source_reported.value,
                    })
                except (ValueError, TypeError):
                    extracted_nutrients.append({
                        "canonical_code": canonical_code,
                        "nutrient_name": nutrient_name,
                        "value": None,
                        "unit": unit,
                        "basis": basis_str,
                        "is_unknown": True,
                        "unknown_reason": "Malformed or non-finite nutrient value in Open Food Facts record",
                        "verification_status": VerificationStatus.pending_review.value,
                    })
            else:
                extracted_nutrients.append({
                    "canonical_code": canonical_code,
                    "nutrient_name": nutrient_name,
                    "value": None,
                    "unit": unit,
                    "basis": basis_str,
                    "is_unknown": True,
                    "unknown_reason": "Not reported in Open Food Facts record",
                    "verification_status": VerificationStatus.source_reported.value,
                })

        img_provenance = extract_image_provenance(product)

        return {
            "external_id": code,
            "external_name": f"{product_name} ({brands})" if brands else product_name,
            "product_name": product_name,
            "brand": brands or None,
            "quantity": quantity or None,
            "serving_size": serving_size,
            "serving_quantity": serving_quantity,
            "ingredients": ingredients_text or None,
            "category": categories or None,
            "packaging": packaging or None,
            "countries": countries or None,
            "basis": basis_str,
            "raw_payload": serialized_payload,
            "raw_checksum": checksum,
            "image_url": img_provenance["url"],
            "image_provenance": img_provenance,
            "image_license": img_provenance["license"],
            "image_attribution": img_provenance["attribution"],
            "image_contributor": img_provenance["contributor"],
            "nutrients": extracted_nutrients,
            "verification_status": VerificationStatus.source_reported.value,
            "license_attribution": (
                "Contains information from Open Food Facts, which is made available here "
                "under the Open Database License (ODbL)."
            ),
        }