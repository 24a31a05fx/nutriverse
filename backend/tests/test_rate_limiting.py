"""Tests for slowapi rate limiting, IP extraction, and TRUSTED_PROXY header validation."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app, limiter, settings


@pytest.fixture(autouse=True)
def clean_rate_limits():
    """Ensure rate limiter state is reset before and after each test."""
    limiter.reset()
    yield
    limiter.reset()


def test_rate_limit_429_on_login_abuse():
    """Verify that exceeding login rate limit returns HTTP 429 Too Many Requests."""
    orig_limit = settings.rate_limit_login
    settings.rate_limit_login = "3/minute"
    try:
        # Use a designated test client IP
        test_client = TestClient(app, client=("198.51.100.1", 50000))
        
        # 3 attempts should be processed by auth handler (returning 401 for invalid credentials)
        for _ in range(3):
            res = test_client.post(
                "/api/auth/login",
                json={"email": "nonexistent@nutriverse.local", "password": "BadPassword123!"},
            )
            assert res.status_code == 401, f"Expected 401, got {res.status_code}"

        # 4th attempt should be blocked with 429 by slowapi
        res_blocked = test_client.post(
            "/api/auth/login",
            json={"email": "nonexistent@nutriverse.local", "password": "BadPassword123!"},
        )
        assert res_blocked.status_code == 429, f"Expected 429, got {res_blocked.status_code}"
    finally:
        settings.rate_limit_login = orig_limit


def test_rate_limit_429_on_ai_chat_abuse():
    """Verify that exceeding AI chat rate limit returns HTTP 429."""
    orig_limit = settings.rate_limit_ai_chat
    settings.rate_limit_ai_chat = "2/minute"
    try:
        test_client = TestClient(app, client=("198.51.100.2", 50000))
        # Log in as Alex to get access token
        login_res = test_client.post(
            "/api/auth/login",
            json={"email": "alex@nutriverse.local", "password": "Customer123!"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request 1 & 2 succeed
        r1 = test_client.post("/api/ai/chat?question=tell+me+about+chia+seeds", headers=headers)
        assert r1.status_code == 200
        r2 = test_client.post("/api/ai/chat?question=tell+me+about+calin+pack", headers=headers)
        assert r2.status_code == 200

        # Request 3 is rate limited
        r3 = test_client.post("/api/ai/chat?question=tell+me+about+turmeric", headers=headers)
        assert r3.status_code == 429
    finally:
        settings.rate_limit_ai_chat = orig_limit


def test_two_different_ips_limited_independently():
    """Verify that rate limits are tracked per client IP and do not cross-contaminate."""
    orig_limit = settings.rate_limit_login
    settings.rate_limit_login = "2/minute"
    try:
        client_ip_a = TestClient(app, client=("192.168.10.1", 50000))
        client_ip_b = TestClient(app, client=("192.168.10.2", 50000))

        # Client A consumes its 2 requests
        r_a1 = client_ip_a.post("/api/auth/login", json={"email": "a@test.local", "password": "Pwd!"})
        assert r_a1.status_code == 401
        r_a2 = client_ip_a.post("/api/auth/login", json={"email": "a@test.local", "password": "Pwd!"})
        assert r_a2.status_code == 401

        # Client A is now rate-limited
        r_a3 = client_ip_a.post("/api/auth/login", json={"email": "a@test.local", "password": "Pwd!"})
        assert r_a3.status_code == 429

        # Client B has NOT consumed any requests yet and should NOT be rate limited
        r_b1 = client_ip_b.post("/api/auth/login", json={"email": "b@test.local", "password": "Pwd!"})
        assert r_b1.status_code == 401
    finally:
        settings.rate_limit_login = orig_limit


def test_spoofed_x_forwarded_for_ignored_when_trusted_proxy_unset():
    """Verify spoofed X-Forwarded-For headers are ignored when TRUSTED_PROXY is unset."""
    orig_proxy = settings.trusted_proxy
    orig_limit = settings.rate_limit_login
    settings.trusted_proxy = None
    settings.rate_limit_login = "2/minute"
    try:
        # Same underlying connection IP sending different spoofed X-Forwarded-For headers
        client = TestClient(app, client=("198.51.100.99", 50000))

        # Request 1 with spoofed IP 1.1.1.1
        r1 = client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "1.1.1.1"},
        )
        assert r1.status_code == 401

        # Request 2 with spoofed IP 2.2.2.2
        r2 = client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "2.2.2.2"},
        )
        assert r2.status_code == 401

        # Request 3 with spoofed IP 3.3.3.3 should STILL be blocked with 429
        # because the server ignores X-Forwarded-For and identifies the socket client as 198.51.100.99
        r3 = client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "3.3.3.3"},
        )
        assert r3.status_code == 429
    finally:
        settings.trusted_proxy = orig_proxy
        settings.rate_limit_login = orig_limit


def test_trusted_proxy_reads_client_ip_from_x_forwarded_for():
    """Verify that when TRUSTED_PROXY is configured, X-Forwarded-For determines client IP."""
    orig_proxy = settings.trusted_proxy
    orig_limit = settings.rate_limit_login
    settings.trusted_proxy = "127.0.0.1"
    settings.rate_limit_login = "2/minute"
    try:
        # Requests coming through the proxy connection
        proxy_client = TestClient(app, client=("127.0.0.1", 50000))

        # Real Client X through proxy
        r_x1 = proxy_client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        assert r_x1.status_code == 401
        r_x2 = proxy_client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        assert r_x2.status_code == 401

        # Client X gets 429
        r_x3 = proxy_client.post(
            "/api/auth/login",
            json={"email": "x@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "203.0.113.10"},
        )
        assert r_x3.status_code == 429

        # Real Client Y through proxy on a different forwarded IP still has quota
        r_y1 = proxy_client.post(
            "/api/auth/login",
            json={"email": "y@test.local", "password": "Pwd!"},
            headers={"X-Forwarded-For": "203.0.113.20"},
        )
        assert r_y1.status_code == 401
    finally:
        settings.trusted_proxy = orig_proxy
        settings.rate_limit_login = orig_limit
