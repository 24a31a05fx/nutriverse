import os
import sys

# Ensure test suite runs deterministically:
# 1. Respect explicit TEST_DATABASE_URL if provided
# 2. In CI (GitHub Actions), respect DATABASE_URL (SQLite or PostgreSQL)
# 3. For local development where PostgreSQL is not running, fall back to SQLite
is_ci = os.environ.get("CI") == "true" or os.environ.get("GITHUB_ACTIONS") == "true"
test_db_url = os.environ.get("TEST_DATABASE_URL")

if test_db_url:
    os.environ["DATABASE_URL"] = test_db_url
elif not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///./nutriverse.db"
elif "postgresql" in os.environ.get("DATABASE_URL", "") and not is_ci and os.environ.get("LIVE_POSTGRES") != "1":
    os.environ["DATABASE_URL"] = "sqlite:///./nutriverse.db"

if not os.environ.get("REDIS_URL"):
    os.environ["REDIS_URL"] = "memory://"

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
