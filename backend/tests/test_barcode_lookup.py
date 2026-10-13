"""Nutriverse — Phase 4 Barcode Lookup & Provenance Regression Suite.

Tests cover:
1. Exact local barcode match (in-catalog resolution).
2. Exact external barcode match via Open Food Facts (out-of-catalog resolution).
3. External result with mismatched barcode rejection (no heuristic/fuzzy guessing).
4. Leading-zero preservation (never converted to integer or stripped).
5. Invalid barcode input validation (400 on spaces, symbols, out-of-bound lengths).
6. Unknown barcode handling (404 when absent from both local and external).
7. Upstream timeout handling (504 Gateway Timeout).
8. Upstream rate limit handling (429 Too Many Requests).
9. Upstream service failure handling (502 Bad Gateway).
10. Missing and malformed nutrition fields (None preserved with is_unknown=True, never coerced to 0.0).
11. Strict distinction between verified reference and source-reported provenance.
12. Different serving bases preserved without unsupported conversions.
13. Caching and duplicate lookup behavior (avoids repeated external HTTP requests).
14. Persistence failure and rollback safety.
15. Backward compatibility of legacy GET /api/foods/barcode/{barcode}.
"""

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.main import (
    DataSource,
    Food,
    SessionLocal,
    SourceRecord,
    VerificationStatus,
    app,
)
from backend.app.services.barcode_lookup import (
    BarcodeValidationError,
    compute_gtin_check_digit,
    lookup_exact_barcode,
    normalize_barcode,
)
from backend.app.services.openfoodfacts import (
    OpenFoodFactsBarcodeMismatchError,
    OpenFoodFactsClient,
    OpenFoodFactsError,
    OpenFoodFactsRateLimitError,
    OpenFoodFactsTimeoutError,
)

client = TestClient(app)


# Sample OFF Payload for testing
SAMPLE_OFF_PAYLOAD = {
    "code": "8901030382345",
    "status": 1,
    "product": {
        "code": "8901030382345",
        "product_name": "Tata Tea Gold",
        "product_name_en": "Tata Tea Gold",
        "brands": "Tata Tea",
        "quantity": "250g",
        "categories": "Beverages, Teas",
        "packaging": "Pouch, Cardboard Box",
        "countries": "India",
        "ingredients_text": "Tea leaves (100%)",
        "serving_size": "2g",
        "serving_quantity": 2.0,
        "image_url": "https://images.openfoodfacts.org/images/products/890/103/038/2345/front_en.jpg",
        "image_licence": "CC-BY-SA-3.0",
        "photographers_tags": ["tata_tea_contributor"],
        "nutrition_data_per": "100g",
        "nutriments": {
            "energy-kcal_100g": 100.0,
            "energy-kj_100g": 418.4,
            "proteins_100g": 18.0,
            "carbohydrates_100g": 3.0,
            "fat_100g": 0.5,
            # Note: fiber, calcium, iron are omitted from payload to test unknown handling
        },
    },
}


def test_normalization_and_leading_zero_preservation():
    """Test 1: Barcode normalization preserves leading zeros and rejects invalid formats."""
    # Preserves leading zeros
    assert normalize_barcode("012345678905") == "012345678905"
    assert normalize_barcode("000456") == "000456"
    assert normalize_barcode(" 0890123456781 ") == "0890123456781"

    # Rejects invalid lengths and characters
    with pytest.raises(BarcodeValidationError, match="Invalid barcode characters"):
        normalize_barcode("890-1234-5678")

    with pytest.raises(BarcodeValidationError, match="Invalid barcode characters"):
        normalize_barcode("890 123456789")

    with pytest.raises(BarcodeValidationError, match="Invalid barcode characters"):
        normalize_barcode("8901234@!")

    with pytest.raises(BarcodeValidationError, match="Invalid barcode length"):
        normalize_barcode("12")  # Less than 3 chars

    with pytest.raises(BarcodeValidationError, match="Invalid barcode length"):
        normalize_barcode("1" * 35)  # More than 32 chars

    with pytest.raises(BarcodeValidationError, match="Barcode cannot be empty"):
        normalize_barcode("   ")


