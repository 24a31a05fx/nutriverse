import pytest
from backend.app.main import limiter


@pytest.fixture(autouse=True)
def reset_limiter_each_test():
    """Ensure slowapi in-memory rate limiter is cleanly reset for each test."""
    limiter.reset()
    yield
    limiter.reset()
