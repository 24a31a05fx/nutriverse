import sys
import pytest
from backend.app.main import limiter, seed_initial_data


@pytest.fixture(scope="session", autouse=True)
def init_db_data():
    """Ensure seeded initial data exists across both SQLite and Postgres."""
    seed_initial_data()


@pytest.fixture(autouse=True)
def reset_state_each_test():
    """Ensure slowapi rate limiter and all test client cookies are cleanly reset for each test."""
    limiter.reset()
    for mod in list(sys.modules.values()):
        if hasattr(mod, "client") and hasattr(getattr(mod, "client"), "cookies"):
            getattr(mod, "client").cookies.clear()
    yield
    limiter.reset()
    for mod in list(sys.modules.values()):
        if hasattr(mod, "client") and hasattr(getattr(mod, "client"), "cookies"):
            getattr(mod, "client").cookies.clear()