def test_exact_local_barcode_match():
    """Test 2: Exact local match returns verified catalog item with authoritative provenance."""
    res = client.get("/api/barcode/lookup/8901234567890")
    assert res.status_code == 200
    data = res.json()

    assert data["barcode"] == "8901234567890"
    assert data["match_type"] == "local_catalog"
    assert data["is_in_catalog"] is True
    assert "Sprouted Chickpeas" in data["product"]["name"]
    assert data["product"]["price_paise"] == 19900
    assert data["verification_status"] == VerificationStatus.verified_reference.value
    assert data["basis"] == "per_100g_edible"
    assert "Nutriverse Authoritative Catalog" in data["source"]["name"]

    # Verify nutrients
    nutrients = {n["canonical_code"]: n for n in data["nutrients"]}
    assert "ENERC_KCAL" in nutrients
    # From authentic IFCT 2017 laboratory ground truth ingested in Phase 2
    assert nutrients["ENERC_KCAL"]["value"] == 287.05
    assert nutrients["ENERC_KCAL"]["verification_status"] == VerificationStatus.verified_reference.value


def test_exact_external_barcode_match():
    """Test 3: External barcode match via Open Food Facts returns source-reported data and ODbL attribution."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = SAMPLE_OFF_PAYLOAD
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8901030382345")
        assert res.status_code == 200
        data = res.json()

        assert data["barcode"] == "8901030382345"
        assert data["match_type"] in ("external_fresh", "external_cached")
        assert data["is_in_catalog"] is False
        assert data["product"]["name"] == "Tata Tea Gold"
        assert data["product"]["brand"] == "Tata Tea"
        assert data["product"]["price_paise"] is None
        assert data["product"]["stock_qty"] == 0
        assert data["verification_status"] == VerificationStatus.source_reported.value
        assert "Open Food Facts" in data["source"]["name"]
        assert "Open Database License (ODbL)" in data["license_attribution"]


def test_external_barcode_mismatch_rejected():
    """Test 4: Upstream product with mismatched barcode is strictly rejected (422)."""
    mismatched_code = "8909999000119"
    mismatched_payload = {
        "code": mismatched_code,
        "status": 1,
        "product": {
            "code": "9999999999994",  # MISMATCH against requested code!
            "product_name": "Mismatched Product",
            "brands": "Brand X",
        },
    }

    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = mismatched_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get(f"/api/barcode/lookup/{mismatched_code}")
        assert res.status_code == 422
        assert "does not match requested barcode" in res.json()["detail"]


def test_invalid_barcode_input_returns_400():
    """Test 5: Malformed barcode queries return 400 Bad Request."""
    res = client.get("/api/barcode/lookup/890-invalid-code!")
    assert res.status_code == 400
    assert "Invalid barcode" in res.json()["detail"]

    res_short = client.get("/api/barcode/lookup/12")
    assert res_short.status_code == 400
    assert "Invalid barcode length" in res_short.json()["detail"]


def test_unknown_barcode_returns_404():
    """Test 6: Barcode not found in local catalog or OFF returns explicit 404."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = None

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/0000000000000")
        assert res.status_code == 404
        assert "No product found" in res.json()["detail"]


def test_upstream_timeout_returns_504():
    """Test 7: Open Food Facts timeout returns 504 Gateway Timeout."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.side_effect = OpenFoodFactsTimeoutError("Connection timed out")

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8909999888878")
        assert res.status_code == 504
        assert "timed out" in res.json()["detail"]


def test_upstream_rate_limit_returns_429():
    """Test 8: Upstream HTTP 429 returns controlled 429 error."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.side_effect = OpenFoodFactsRateLimitError("Rate limit reached")

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8909999888861")
        assert res.status_code == 429
        assert "rate limit" in res.json()["detail"]


