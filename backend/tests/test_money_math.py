"""Unit tests for integer paise money maths (strictly no floating-point currency calculations)."""
import pytest


def calculate_line_item(unit_price_paise: int, quantity: int) -> int:
    assert isinstance(unit_price_paise, int), f"Unit price must be integer paise, got {type(unit_price_paise)}"
    assert isinstance(quantity, int), f"Quantity must be integer, got {type(quantity)}"
    total = unit_price_paise * quantity
    assert isinstance(total, int)
    return total


def calculate_basket_delivery_fee(subtotal_paise: int) -> int:
    assert isinstance(subtotal_paise, int), f"Subtotal must be integer paise, got {type(subtotal_paise)}"
    if subtotal_paise == 0:
        return 0
    # Free delivery at or above ₹800 (80,000 paise), else ₹49 (4,900 paise)
    return 0 if subtotal_paise >= 80000 else 4900


def calculate_discounted_bundle(component_sum_paise: int, base_tier_paise: int) -> int:
    assert isinstance(component_sum_paise, int)
    assert isinstance(base_tier_paise, int)
    # 15% bundle savings calculated via pure integer arithmetic: (sum * 85) // 100
    discounted = (component_sum_paise * 85) // 100
    bundle_price = max(base_tier_paise, discounted)
    assert isinstance(bundle_price, int)
    return bundle_price


def calculate_gst_amount(price_paise: int, gst_rate_percent: int) -> int:
    assert isinstance(price_paise, int)
    assert isinstance(gst_rate_percent, int)
    # Integer division with standard round-half-up: (price * rate + 50) // 100
    gst_paise = (price_paise * gst_rate_percent + 50) // 100
    assert isinstance(gst_paise, int)
    return gst_paise


def test_line_item_math_strictly_integer():
    unit_price = 19900  # ₹199.00
    for qty in [1, 2, 5, 10, 100]:
        total = calculate_line_item(unit_price, qty)
        assert isinstance(total, int)
        assert total == unit_price * qty
        assert not isinstance(total, float)


def test_delivery_fee_thresholds_exact_paise():
    # 0 cart -> 0 fee
    assert calculate_basket_delivery_fee(0) == 0

    # Below ₹800 (e.g. ₹799 = 79,900 paise) -> ₹49 (4,900 paise)
    assert calculate_basket_delivery_fee(79900) == 4900
    assert calculate_basket_delivery_fee(100) == 4900

    # Exactly ₹800 (80,000 paise) -> FREE
    assert calculate_basket_delivery_fee(80000) == 0

    # Above ₹800 (e.g. ₹801 = 80,100 paise) -> FREE
    assert calculate_basket_delivery_fee(80100) == 0
    assert calculate_basket_delivery_fee(150000) == 0


def test_bundle_discount_math_no_floats():
    base_tier = 69900  # Basic pack base ₹699
    # Component sum ₹800 -> 80,000 paise * 85 // 100 = 68,000 paise -> capped at base 69,900
    assert calculate_discounted_bundle(80000, base_tier) == 69900

    # Component sum ₹1,000 -> 100,000 paise * 85 // 100 = 85,000 paise
    assert calculate_discounted_bundle(100000, base_tier) == 85000

    # Test uneven amount
    uneven_sum = 123456
    bundle = calculate_discounted_bundle(uneven_sum, base_tier)
    assert isinstance(bundle, int)
    assert bundle == (uneven_sum * 85) // 100


def test_gst_calculation_strictly_integer():
    # 5% GST on 19,900 paise (₹199): 19900 * 5 = 99500 -> (99500 + 50) // 100 = 995 paise (₹9.95)
    gst_5 = calculate_gst_amount(19900, 5)
    assert isinstance(gst_5, int)
    assert gst_5 == 995

    # 18% GST on 100,000 paise (₹1,000): 18,000 paise (₹180)
    gst_18 = calculate_gst_amount(100000, 18)
    assert isinstance(gst_18, int)
    assert gst_18 == 18000


def test_invariance_upgrade_and_downgrade_multipliers():
    inr_samples = [0, 1, 49, 129, 199, 699, 1099, 1699, 5000, 99999]
    for inr in inr_samples:
        paise = inr * 100
        assert isinstance(paise, int)
        reverted_inr = paise // 100
        assert isinstance(reverted_inr, int)
        assert reverted_inr == inr