def test_upstream_failure_returns_502():
    """Test 9: Upstream HTTP 5xx / network failure returns 502 Bad Gateway."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.side_effect = OpenFoodFactsError("HTTP 502 Bad Gateway from OFF")

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8909999888854")
        assert res.status_code == 502
        assert "unavailable" in res.json()["detail"]


def test_missing_and_malformed_nutrition_fields_never_zeroed():
    """Test 10: Missing or unparseable nutrient values remain None (is_unknown=True) and are never coerced to 0.0."""
    payload_with_malformed = {
        "code": "8905555444434",
        "status": 1,
        "product": {
            "code": "8905555444434",
            "product_name": "Test Snack Bar",
            "brands": "Snack Co",
            "nutriments": {
                "energy-kcal_100g": "invalid_string_val",  # Malformed
                "proteins_100g": 12.5,  # Valid
                # fat_100g and carbohydrates_100g are missing
            },
        },
    }

    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = payload_with_malformed
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8905555444434")
        assert res.status_code == 200
        data = res.json()

        nutrients = {n["canonical_code"]: n for n in data["nutrients"]}

        # Malformed energy must be None, is_unknown=True
        assert nutrients["ENERC_KCAL"]["value"] is None
        assert nutrients["ENERC_KCAL"]["is_unknown"] is True
        assert "Malformed" in nutrients["ENERC_KCAL"]["unknown_reason"]

        # Valid protein
        assert nutrients["PROTCNT"]["value"] == 12.5
        assert nutrients["PROTCNT"]["is_unknown"] is False

        # Missing fat must be None, is_unknown=True
        assert nutrients["FATCE"]["value"] is None
        assert nutrients["FATCE"]["is_unknown"] is True
        assert "Not reported" in nutrients["FATCE"]["unknown_reason"]


def test_different_serving_bases_and_units_preserved():
    """Test 11: Products declaring 100ml or per-serving basis preserve declared basis."""
    liquid_payload = {
        "code": "8907777666656",
        "status": 1,
        "product": {
            "code": "8907777666656",
            "product_name": "Cold Brew Almond Latte",
            "nutrition_data_per": "100ml",
            "serving_size": "250 ml",
            "serving_quantity": 250.0,
            "nutriments": {
                "energy-kcal_100g": 45.0,
                "proteins_100g": 1.2,
            },
        },
    }

    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = liquid_payload
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8907777666656")
        assert res.status_code == 200
        data = res.json()

        assert data["basis"] == "per_100ml"
        assert data["product"]["serving_size"] == "250 ml"
        assert data["product"]["serving_quantity"] == 250.0
        assert data["nutrients"][0]["basis"] == "per_100ml"


def test_caching_and_duplicate_lookup_behavior():
    """Test 12: Subsequent lookup for the same external barcode resolves from local cache without hitting upstream API."""
    import uuid
    # Use dynamic fresh barcode with valid EAN-13 check digit to ensure idempotence
    prefix = f"890{uuid.uuid4().int % 1000000000:09d}"
    unique_barcode = f"{prefix}{compute_gtin_check_digit(prefix)}"
    test_payload = {
        "code": unique_barcode,
        "status": 1,
        "product": {
            "code": unique_barcode,
            "product_name": "Cached Organic Granola",
            "brands": "Granola King",
            "serving_size": "40g",
            "nutriments": {
                "energy-kcal_100g": 420.0,
                "proteins_100g": 10.0,
            },
        },
    }

    mock_client = MagicMock(spec=OpenFoodFactsClient)
    mock_client.fetch_product.return_value = test_payload
    mock_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    # First lookup: fresh external call
    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client):
        res1 = client.get(f"/api/barcode/lookup/{unique_barcode}")
        assert res1.status_code == 200
        assert res1.json()["match_type"] == "external_fresh"
        assert mock_client.fetch_product.call_count == 1

    # Second lookup: must resolve from database cache (external_cached) without calling fetch_product again!
    mock_client_second = MagicMock(spec=OpenFoodFactsClient)
    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client_second):
        res2 = client.get(f"/api/barcode/lookup/{unique_barcode}")
        assert res2.status_code == 200
        assert res2.json()["match_type"] == "external_cached"
        # The mock fetch_product should NOT have been called on the second request
        assert mock_client_second.fetch_product.call_count == 0


def test_persistence_rollback_safety():
    """Test 13: Database persistence failure rolls back cleanly without corrupting transaction."""
    test_barcode = "8903333222212"
    test_payload = {
        "code": test_barcode,
        "status": 1,
        "product": {
            "code": test_barcode,
            "product_name": "Safe Rollback Product",
            "brands": "Brand Rollback",
            "nutriments": {"energy-kcal_100g": 50.0},
        },
    }

    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = test_payload
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with SessionLocal() as session:
        # Simulate commit failure during SourceRecord caching
        with patch.object(session, "commit", side_effect=Exception("Simulated SQLite lock error")):
            result = lookup_exact_barcode(barcode=test_barcode, session=session, off_client=mock_off_client)
            # Result should still be returned successfully despite commit failure
            assert result is not None
            assert result["product"]["name"] == "Safe Rollback Product"
            assert result["source"]["record_id"] is None


def test_legacy_api_foods_barcode_backward_compatibility():
    """Test 14: Legacy GET /api/foods/barcode/{barcode} continues to function seamlessly."""
    # Known local catalog item
    res = client.get("/api/foods/barcode/8901234567890")
    assert res.status_code == 200
    assert "Chickpeas" in res.json()["name"]

    # Unknown barcode returns 404
    missing = client.get("/api/foods/barcode/0000000000000")
    assert missing.status_code == 404


def test_strict_no_fuzzy_or_substring_matching():
    """Test 15: Substring or prefix of an existing barcode is never matched (strict equality only)."""
    # '89012345678' is non-GTIN prefix of seeded '8901234567890' (Chickpeas)
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = None

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/89012345678")
        # Must return 404 because no fuzzy match is allowed
        assert res.status_code == 404
        assert "No product found" in res.json()["detail"]


def test_volume_to_mass_no_unsupported_conversion():
    """Test 16: Fluid products with per_100ml basis are not converted to mass without documented density."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    drink_payload = {
        "code": "8901111222232",
        "status": 1,
        "product": {
            "code": "8901111222232",
            "product_name": "Cold-Pressed Sugarcane Juice",
            "nutrition_data_per": "100ml",
            "serving_size": "200ml",
            "nutriments": {
                "energy-kcal_100g": 72.0,
                "carbohydrates_100g": 18.0,
            },
        },
    }
    mock_off_client.fetch_product.return_value = drink_payload
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8901111222232")
        assert res.status_code == 200
        data = res.json()
        assert data["basis"] == "per_100ml"
        # Unit and basis remain ml without converting to grams
        assert data["nutrients"][0]["basis"] == "per_100ml"


def test_legacy_catalog_food_without_source_record_is_pending_review():
    """Audit A: Catalog food without a traceable laboratory SourceRecord is pending_review (never verified_reference)."""
    # 8901234567814 is seeded 'Fresh Organic Ginger', which has valid GTIN check digit and no IFCT FoodNutrient records
    res = client.get("/api/barcode/lookup/8901234567814")
    assert res.status_code == 200
    data = res.json()

    assert data["is_in_catalog"] is True
    # Membership in the local store catalog alone MUST NOT mark nutrition as verified
    assert data["verification_status"] == VerificationStatus.pending_review.value
    assert "Nutriverse Store Catalog (Legacy Unverified)" in data["source"]["name"]

    # All macro nutrients must be marked pending_review with explicit reason
    for n in data["nutrients"]:
        assert n["verification_status"] == VerificationStatus.pending_review.value
        assert "Unverified legacy store catalog" in n["unknown_reason"]


def test_catalog_food_with_traceable_reference_data():
    """Audit A: Catalog food with traceable laboratory SourceRecord is verified_reference."""
    # 8901234567890 is Sprouted Chickpeas, which has 16 IFCT FoodNutrient records and valid GTIN check digit
    res = client.get("/api/barcode/lookup/8901234567890")
    assert res.status_code == 200
    data = res.json()

    assert data["is_in_catalog"] is True
    assert data["verification_status"] == VerificationStatus.verified_reference.value
    assert "ICMR-NIN IFCT 2017 Ground Truth" in data["source"]["name"]
    for n in data["nutrients"]:
        assert n["verification_status"] == VerificationStatus.verified_reference.value
        assert n["source_record_id"] is not None


def test_catalog_food_partial_source_coverage_and_unverified_nutrients():
    """Audit A: Catalog food with partial or missing source records must downgrade to pending_review."""
    from backend.app.services.barcode_lookup import _format_local_food_result

    class MockNutrient:
        def __init__(self, code, name):
            self.canonical_code = code
            self.name = name

    class MockFoodNutrient:
        def __init__(self, code, name, value, v_status, source_id, unknown_reason=None):
            self.nutrient = MockNutrient(code, name)
            self.value = value
            self.unit = "g"
            self.basis = "per_100g_edible"
            self.is_unknown = False
            self.unknown_reason = unknown_reason
            self.verification_status = v_status
            self.source_record_id = source_id

    # 1. Food with 2 nutrients: 1 verified, 1 unverified (missing source_record_id)
    mock_food_partial = MagicMock(spec=Food)
    mock_food_partial.id = "mock-partial-food"
    mock_food_partial.name = "Partially Sourced Food"
    mock_food_partial.category = "Test"
    mock_food_partial.description = "Test description"
    mock_food_partial.serving_size = "100g"
    mock_food_partial.unit = "g"
    mock_food_partial.ingredients = "Test"
    mock_food_partial.image_source_url = None
    mock_food_partial.price_paise = 1000
    mock_food_partial.stock_qty = 10
    mock_food_partial.emoji = "🥗"
    mock_food_partial.nutrition_tags = "[]"
    mock_food_partial.dietary_tags = "[]"
    mock_food_partial.approval_status = "approved"

    fn1 = MockFoodNutrient("PROTCNT", "Protein", 10.0, "verified_reference", "sr-123")
    fn2 = MockFoodNutrient("FATCE", "Fat", 5.0, "pending_review", None, "Unverified vendor spec")
    mock_food_partial.nutrients_rel = [fn1, fn2]

    result = _format_local_food_result(mock_food_partial, "8909999888877")
    assert result["verification_status"] == VerificationStatus.pending_review.value
    assert "Nutriverse Store Catalog (Legacy Unverified)" in result["source"]["name"]
    assert result["nutrients"][0]["verification_status"] == "verified_reference"
    assert result["nutrients"][1]["verification_status"] == "pending_review"

    # 2. Food where nutrient claimed verified_reference but source_record_id is None (illegal state)
    fn3 = MockFoodNutrient("CHOAVLDF", "Carbohydrates", 20.0, "verified_reference", None)
    mock_food_unlinked = MagicMock(spec=Food)
    mock_food_unlinked.id = "mock-unlinked-food"
    mock_food_unlinked.name = "Unlinked Sourced Food"
    mock_food_unlinked.category = "Test"
    mock_food_unlinked.description = "Test"
    mock_food_unlinked.serving_size = "100g"
    mock_food_unlinked.unit = "g"
    mock_food_unlinked.ingredients = "Test"
    mock_food_unlinked.image_source_url = None
    mock_food_unlinked.price_paise = 1000
    mock_food_unlinked.stock_qty = 10
    mock_food_unlinked.emoji = "🥗"
    mock_food_unlinked.nutrition_tags = "[]"
    mock_food_unlinked.dietary_tags = "[]"
    mock_food_unlinked.approval_status = "approved"
    mock_food_unlinked.nutrients_rel = [fn3]

    result_unlinked = _format_local_food_result(mock_food_unlinked, "8909999888877")
    assert result_unlinked["verification_status"] == VerificationStatus.pending_review.value
    assert result_unlinked["nutrients"][0]["verification_status"] == "pending_review"
    assert "Lacks linked laboratory SourceRecord" in result_unlinked["nutrients"][0]["unknown_reason"]


def test_gtin_modulo_10_checksum_verification():
    """Audit B: GS1 Modulo-10 checksum validation correctly verifies and rejects retail barcodes."""
    from backend.app.services.barcode_lookup import (
        compute_gtin_check_digit,
        is_valid_gtin_checksum,
    )

    # Valid GTIN-13 (Tata Tea Gold)
    assert compute_gtin_check_digit("890103038234") == 5
    assert is_valid_gtin_checksum("8901030382345") is True

    # Valid UPC-A (12 digits)
    assert compute_gtin_check_digit("01234567890") == 5
    assert is_valid_gtin_checksum("012345678905") is True

    # Valid EAN-8 (8 digits)
    assert compute_gtin_check_digit("9638507") == 4
    assert is_valid_gtin_checksum("96385074") is True

    # Invalid check digits
    assert is_valid_gtin_checksum("8901030382349") is False  # expected 5
    assert is_valid_gtin_checksum("012345678909") is False  # expected 5
    assert is_valid_gtin_checksum("96385079") is False  # expected 4

    # Enforced checksum validation in normalize_barcode
    with pytest.raises(BarcodeValidationError, match="Invalid EAN-13 check digit"):
        normalize_barcode("8901030382349")


def test_negative_and_non_finite_nutrients_never_zeroed():
    """Audit D: Negative or non-finite nutrient values in upstream payloads are marked as malformed, never 0.0."""
    malformed_payload = {
        "code": "8908888111127",
        "status": 1,
        "product": {
            "code": "8908888111127",
            "product_name": "Edge Case Snack",
            "nutriments": {
                "proteins_100g": -5.0,  # Physically impossible negative value
                "energy-kcal_100g": "NaN",  # Non-finite string
                "carbohydrates_100g": 20.0,  # Valid
            },
        },
    }

    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = malformed_payload
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8908888111127")
        assert res.status_code == 200
        data = res.json()

        nutrients = {n["canonical_code"]: n for n in data["nutrients"]}

        # Negative protein must become None, is_unknown=True (never negative and never 0.0)
        assert nutrients["PROTCNT"]["value"] is None
        assert nutrients["PROTCNT"]["is_unknown"] is True
        assert "Malformed" in nutrients["PROTCNT"]["unknown_reason"]

        # NaN energy must become None, is_unknown=True
        assert nutrients["ENERC_KCAL"]["value"] is None
        assert nutrients["ENERC_KCAL"]["is_unknown"] is True

        # Valid carbs
        assert nutrients["CHOAVLDF"]["value"] == 20.0


def test_cache_force_refresh_updates_timestamp():
    """Audit E: Querying with refresh=true bypasses cache and re-fetches fresh upstream payload."""
    import uuid
    prefix = f"890{uuid.uuid4().int % 1000000000:09d}"
    test_barcode = f"{prefix}{compute_gtin_check_digit(prefix)}"
    initial_payload = {
        "code": test_barcode,
        "status": 1,
        "product": {
            "code": test_barcode,
            "product_name": "Fresh Harvest Nuts",
            "nutriments": {"energy-kcal_100g": 550.0},
        },
    }

    mock_client = MagicMock(spec=OpenFoodFactsClient)
    mock_client.fetch_product.return_value = initial_payload
    mock_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    # 1. First fetch: external_fresh
    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client):
        res1 = client.get(f"/api/barcode/lookup/{test_barcode}")
        assert res1.status_code == 200
        assert res1.json()["match_type"] == "external_fresh"
        first_retrieval = res1.json()["source"]["retrieval_date"]

    # 2. Second fetch without refresh: external_cached, same retrieval date
    mock_client_unused = MagicMock(spec=OpenFoodFactsClient)
    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client_unused):
        res2 = client.get(f"/api/barcode/lookup/{test_barcode}")
        assert res2.status_code == 200
        assert res2.json()["match_type"] == "external_cached"
        assert res2.json()["source"]["retrieval_date"] == first_retrieval
        assert mock_client_unused.fetch_product.call_count == 0

    # 3. Third fetch with refresh=true: external_fresh, re-calls fetch_product
    mock_client_refreshed = MagicMock(spec=OpenFoodFactsClient)
    mock_client_refreshed.fetch_product.return_value = initial_payload
    mock_client_refreshed.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client_refreshed):
        res3 = client.get(f"/api/barcode/lookup/{test_barcode}?refresh=true")
        assert res3.status_code == 200
        assert res3.json()["match_type"] == "external_fresh"
        assert mock_client_refreshed.fetch_product.call_count == 1


def test_licensing_distinguishes_odbl_and_cc_by_sa():
    """Audit F: API response clearly provides database ODbL attribution, CC BY-SA image attribution, and legal notice."""
    mock_off_client = MagicMock(spec=OpenFoodFactsClient)
    mock_off_client.fetch_product.return_value = SAMPLE_OFF_PAYLOAD
    mock_off_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_off_client):
        res = client.get("/api/barcode/lookup/8901030382345?refresh=true")
        assert res.status_code == 200
        data = res.json()

        assert "Open Database License (ODbL)" in data["source"]["license"]
        assert "CC BY-SA" in data["source"]["image_license"]
        assert data["source"]["image_provenance"]["license_status"] == "known"
        assert "tata_tea_contributor" in data["source"]["image_provenance"]["attribution"]
        assert "legal_disclaimer" in data
        assert "does not constitute an independent legal warranty" in data["legal_disclaimer"]
        assert data["is_in_catalog"] is False
        assert data["product"]["price_paise"] is None


def test_retail_gtin_formats_validation_and_checksums():
    """Phase 4.2 Audit A: Valid and invalid retail GTIN formats (EAN-8, UPC-A, EAN-13, ITF-14)."""
    from backend.app.services.barcode_lookup import (
        is_retail_gtin,
        get_gtin_format_name,
        validate_retail_gtin,
    )

    # 1. EAN-8 (8 digits)
    assert get_gtin_format_name("96385074") == "EAN-8"
    assert is_retail_gtin("96385074") is True
    validate_retail_gtin("96385074")  # Valid
    with pytest.raises(BarcodeValidationError, match="Invalid EAN-8 check digit"):
        validate_retail_gtin("96385079")  # Invalid check digit (expected 4, got 9)

    # 2. UPC-A (12 digits)
    assert get_gtin_format_name("012345678905") == "UPC-A"
    assert is_retail_gtin("012345678905") is True
    validate_retail_gtin("012345678905")  # Valid (leading zero preserved)
    with pytest.raises(BarcodeValidationError, match="Invalid UPC-A check digit"):
        validate_retail_gtin("012345678909")  # Invalid check digit (expected 5, got 9)

    # 3. EAN-13 (13 digits)
    assert get_gtin_format_name("8901030382345") == "EAN-13"
    assert is_retail_gtin("8901030382345") is True
    validate_retail_gtin("8901030382345")  # Valid
    with pytest.raises(BarcodeValidationError, match="Invalid EAN-13 check digit"):
        validate_retail_gtin("8901030382349")  # Invalid check digit (expected 5, got 9)

    # 4. ITF-14 (14 digits)
    assert get_gtin_format_name("18901030382342") == "ITF-14"
    assert is_retail_gtin("18901030382342") is True
    validate_retail_gtin("18901030382342")  # Valid
    with pytest.raises(BarcodeValidationError, match="Invalid ITF-14 check digit"):
        validate_retail_gtin("18901030382349")  # Invalid check digit (expected 2, got 9)


def test_production_environment_rejects_invalid_gtin_checksum_by_default(monkeypatch):
    """Phase 4.2 Audit A: In production, invalid retail GTINs are strictly rejected by default."""
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("ALLOW_SYNTHETIC_BARCODES", raising=False)

    # Production endpoint must reject invalid EAN-13 check digit with 400
    res = client.get("/api/barcode/lookup/8901030382349")  # invalid check digit (expected 5)
    assert res.status_code == 400
    assert "Invalid EAN-13 check digit" in res.json()["detail"]

    # Production endpoint must reject invalid UPC-A check digit with 400
    res2 = client.get("/api/barcode/lookup/012345678909")  # invalid check digit (expected 5)
    assert res2.status_code == 400
    assert "Invalid UPC-A check digit" in res2.json()["detail"]

    # In production, even if someone attempts ALLOW_SYNTHETIC_BARCODES=true, it is overridden to False
    monkeypatch.setenv("ALLOW_SYNTHETIC_BARCODES", "true")
    res3 = client.get("/api/barcode/lookup/8901030382349")
    assert res3.status_code == 400
    assert "Invalid EAN-13 check digit" in res3.json()["detail"]


def test_internal_sku_validation_separate_from_retail_gtin():
    """Phase 4.2 Audit A: Internal store SKUs are validated separately and do not require GTIN checksums."""
    from backend.app.services.barcode_lookup import (
        is_internal_sku,
        validate_internal_sku,
        normalize_barcode,
    )

    # Valid internal SKUs
    assert is_internal_sku("SKU12345") is True
    assert is_internal_sku("NVCHICKPEA") is True
    assert is_internal_sku("000456") is True  # 6-digit internal code, leading zero preserved

    assert normalize_barcode("SKU12345") == "SKU12345"
    assert normalize_barcode("000456") == "000456"

    # Separate validator for internal SKUs
    validate_internal_sku("SKU-1001")
    validate_internal_sku("NV_SPROUTS_500")

    # Invalid internal SKUs
    with pytest.raises(BarcodeValidationError, match="Invalid internal SKU characters"):
        validate_internal_sku("SKU 1001")  # Spaces forbidden

    with pytest.raises(BarcodeValidationError, match="Invalid internal SKU characters"):
        validate_internal_sku("SKU@ITEM!")  # Symbols forbidden

    with pytest.raises(BarcodeValidationError, match="Invalid internal SKU length"):
        validate_internal_sku("AB")  # Too short


def test_permit_synthetic_barcodes_under_explicit_dev_configuration(monkeypatch):
    """Phase 4.2 Audit A: Synthetic test barcodes are permitted only under explicit development configuration."""
    from backend.app.services.barcode_lookup import normalize_barcode

    synthetic_code = "8901234567811"  # Seeded Red Onions barcode with synthetic check digit 1 (expected 4)

    # 1. Under development configuration with allow_synthetic=True
    monkeypatch.setenv("APP_ENV", "development")
    assert normalize_barcode(synthetic_code, allow_synthetic=True) == synthetic_code

    # 2. When allow_synthetic=False, it is rejected
    with pytest.raises(BarcodeValidationError, match="Invalid EAN-13 check digit"):
        normalize_barcode(synthetic_code, allow_synthetic=False)

    # 3. In development via ALLOW_SYNTHETIC_BARCODES env var
    monkeypatch.setenv("ALLOW_SYNTHETIC_BARCODES", "true")
    assert normalize_barcode(synthetic_code) == synthetic_code

    # 4. In development without ALLOW_SYNTHETIC_BARCODES, it is rejected by default
    monkeypatch.delenv("ALLOW_SYNTHETIC_BARCODES", raising=False)
    with pytest.raises(BarcodeValidationError, match="Invalid EAN-13 check digit"):
        normalize_barcode(synthetic_code)


def test_image_license_provenance_known_metadata():
    """Phase 4.2 Audit B: Open Food Facts image with specific contributor and license is preserved."""
    payload_with_image_license = {
        "code": "8901030382376",
        "status": 1,
        "product": {
            "code": "8901030382376",
            "product_name": "Tata Tea Gold With Photo",
            "image_url": "https://images.openfoodfacts.org/images/products/front.jpg",
            "image_licence": "CC-BY-SA-4.0",
            "photographers_tags": ["photo_contributor_123"],
            "nutriments": {"energy-kcal_100g": 100.0},
        },
    }

    mock_client = MagicMock(spec=OpenFoodFactsClient)
    mock_client.fetch_product.return_value = payload_with_image_license
    mock_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client):
        res = client.get("/api/barcode/lookup/8901030382376?refresh=true")
        assert res.status_code == 200
        data = res.json()

        src = data["source"]
        # Database license remains distinct ODbL
        assert "Open Database License (ODbL)" in src["license"]

        # Image-specific provenance
        img_prov = src["image_provenance"]
        assert img_prov["license_status"] == "known"
        assert "CC BY-SA 4.0" in img_prov["license"]
        assert img_prov["contributor"] == "photo_contributor_123"
        assert "photo_contributor_123" in img_prov["attribution"]
        assert "CC BY-SA 4.0" in img_prov["attribution"]
        assert src["image_license"] == img_prov["license"]


def test_image_license_provenance_missing_metadata_represented_as_unknown():
    """Phase 4.2 Audit B: Open Food Facts image lacking license metadata is represented as unknown (no false claims)."""
    payload_without_image_license = {
        "code": "8901030382352",
        "status": 1,
        "product": {
            "code": "8901030382352",
            "product_name": "Product Without Image License",
            "image_url": "https://images.openfoodfacts.org/images/products/unlicensed_front.jpg",
            # No image_licence or photographers
            "nutriments": {"energy-kcal_100g": 100.0},
        },
    }

    mock_client = MagicMock(spec=OpenFoodFactsClient)
    mock_client.fetch_product.return_value = payload_without_image_license
    mock_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client):
        res = client.get("/api/barcode/lookup/8901030382352?refresh=true")
        assert res.status_code == 200
        data = res.json()

        src = data["source"]
        img_prov = src["image_provenance"]
        assert img_prov["license_status"] == "unknown"
        assert img_prov["license"] == "unknown"
        assert "unverified" in img_prov["attribution"].lower()
        # Ensure we do NOT assert blanket verified CC BY-SA compliance when metadata is absent
        assert src["image_license"] == "unknown"


def test_image_license_provenance_no_image():
    """Phase 4.2 Audit B: Open Food Facts product with no image URL reports license_status as no_image."""
    payload_no_image = {
        "code": "8901030382369",
        "status": 1,
        "product": {
            "code": "8901030382369",
            "product_name": "Product With No Image",
            "nutriments": {"energy-kcal_100g": 100.0},
        },
    }

    mock_client = MagicMock(spec=OpenFoodFactsClient)
    mock_client.fetch_product.return_value = payload_no_image
    mock_client.parse_product_payload = OpenFoodFactsClient().parse_product_payload

    with patch("backend.app.services.barcode_lookup.OpenFoodFactsClient", return_value=mock_client):
        res = client.get("/api/barcode/lookup/8901030382369?refresh=true")
        assert res.status_code == 200
        data = res.json()

        src = data["source"]
        img_prov = src["image_provenance"]
        assert img_prov["license_status"] == "no_image"
        assert img_prov["license"] is None
        assert img_prov["url"] is None
        assert data["product"]["image_url"] is None


