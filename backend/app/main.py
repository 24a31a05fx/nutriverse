from __future__ import annotations

import hashlib
import inspect
import json
import os
import re
import secrets
import typing
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any, Dict, Generator, List, Optional, Union
from uuid import uuid4

import bcrypt
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from jose import JWTError, jwt
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    select,
    update,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
    validates,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "production"
    database_url: str = "sqlite:///./nutriverse.db"
    jwt_secret: str = ""
    jwt_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    rate_limit_login: str = "5/minute"
    rate_limit_register: str = "5/minute"
    rate_limit_refresh: str = "10/minute"
    rate_limit_ai_chat: str = "10/minute"
    trusted_proxy: Optional[str] = None
    redis_url: Optional[str] = None
    allow_synthetic_barcodes: bool = False


INSECURE_JWT_SECRETS = {
    "change-this-in-production-long-secure-key",
    "nutriverse_dev_secret_key_change_in_production_12345",
    "replace-with-a-long-random-secret",
    "secret",
    "jwtsecret",
    "default_secret",
    "your-secret-key-here",
    "changeme",
    "password",
    "12345678901234567890123456789012",
}


def get_jwt_secret(current_settings: Optional[Settings] = None) -> str:
    s = current_settings or settings
    sec = (s.jwt_secret or "").strip()
    if sec:
        return sec
    if s.app_env == "development":
        return "nutriverse_dev_secret_key_change_in_production_12345"
    return ""


def validate_secret_safety(current_settings: Settings) -> None:
    if current_settings.app_env != "development":
        sec = (current_settings.jwt_secret or "").strip()
        if not sec or sec in INSECURE_JWT_SECRETS or len(sec) < 32:
            raise RuntimeError(
                f"CRITICAL SECRET SAFETY FAILURE: In '{current_settings.app_env}' environment, "
                f"JWT_SECRET must be set to a cryptographically secure string of at least 32 characters "
                f"and cannot be a known insecure default."
            )


settings = Settings()


def get_client_ip(request: Request) -> str:
    # Behind the Next.js proxy, read the client IP from X-Forwarded-For only when TRUSTED_PROXY is configured
    trusted_proxy = settings.trusted_proxy or os.environ.get("TRUSTED_PROXY")
    if trusted_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


redis_storage = settings.redis_url or os.environ.get("REDIS_URL")
if redis_storage and redis_storage.startswith(("redis://", "rediss://")):
    try:
        import redis
        _r = redis.from_url(redis_storage, socket_connect_timeout=0.5)
        _r.ping()
        limiter = Limiter(
            key_func=get_client_ip,
            storage_uri=redis_storage,
            swallow_errors=True,
            in_memory_fallback_enabled=True,
        )
    except Exception:
        limiter = Limiter(key_func=get_client_ip)
elif redis_storage and redis_storage.startswith("memory://"):
    limiter = Limiter(key_func=get_client_ip, storage_uri="memory://")
else:
    limiter = Limiter(key_func=get_client_ip)


def rate_limit_endpoint(decorator: Any) -> Any:
    """Preserves resolved type annotations and FastAPI signatures for slowapi-wrapped endpoints under string annotations."""
    def wrap(fn: Any) -> Any:
        typed_hints = typing.get_type_hints(fn, fn.__globals__)
        raw_sig = inspect.signature(fn)
        decorated = decorator(fn)
        decorated.__signature__ = inspect.Signature(
            [
                inspect.Parameter(
                    p.name,
                    p.kind,
                    default=p.default,
                    annotation=typed_hints.get(p.name, p.annotation),
                )
                for p in raw_sig.parameters.values()
            ],
            return_annotation=typed_hints.get("return", raw_sig.return_annotation),
        )
        return decorated
    return wrap
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
ALGORITHM = "HS256"


class PasswordHasher:
    @staticmethod
    def hash(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        try:
            if hashed.startswith("$2a$") or hashed.startswith("$2b$"):
                return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
            elif hashed.startswith("$pbkdf2-sha256$"):
                return pbkdf2_sha256.verify(password, hashed)
            return False
        except Exception:
            return False

    @staticmethod
    def needs_rehash(hashed: str) -> bool:
        return not (hashed.startswith("$2b$") or hashed.startswith("$2a$"))


class Base(DeclarativeBase):
    pass


class Role(str, Enum):
    user = "user"
    nutritionist = "nutritionist"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=Role.user.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    verification_reviews: Mapped[List[VerificationRecord]] = relationship(
        "VerificationRecord", back_populates="reviewer"
    )
    daily_food_logs: Mapped[List[DailyFoodLog]] = relationship(
        "DailyFoodLog", back_populates="user", cascade="all, delete-orphan"
    )


class NutritionProfile(Base):
    __tablename__ = "nutrition_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[str] = mapped_column(String(20))
    height_cm: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float)
    activity_level: Mapped[float] = mapped_column(Float)
    calorie_target: Mapped[int] = mapped_column(Integer)
    bmr: Mapped[int] = mapped_column(Integer, default=0)
    food_preferences: Mapped[str] = mapped_column(Text, default="All foods")
    allergies: Mapped[str] = mapped_column(Text, default="None")
    budget_paise: Mapped[int] = mapped_column(Integer, default=150000)
    goal: Mapped[str] = mapped_column(String(80), default="Balanced Nourishment")
    calculation_version: Mapped[str] = mapped_column(String(20), default="mifflin-st-jeor-v1")
    consent_revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Food(Base):
    __tablename__ = "foods"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)  # Conventional category (Legumes, Greens, etc.)
    nutrition_tags: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of tags: protein_rich, fiber_rich, etc.
    description: Mapped[str] = mapped_column(Text, default="")
    price_paise: Mapped[int] = mapped_column(Integer, default=19900)
    gst_rate_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    unit: Mapped[str] = mapped_column(String(40), default="500g")
    serving_size: Mapped[str] = mapped_column(String(40), default="100g")
    stock_qty: Mapped[int] = mapped_column(Integer, default=50)
    calories: Mapped[float] = mapped_column(Float, default=0)
    protein_g: Mapped[float] = mapped_column(Float, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0)
    fat_g: Mapped[float] = mapped_column(Float, default=0)
    fibre_g: Mapped[float] = mapped_column(Float, default=0)
    vitamins_json: Mapped[str] = mapped_column(Text, default="{}")
    ingredients: Mapped[str] = mapped_column(Text, default="")
    storage_info: Mapped[str] = mapped_column(Text, default="Store in a cool, dry place.")
    prep_methods: Mapped[str] = mapped_column(Text, default='["Raw","Soaked","Boiled"]')
    dietary_tags: Mapped[str] = mapped_column(Text, default='["Vegetarian"]')
    emoji: Mapped[str] = mapped_column(String(10), default="🥗")
    image_alt: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    image_source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_license: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    image_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(30), default="pending")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    nutrients_rel: Mapped[List[FoodNutrient]] = relationship(
        "FoodNutrient", back_populates="food", cascade="all, delete-orphan"
    )
    calin_pack_items: Mapped[List[CalinPackItem]] = relationship(
        "CalinPackItem", back_populates="food", cascade="all, delete-orphan"
    )


class Recipe(Base):
    __tablename__ = "recipes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str] = mapped_column(Text)
    instructions: Mapped[str] = mapped_column(Text)
    prep_method: Mapped[str] = mapped_column(String(80), default="Quick Sauté & Simmer")
    prep_time_mins: Mapped[int] = mapped_column(Integer, default=20)
    servings: Mapped[int] = mapped_column(Integer, default=2)
    calories: Mapped[float] = mapped_column(Float, default=350)
    protein_g: Mapped[float] = mapped_column(Float, default=15)
    emoji: Mapped[str] = mapped_column(String(10), default="🍲")
    ingredients_json: Mapped[str] = mapped_column(Text, default="[]")  # list of {name, qty, unit, food_id}
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"
    __table_args__ = (Index("ix_recipe_ingredients_recipe", "recipe_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    recipe_id: Mapped[str] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"))
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"))
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(40), default="serving")


class ProductPairing(Base):
    __tablename__ = "product_pairings"
    __table_args__ = (Index("ix_product_pairings_pair", "food_id", "paired_food_id", unique=True),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"))
    paired_food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"))
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class CalinPackTier(Base):
    __tablename__ = "calin_pack_tiers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tier: Mapped[str] = mapped_column(String(40), unique=True)  # basic, minimal_plus, premium
    name: Mapped[str] = mapped_column(String(80))
    base_price_paise: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    target_audience: Mapped[str] = mapped_column(Text)
    max_substitutions: Mapped[int] = mapped_column(Integer, default=2)
    items_json: Mapped[str] = mapped_column(Text, default="[]")  # list of food names/ids with qty
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    items_rel: Mapped[List[CalinPackItem]] = relationship(
        "CalinPackItem", back_populates="pack_tier", cascade="all, delete-orphan"
    )


class VerificationStatus(str, Enum):
    verified_reference = "verified_reference"
    label_derived = "label_derived"
    source_reported = "source_reported"
    pending_review = "pending_review"
    rejected = "rejected"


ALLOWED_VERIFICATION_STATUSES = {
    VerificationStatus.verified_reference.value,
    VerificationStatus.label_derived.value,
    VerificationStatus.source_reported.value,
    VerificationStatus.pending_review.value,
    VerificationStatus.rejected.value,
}


class DataSource(Base):
    __tablename__ = "data_sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    publisher: Mapped[str] = mapped_column(String(200))
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    license: Mapped[str] = mapped_column(String(120))
    license_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    terms_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    source_records: Mapped[List[SourceRecord]] = relationship(
        "SourceRecord", back_populates="data_source", cascade="all, delete-orphan"
    )


class SourceRecord(Base):
    __tablename__ = "source_records"
    __table_args__ = (
        Index("ix_source_records_source_external", "source_id", "external_id", unique=True),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str] = mapped_column(ForeignKey("data_sources.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(120), index=True)
    external_name: Mapped[str] = mapped_column(String(255))
    raw_payload: Mapped[str] = mapped_column(Text, default="{}")
    raw_checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    retrieval_date: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    data_source: Mapped[DataSource] = relationship("DataSource", back_populates="source_records")
    food_nutrients: Mapped[List[FoodNutrient]] = relationship("FoodNutrient", back_populates="source_record")


class Nutrient(Base):
    __tablename__ = "nutrients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    canonical_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(50), default="macronutrient", index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    applicable_basis: Mapped[str] = mapped_column(String(50), default="per_100g_edible")
    icmr_rda_adult_male: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    icmr_rda_adult_female: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    food_nutrients: Mapped[List[FoodNutrient]] = relationship(
        "FoodNutrient", back_populates="nutrient", cascade="all, delete-orphan"
    )


class FoodNutrient(Base):
    __tablename__ = "food_nutrients"
    __table_args__ = (
        Index("ix_food_nutrients_food_nutrient_state", "food_id", "nutrient_id", "food_state", "basis", unique=True),
        Index("ix_food_nutrients_verification_status", "verification_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"), index=True)
    nutrient_id: Mapped[str] = mapped_column(ForeignKey("nutrients.id", ondelete="RESTRICT"), index=True)
    source_record_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("source_records.id", ondelete="SET NULL"), nullable=True, index=True
    )
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(20))
    basis: Mapped[str] = mapped_column(String(50), default="per_100g_edible")
    food_state: Mapped[str] = mapped_column(String(50), default="raw")
    verification_status: Mapped[str] = mapped_column(String(40), default=VerificationStatus.pending_review.value)
    is_unknown: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    unknown_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    food: Mapped[Food] = relationship("Food", back_populates="nutrients_rel")
    nutrient: Mapped[Nutrient] = relationship("Nutrient", back_populates="food_nutrients")
    source_record: Mapped[Optional[SourceRecord]] = relationship("SourceRecord", back_populates="food_nutrients")
    verification_records: Mapped[List[VerificationRecord]] = relationship(
        "VerificationRecord", back_populates="food_nutrient", cascade="all, delete-orphan"
    )

    @validates("verification_status")
    def validate_verification_status(self, key: str, value: str) -> str:
        if value not in ALLOWED_VERIFICATION_STATUSES:
            raise ValueError(
                f"Invalid verification_status '{value}'. Must be one of {sorted(list(ALLOWED_VERIFICATION_STATUSES))}"
            )
        return value

    @validates("value")
    def validate_value(self, key: str, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Nutrient value cannot be negative.")
        return value


class VerificationRecord(Base):
    __tablename__ = "verification_records"
    __table_args__ = (
        Index("ix_verification_records_food_nutrient", "food_nutrient_id"),
        Index("ix_verification_records_reviewer", "reviewer_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    food_nutrient_id: Mapped[str] = mapped_column(ForeignKey("food_nutrients.id", ondelete="CASCADE"))
    reviewer_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40))
    evidence: Mapped[str] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    previous_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    food_nutrient: Mapped[FoodNutrient] = relationship("FoodNutrient", back_populates="verification_records")
    reviewer: Mapped[Optional[User]] = relationship("User", back_populates="verification_reviews")

    @validates("status")
    def validate_status(self, key: str, value: str) -> str:
        if value not in ALLOWED_VERIFICATION_STATUSES:
            raise ValueError(
                f"Invalid status '{value}'. Must be one of {sorted(list(ALLOWED_VERIFICATION_STATUSES))}"
            )
        return value


class CalinPackItem(Base):
    __tablename__ = "calin_pack_items"
    __table_args__ = (
        Index("ix_calin_pack_items_tier_food", "pack_tier_id", "food_id", unique=True),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    pack_tier_id: Mapped[str] = mapped_column(ForeignKey("calin_pack_tiers.id", ondelete="CASCADE"), index=True)
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(40), default="unit")
    role_in_pack: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    is_essential: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    pack_tier: Mapped[CalinPackTier] = relationship("CalinPackTier", back_populates="items_rel")
    food: Mapped[Food] = relationship("Food", back_populates="calin_pack_items")


class CartItem(Base):
    __tablename__ = "cart_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_type: Mapped[str] = mapped_column(String(20), default="food")  # food | pack
    food_id: Mapped[Optional[str]] = mapped_column(ForeignKey("foods.id"), nullable=True)
    pack_tier: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    pack_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    customization_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit_price_paise: Mapped[int] = mapped_column(Integer, default=0)
    quantity: Mapped[int] = mapped_column(Integer, default=1)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (Index("ix_orders_user_id_status", "user_id", "status"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="placed")  # placed, confirmed, preparing, out_for_delivery, delivered, cancelled
    subtotal_paise: Mapped[int] = mapped_column(Integer, default=0)
    delivery_fee_paise: Mapped[int] = mapped_column(Integer, default=0)
    total_paise: Mapped[int] = mapped_column(Integer)
    items_json: Mapped[str] = mapped_column(Text, default="[]")
    delivery_address_json: Mapped[str] = mapped_column(Text, default="{}")
    demo_payment: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Address(Base):
    __tablename__ = "addresses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(40), default="Home")
    line1: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    postal_code: Mapped[str] = mapped_column(String(12))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pack_tier: Mapped[str] = mapped_column(String(40))
    pack_name: Mapped[str] = mapped_column(String(80))
    frequency: Mapped[str] = mapped_column(String(30), default="weekly")  # weekly, bi_weekly, monthly
    status: Mapped[str] = mapped_column(String(30), default="active")  # active, paused, cancelled
    price_per_delivery_paise: Mapped[int] = mapped_column(Integer)
    next_delivery_date: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class NutritionistReviewRequest(Base):
    __tablename__ = "nutritionist_review_requests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_name: Mapped[str] = mapped_column(String(120))
    pack_tier: Mapped[str] = mapped_column(String(40))
    customer_notes: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending, reviewed
    guidance_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposed_changes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consent_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nutritionist_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    nutritionist_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class NotifyRequest(Base):
    __tablename__ = "notify_requests"
    __table_args__ = (Index("ix_notify_requests_food_email", "food_id", "email"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(80))
    details: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user_family_hash", "user_id", "family_id", "token_hash"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True, default=lambda: str(uuid4()))
    token_hash: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class DailyFoodLog(Base):
    __tablename__ = "daily_food_logs"
    __table_args__ = (
        Index("ix_daily_food_logs_user_date", "user_id", "date"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    food_id: Mapped[Optional[str]] = mapped_column(ForeignKey("foods.id", ondelete="SET NULL"), nullable=True, index=True)
    food_name: Mapped[str] = mapped_column(String(255))
    meal_type: Mapped[str] = mapped_column(String(50), default="lunch")
    quantity: Mapped[float] = mapped_column(Float, default=100.0)
    unit: Mapped[str] = mapped_column(String(30), default="g")
    mass_g: Mapped[float] = mapped_column(Float, default=100.0)
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    protein_g: Mapped[float] = mapped_column(Float, default=0.0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0.0)
    fat_g: Mapped[float] = mapped_column(Float, default=0.0)
    fibre_g: Mapped[float] = mapped_column(Float, default=0.0)
    nutrients_json: Mapped[str] = mapped_column(Text, default="{}")
    source_basis: Mapped[str] = mapped_column(String(100), default="catalog")
    data_completeness: Mapped[str] = mapped_column(String(50), default="verified")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user: Mapped[User] = relationship("User", back_populates="daily_food_logs")
    food: Mapped[Optional[Food]] = relationship("Food")


def run_migrations() -> None:
    """Run alembic upgrade head programmatically on startup."""
    import os
    from alembic import command
    from alembic.config import Config

    root_ini = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini"))
    if not os.path.exists(root_ini):
        root_ini = "alembic.ini"
    alembic_cfg = Config(root_ini)
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")



def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_access_token(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": user.id, "name": user.name, "role": user.role, "type": "access", "exp": expires},
        get_jwt_secret(),
        algorithm=ALGORITHM,
    )


# Backward compatibility alias
def token_for(user: User) -> str:
    return create_access_token(user)


def create_refresh_token(user: User, session: Session, family_id: Optional[str] = None) -> str:
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    token_family = family_id or str(uuid4())
    db_token = RefreshToken(
        user_id=user.id,
        family_id=token_family,
        token_hash=token_hash,
        expires_at=expires,
        revoked=False,
    )
    session.add(db_token)
    session.commit()
    return raw_token


def verify_and_rotate_refresh_token(raw_token: str, session: Session) -> tuple[User, str]:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    record = session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # 1. Reuse detection: if token is already revoked, revoke whole token family!
    if record.revoked:
        if record.family_id:
            session.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == record.family_id)
                .values(revoked=True)
            )
        else:
            session.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == record.user_id)
                .values(revoked=True)
            )
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. Session terminated.",
        )

    # 2. Expiration check
    rec_exp = record.expires_at
    now_cmp = datetime.now(timezone.utc) if rec_exp.tzinfo is not None else datetime.now(timezone.utc).replace(tzinfo=None)
    if rec_exp <= now_cmp:
        record.revoked = True
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired refresh token",
        )

    # 3. Legitimate rotation: revoke presented token
    record.revoked = True
    session.commit()

    user = session.get(User, record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )

    # Issue new rotated token preserving family_id
    new_raw = create_refresh_token(user, session, family_id=record.family_id)
    return user, new_raw


def revoke_refresh_token(raw_token: str, session: Session) -> bool:
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    record = session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    if record:
        record.revoked = True
        if record.family_id:
            session.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == record.family_id)
                .values(revoked=True)
            )
        session.commit()
        return True
    return False


def generate_csrf_token() -> str:
    return secrets.token_hex(24)


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    is_secure = settings.cookie_secure or settings.app_env == "production"
    # Access token (15 mins)
    response.set_cookie(
        key="nutriverse_access",
        value=access_token,
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
    )
    # Refresh token (7 days)
    response.set_cookie(
        key="nutriverse_refresh",
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/api/auth",
    )
    # CSRF token (readable by client)
    response.set_cookie(
        key="nutriverse_csrf",
        value=csrf_token,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=False,
        secure=is_secure,
        samesite="lax",
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    is_secure = settings.cookie_secure or settings.app_env == "production"
    response.delete_cookie(key="nutriverse_access", path="/", secure=is_secure, samesite="lax")
    response.delete_cookie(key="nutriverse_refresh", path="/api/auth", secure=is_secure, samesite="lax")
    response.delete_cookie(key="nutriverse_csrf", path="/", secure=is_secure, samesite="lax")


def verify_csrf(request: Request) -> None:
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        cookie_access = request.cookies.get("nutriverse_access")
        cookie_refresh = request.cookies.get("nutriverse_refresh")
        csrf_cookie = request.cookies.get("nutriverse_csrf")
        auth_header = request.headers.get("authorization")
        # If user relies on cookie auth or has an established CSRF session
        if (cookie_access or cookie_refresh or csrf_cookie) and (not auth_header or not auth_header.startswith("Bearer ")):
            csrf_header = request.headers.get("x-csrf-token")
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF token mismatch or missing",
                )


def current_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(db),
) -> User:
    token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif request.cookies.get("nutriverse_access"):
        token = request.cookies.get("nutriverse_access")
        verify_csrf(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = session.get(User, user_id)
    except JWTError:
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )
    return user


def optional_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    session: Session = Depends(db),
) -> Optional[User]:
    token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif request.cookies.get("nutriverse_access"):
        token = request.cookies.get("nutriverse_access")

    if not token:
        return None
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return session.get(User, user_id)
    except JWTError:
        return None


def require_role(roles: List[str]):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: requires one of {roles}",
            )
        return user

    return checker


# Pydantic Schemas
class AuthPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Optional[str] = Role.user.value

    @field_validator("password")
    @classmethod
    def validate_password_rules(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(v) > 128:
            raise ValueError("Password cannot exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v


class LoginPayload(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str


class ProfilePayload(BaseModel):
    age: int = Field(ge=13, le=100)
    sex: str = Field(pattern="^(female|male)$")
    height_cm: float = Field(ge=100, le=240)
    weight_kg: float = Field(ge=30, le=250)
    activity_level: float = Field(ge=1.2, le=1.9)
    food_preferences: Optional[str] = "All foods"
    allergies: Optional[str] = "None"
    goal: Optional[str] = "Balanced Nourishment"
    budget_paise: Optional[int] = 150000


class NutritionTargetCalculatePayload(BaseModel):
    age: int
    sex: str
    height: float
    height_unit: str = "cm"
    weight: float
    weight_unit: str = "kg"
    activity_level: Union[str, float]
    goal: Optional[str] = "maintain"
    method: Optional[str] = "mifflin_st_jeor"
    optional_allergies: Optional[str] = None
    optional_preferences: Optional[str] = None


class NutritionTargetProfileSavePayload(BaseModel):
    age: int
    sex: str
    height: float
    height_unit: str = "cm"
    weight: float
    weight_unit: str = "kg"
    activity_level: Union[str, float]
    goal: Optional[str] = "maintain"
    method: Optional[str] = "mifflin_st_jeor"
    food_preferences: Optional[str] = "All foods"
    allergies: Optional[str] = "None"
    budget_paise: Optional[int] = 150000
    consent_given: bool = Field(..., description="Explicit user consent to store and process personal biometric and nutritional profile")


class RecommendationCalculatePayload(BaseModel):
    target_nutrient: str = Field(default="protein", description="Target nutrient: protein, dietary_fiber, energy, fat, carbohydrates")
    age: int
    sex: str
    height: float
    height_unit: str = "cm"
    weight: float
    weight_unit: str = "kg"
    activity_level: Union[str, float]
    goal: Optional[str] = "maintain"
    method: Optional[str] = "mifflin_st_jeor"
    optional_allergies: Optional[str] = None
    optional_preferences: Optional[str] = None
    limit: Optional[int] = Field(default=5, ge=1, le=50)
    portion_override_g: Optional[float] = Field(default=None, gt=0, le=2000.0)
    strict_verified: Optional[bool] = True
    food_state: Optional[str] = "raw"


class AddressPayload(BaseModel):
    label: str = Field(default="Home", max_length=40)
    line1: str = Field(default="", max_length=200)
    street: Optional[str] = None
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(default="", max_length=12)
    pincode: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_address(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("line1"):
                data["line1"] = data.get("street") or "Main Street"
            if not data.get("postal_code"):
                data["postal_code"] = data.get("pincode") or "520010"
        return data


class FoodCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    barcode: Optional[str] = None
    category: str
    nutrition_tags: List[str] = []
    description: str
    price_paise: int = Field(ge=0)
    gst_rate_percent: Optional[float] = None
    unit: str = "500g"
    serving_size: str = "100g"
    stock_qty: int = Field(ge=0, default=50)
    calories: float = Field(ge=0, default=0)
    protein_g: float = Field(ge=0, default=0)
    carbs_g: float = Field(ge=0, default=0)
    fat_g: float = Field(ge=0, default=0)
    fibre_g: float = Field(ge=0, default=0)
    vitamins_json: Optional[Dict[str, Any]] = None
    ingredients: Optional[str] = ""
    storage_info: Optional[str] = "Store in a cool dry place."
    prep_methods: List[str] = ["Raw", "Boiled"]
    dietary_tags: List[str] = ["Vegetarian"]
    emoji: str = "🥗"


class FoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    barcode: Optional[str] = None
    category: str
    nutrition_tags: str
    description: str
    price_paise: int
    gst_rate_percent: Optional[float] = None
    unit: str
    serving_size: str
    stock_qty: int
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fibre_g: float
    vitamins_json: str
    ingredients: str
    storage_info: str
    prep_methods: str
    dietary_tags: str
    emoji: str
    active: bool


class RecipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str
    instructions: str
    prep_method: str
    prep_time_mins: int
    servings: int
    calories: float
    protein_g: float
    emoji: str
    ingredients_json: str
    active: bool


class CalinPackTierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    tier: str
    name: str
    base_price_paise: int
    description: str
    target_audience: str
    max_substitutions: int
    items_json: str
    active: bool


class CombinationRequest(BaseModel):
    items: List[Dict[str, Any]]  # list of {food_id: str, quantity: float, unit?: str, food_state?: str}
    mode: Optional[str] = "standard"


class NutritionCalculateRequest(BaseModel):
    items: List[Dict[str, Any]]
    mode: Optional[str] = "standard"


class RecipeCalculateRequest(BaseModel):
    recipe_id: str
    servings: Optional[int] = None
    mode: Optional[str] = "standard"


class CustomizePackPayload(BaseModel):
    tier: str
    selected_food_ids: List[str]


class AddCartPayload(BaseModel):
    item_type: str = "food"  # food | pack
    food_id: Optional[str] = None
    pack_tier: Optional[str] = None
    pack_name: Optional[str] = None
    customization: Optional[Dict[str, Any]] = None
    quantity: int = 1


class CheckoutPayload(BaseModel):
    address: AddressPayload
    delivery_notes: Optional[str] = ""


class SubscriptionPayload(BaseModel):
    pack_tier: str
    frequency: str = "weekly"  # weekly, bi_weekly, monthly


class NutritionistRequestPayload(BaseModel):
    pack_tier: str
    customer_notes: str = Field(min_length=5, max_length=1000)


class NutritionistReviewSubmit(BaseModel):
    guidance_notes: str = Field(min_length=10, max_length=2000)


class OrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(placed|confirmed|preparing|out_for_delivery|delivered|cancelled|placed_demo|preparing_demo|completed_demo|cancelled_demo)$")


class DailyFoodLogCreatePayload(BaseModel):
    food_id: Optional[str] = None
    food_name: Optional[str] = None
    meal_type: str = Field(default="lunch", pattern="^(breakfast|lunch|dinner|snack)$")
    quantity: float = Field(default=100.0, gt=0, le=5000)
    unit: str = Field(default="g", min_length=1, max_length=20)
    food_state: str = Field(default="raw", min_length=1, max_length=50)
    date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class DailyFoodLogOut(BaseModel):
    id: str
    date: str
    food_id: Optional[str] = None
    food_name: str
    meal_type: str
    quantity: float
    unit: str
    mass_g: float
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fibre_g: float
    nutrients_json: str
    source_basis: str
    data_completeness: str
    created_at: datetime


class DailyNutritionSummaryOut(BaseModel):
    date: str
    items: List[DailyFoodLogOut]
    consumed_totals: Dict[str, float]
    target_totals: Optional[Dict[str, float]] = None
    remaining: Optional[Dict[str, float]] = None
    progress_percentage: Optional[Dict[str, float]] = None
    data_completeness_notes: List[str]


from contextlib import asynccontextmanager


def seed_initial_data() -> None:
    with SessionLocal() as session:
        # 1. Seed Initial Accounts ONLY when APP_ENV == "development"
        if settings.app_env == "development":
            if not session.scalar(select(User).where(User.email == "alex@nutriverse.local")):
                session.add_all(
                    [
                        User(
                            name="Alex Mercer (Customer)",
                            email="alex@nutriverse.local",
                            password_hash=PasswordHasher.hash("Customer123!"),
                            role=Role.user.value,
                        ),
                        User(
                            name="Dr. Priya Nair (Nutritionist)",
                            email="dr.priya@nutriverse.local",
                            password_hash=PasswordHasher.hash("Nutritionist123!"),
                            role=Role.nutritionist.value,
                        ),
                        User(
                            name="Store Admin (Operations)",
                            email="admin@nutriverse.local",
                            password_hash=PasswordHasher.hash("AdminPass123!"),
                            role=Role.admin.value,
                        ),
                    ]
                )
                session.commit()

        # 2. Seed Foods Catalog
        if True:
            catalog_foods = [
                Food(
                    name="Sprouted Chickpeas",
                    barcode="8901234567890",
                    category="Legumes & Pulses",
                    nutrition_tags=json.dumps(["protein_rich", "iron_rich", "fiber_rich", "mineral_sources"]),
                    description="Protein and iron dense sprouted garbanzo beans with elevated bioavailability.",
                    price_paise=19900,
                    unit="500g pack",
                    serving_size="100g",
                    stock_qty=85,
                    calories=164,
                    protein_g=8.9,
                    carbs_g=27.4,
                    fat_g=2.6,
                    fibre_g=7.6,
                    vitamins_json=json.dumps({"iron_mg": 4.2, "folate_mcg": 172, "zinc_mg": 1.5, "calcium_mg": 49}),
                    ingredients="100% Organically Sprouted Indian Chickpeas (Cicer arietinum)",
                    storage_info="Refrigerate after opening. Consume within 5 days.",
                    prep_methods=json.dumps(["Raw Sprouted", "Steamed", "Light Sauté"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "High-Protein"]),
                    emoji="🫘",
                ),
                Food(
                    name="Tender Baby Spinach",
                    barcode="8901234567891",
                    category="Leafy Greens",
                    nutrition_tags=json.dumps(["vitamin_sources", "iron_rich", "mineral_sources", "fiber_rich"]),
                    description="Farm-fresh hydroponic baby spinach packed with Folate, Vitamin K, and Vitamin C.",
                    price_paise=12900,
                    unit="250g bunch",
                    serving_size="100g",
                    stock_qty=60,
                    calories=23,
                    protein_g=2.9,
                    carbs_g=3.6,
                    fat_g=0.4,
                    fibre_g=2.2,
                    vitamins_json=json.dumps({"iron_mg": 2.7, "vitamin_k_mcg": 483, "vitamin_c_mg": 28, "folate_mcg": 194}),
                    ingredients="Fresh Hydroponic Baby Spinach Leaves",
                    storage_info="Keep crisper drawer refrigerated at 4°C.",
                    prep_methods=json.dumps(["Raw Salad", "Flash Wilt", "Smoothie Blend"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Low-Calorie"]),
                    emoji="🥬",
                ),
                Food(
                    name="Roasted Sweet Potato",
                    barcode="8901234567892",
                    category="Tubers & Roots",
                    nutrition_tags=json.dumps(["carb_rich", "vitamin_sources", "fiber_rich"]),
                    description="Complex slow-burning carbohydrates rich in Beta-Carotene (Vitamin A) and potassium.",
                    price_paise=14900,
                    unit="1kg box",
                    serving_size="100g",
                    stock_qty=90,
                    calories=86,
                    protein_g=1.6,
                    carbs_g=20.1,
                    fat_g=0.1,
                    fibre_g=3.0,
                    vitamins_json=json.dumps({"vitamin_a_iu": 14187, "vitamin_c_mg": 2.4, "potassium_mg": 337}),
                    ingredients="Organic Indian Sweet Potatoes",
                    storage_info="Store in a dark, well-ventilated basket at room temperature.",
                    prep_methods=json.dumps(["Baked", "Boiled Mash", "Air-Fried"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Clean Carbs"]),
                    emoji="🍠",
                ),
                Food(
                    name="Probiotic Greek Yoghurt",
                    barcode="8901234567893",
                    category="Dairy & Probiotics",
                    nutrition_tags=json.dumps(["protein_rich", "calcium_rich", "fat_sources"]),
                    description="Strained live-culture yoghurt with triple the protein and active gut microbiome cultures.",
                    price_paise=24900,
                    unit="400g tub",
                    serving_size="100g",
                    stock_qty=40,
                    calories=97,
                    protein_g=10.0,
                    carbs_g=3.6,
                    fat_g=5.0,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"calcium_mg": 110, "vitamin_b12_mcg": 0.75, "phosphorus_mg": 135}),
                    ingredients="Pasteurized Whole Milk, Live Active Lactic Cultures (L. bulgaricus, S. thermophilus)",
                    storage_info="Keep chilled between 2°C and 4°C.",
                    prep_methods=json.dumps(["Chilled Spoon", "Herb Dip Base", "Smoothie Bowl"]),
                    dietary_tags=json.dumps(["Vegetarian", "High-Protein", "Keto-Friendly"]),
                    emoji="🥣",
                ),
                Food(
                    name="Organic White Quinoa",
                    barcode="8901234567894",
                    category="Grains & Pseudocereals",
                    nutrition_tags=json.dumps(["protein_rich", "carb_rich", "fiber_rich", "mineral_sources"]),
                    description="A complete plant protein containing all 9 essential amino acids and low glycemic impact.",
                    price_paise=34900,
                    unit="500g pouch",
                    serving_size="100g cooked",
                    stock_qty=75,
                    calories=120,
                    protein_g=4.4,
                    carbs_g=21.3,
                    fat_g=1.9,
                    fibre_g=2.8,
                    vitamins_json=json.dumps({"magnesium_mg": 64, "iron_mg": 1.5, "zinc_mg": 1.1}),
                    ingredients="100% Certified Organic White Quinoa Seeds",
                    storage_info="Airtight container in pantry.",
                    prep_methods=json.dumps(["Rinsed Simmer 15m", "Pilaf", "Cold Salad Base"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Complete Protein"]),
                    emoji="🌾",
                ),
                Food(
                    name="Wild Blueberries",
                    barcode="8901234567895",
                    category="Berries & Fruits",
                    nutrition_tags=json.dumps(["vitamin_sources", "fiber_rich"]),
                    description="High-anthocyanin antioxidant berries that protect cells and promote cognitive health.",
                    price_paise=39900,
                    unit="250g punnet",
                    serving_size="100g",
                    stock_qty=35,
                    calories=57,
                    protein_g=0.7,
                    carbs_g=14.5,
                    fat_g=0.3,
                    fibre_g=2.4,
                    vitamins_json=json.dumps({"anthocyanins_mg": 387, "vitamin_c_mg": 9.7, "vitamin_k_mcg": 19.3}),
                    ingredients="Fresh Cultivated Himalayan Blueberries",
                    storage_info="Keep refrigerated, wash immediately before consuming.",
                    prep_methods=json.dumps(["Raw Fresh", "Blended Smoothie", "Yoghurt Topping"]),
                    dietary_tags=json.dumps(["Vegan", "Antioxidant Superfood"]),
                    emoji="🫐",
                ),
                Food(
                    name="Raw California Almonds",
                    barcode="8901234567896",
                    category="Nuts & Seeds",
                    nutrition_tags=json.dumps(["fat_sources", "protein_rich", "vitamin_sources", "mineral_sources"]),
                    description="Heart-healthy monounsaturated fats, Vitamin E, and magnesium for sustained energy.",
                    price_paise=49900,
                    unit="500g pouch",
                    serving_size="30g",
                    stock_qty=65,
                    calories=173,
                    protein_g=6.4,
                    carbs_g=6.1,
                    fat_g=14.9,
                    fibre_g=3.5,
                    vitamins_json=json.dumps({"vitamin_e_mg": 7.3, "magnesium_mg": 77, "calcium_mg": 76}),
                    ingredients="100% Whole Non-Pareil Unsalted Raw Almonds",
                    storage_info="Store in an airtight jar in a cool, shaded cabinet.",
                    prep_methods=json.dumps(["Overnight Soaked", "Light Dry Roast", "Raw Snack"]),
                    dietary_tags=json.dumps(["Vegan", "Keto", "High-Energy"]),
                    emoji="🥜",
                ),
                Food(
                    name="Organic Black Chia Seeds",
                    barcode="8901234567897",
                    category="Nuts & Seeds",
                    nutrition_tags=json.dumps(["fiber_rich", "fat_sources", "mineral_sources"]),
                    description="Concentrated Omega-3 ALA fatty acids and hydrophilic soluble dietary fiber.",
                    price_paise=22900,
                    unit="250g jar",
                    serving_size="25g",
                    stock_qty=55,
                    calories=122,
                    protein_g=4.1,
                    carbs_g=10.5,
                    fat_g=7.7,
                    fibre_g=8.6,
                    vitamins_json=json.dumps({"omega3_g": 4.5, "calcium_mg": 158, "phosphorus_mg": 215}),
                    ingredients="Pure Organic Black Chia Seeds (Salvia hispanica)",
                    storage_info="Airtight container.",
                    prep_methods=json.dumps(["Hydrated Gel (10m)", "Pudding", "Baking Binder"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Omega-3 Dense"]),
                    emoji="✨",
                ),
                Food(
                    name="Sprouted Green Moong",
                    barcode="8901234567898",
                    category="Legumes & Pulses",
                    nutrition_tags=json.dumps(["protein_rich", "fiber_rich", "vitamin_sources"]),
                    description="Easily digestible sprouted green gram beans packed with enzymes, B vitamins, and potassium.",
                    price_paise=15900,
                    unit="500g pack",
                    serving_size="100g",
                    stock_qty=70,
                    calories=105,
                    protein_g=7.0,
                    carbs_g=19.0,
                    fat_g=0.4,
                    fibre_g=7.6,
                    vitamins_json=json.dumps({"folate_mcg": 159, "vitamin_c_mg": 13.7, "potassium_mg": 375}),
                    ingredients="100% Sprouted Whole Green Gram (Vigna radiata)",
                    storage_info="Keep refrigerated.",
                    prep_methods=json.dumps(["Steamed Warm Salad", "Tempered Tadka", "Raw"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Digestive Friendly"]),
                    emoji="🌱",
                ),
                Food(
                    name="Cold-Pressed Mustard Oil",
                    barcode="8901234567899",
                    category="Healthy Oils & Fats",
                    nutrition_tags=json.dumps(["fat_sources"]),
                    description="Traditional kachi ghani unrefined oil rich in MUFA, PUFA, and balanced alpha-linolenic acid.",
                    price_paise=27900,
                    unit="1 Litre bottle",
                    serving_size="15ml",
                    stock_qty=45,
                    calories=124,
                    protein_g=0.0,
                    carbs_g=0.0,
                    fat_g=14.0,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"omega3_omega6_ratio": "1:1.2", "vitamin_e_mg": 5.1}),
                    ingredients="100% Single-Origin Cold-Pressed Mustard Seeds",
                    storage_info="Dark amber glass bottle away from direct sunlight.",
                    prep_methods=json.dumps(["Medium Heat Cooking", "Tadka Sauté", "Pickling"]),
                    dietary_tags=json.dumps(["Vegan", "Unrefined", "Heart-Healthy"]),
                    emoji="🫒",
                ),
                Food(
                    name="Organic Rolled Oats",
                    barcode="8901234567800",
                    category="Grains & Pseudocereals",
                    nutrition_tags=json.dumps(["carb_rich", "fiber_rich", "mineral_sources"]),
                    description="Wholesome jumbo rolled oats containing cholesterol-lowering beta-glucan soluble fiber.",
                    price_paise=19900,
                    unit="1kg bag",
                    serving_size="50g",
                    stock_qty=80,
                    calories=189,
                    protein_g=6.8,
                    carbs_g=33.1,
                    fat_g=3.2,
                    fibre_g=5.1,
                    vitamins_json=json.dumps({"beta_glucan_g": 2.2, "iron_mg": 2.1, "thiamine_mg": 0.35}),
                    ingredients="100% Certified Whole Grain Rolled Oats",
                    storage_info="Keep in an airtight tin.",
                    prep_methods=json.dumps(["Overnight Soak", "Warm Porridge", "Baked Crumble"]),
                    dietary_tags=json.dumps(["Vegan", "Heart-Healthy"]),
                    emoji="🥣",
                ),
                Food(
                    name="Fresh Organic Broccoli",
                    barcode="8901234567801",
                    category="Cruciferous & Greens",
                    nutrition_tags=json.dumps(["vitamin_sources", "fiber_rich", "mineral_sources"]),
                    description="Cruciferous super-vegetable with sulforaphane, Vitamin C, and calcium.",
                    price_paise=16900,
                    unit="400g head",
                    serving_size="100g",
                    stock_qty=50,
                    calories=34,
                    protein_g=2.8,
                    carbs_g=6.6,
                    fat_g=0.4,
                    fibre_g=2.6,
                    vitamins_json=json.dumps({"vitamin_c_mg": 89.2, "vitamin_k_mcg": 101.6, "sulforaphane_active": True}),
                    ingredients="Fresh Farm-Harvested Organic Broccoli Florets",
                    storage_info="Keep chilled in breathable produce bag.",
                    prep_methods=json.dumps(["Steam 4 mins (Locks Sulforaphane)", "Roast", "Stir-Fry"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Detox Support"]),
                    emoji="🥦",
                ),
                Food(
                    name="Potato (Bangala Dumpa)",
                    barcode="8901234567810",
                    category="Tubers & Roots",
                    nutrition_tags=json.dumps(["carb_rich", "mineral_sources", "fiber_rich"]),
                    description="Farm-fresh whole table potatoes rich in Potassium and Vitamin C. Clean carbohydrate source.",
                    price_paise=2900,
                    unit="1 kg",
                    serving_size="100g",
                    stock_qty=150,
                    calories=77,
                    protein_g=2.0,
                    carbs_g=17.5,
                    fat_g=0.1,
                    fibre_g=2.2,
                    vitamins_json=json.dumps({"potassium_mg": 421, "vitamin_c_mg": 19.7, "vitamin_b6_mg": 0.3}),
                    ingredients="100% Farm-Fresh Whole Table Potatoes (Solanum tuberosum)",
                    storage_info="Store in a cool, dark, well-ventilated dry basket away from onions and direct sunlight.",
                    prep_methods=json.dumps(["Boiled & Mashed", "Steam Roasted", "Air-Fried with Cumin"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Whole Food"]),
                    emoji="🥔",
                ),
                Food(
                    name="Farm Fresh Red Onions",
                    barcode="8901234567811",
                    category="Alliums & Aromatics",
                    nutrition_tags=json.dumps(["vitamin_sources", "mineral_sources", "fiber_rich"]),
                    description="Pungent Indian red onions rich in Quercetin and prebiotic fructooligosaccharides.",
                    price_paise=3800,
                    unit="1 kg",
                    serving_size="100g",
                    stock_qty=140,
                    calories=40,
                    protein_g=1.1,
                    carbs_g=9.3,
                    fat_g=0.1,
                    fibre_g=1.7,
                    vitamins_json=json.dumps({"quercetin_mg": 19.4, "vitamin_c_mg": 7.4, "folate_mcg": 19}),
                    ingredients="100% Organically Grown Red Onions (Allium cepa)",
                    storage_info="Store in a dry, ventilated basket at room temperature.",
                    prep_methods=json.dumps(["Raw Salad with Lemon", "Caramelized", "Curry Base"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Prebiotic"]),
                    emoji="🧅",
                ),
                Food(
                    name="Fresh Garlic Bulbs",
                    barcode="8901234567812",
                    category="Alliums & Aromatics",
                    nutrition_tags=json.dumps(["vitamin_sources", "mineral_sources"]),
                    description="Potent desi garlic bulbs rich in Allicin and manganese for antimicrobial cardiovascular support.",
                    price_paise=4500,
                    unit="250 g",
                    serving_size="10g",
                    stock_qty=100,
                    calories=149,
                    protein_g=6.4,
                    carbs_g=33.1,
                    fat_g=0.5,
                    fibre_g=2.1,
                    vitamins_json=json.dumps({"allicin_active": True, "manganese_mg": 1.67, "vitamin_b6_mg": 1.2}),
                    ingredients="100% Sun-Cured Desi Garlic Bulbs (Allium sativum)",
                    storage_info="Keep in a mesh bag at room temperature with plenty of air circulation.",
                    prep_methods=json.dumps(["Crushed & Rested (Allicin Activation)", "Tadka Infusion", "Roasted"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Heart-Healthy"]),
                    emoji="🧄",
                ),
                Food(
                    name="Fresh Yellow Lemons",
                    barcode="8901234567813",
                    category="Berries & Fruits",
                    nutrition_tags=json.dumps(["vitamin_sources", "mineral_sources"]),
                    description="Juicy thin-skinned kagzi lemons packed with bioavailable Vitamin C. Enhances non-heme plant iron absorption by 300%.",
                    price_paise=3200,
                    unit="500 g",
                    serving_size="50g",
                    stock_qty=120,
                    calories=29,
                    protein_g=1.1,
                    carbs_g=9.3,
                    fat_g=0.3,
                    fibre_g=2.8,
                    vitamins_json=json.dumps({"vitamin_c_mg": 53.0, "citric_acid_percent": 5.5, "potassium_mg": 138}),
                    ingredients="100% Orchard Fresh Kagzi Lemons (Citrus limon)",
                    storage_info="Store in crisper drawer sealed in a damp cloth or zip pouch for up to 3 weeks.",
                    prep_methods=json.dumps(["Fresh Lemon Squeeze", "Warm Lemon Water", "Zest & Marinade"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Iron Booster"]),
                    emoji="🍋",
                ),
                Food(
                    name="Fresh Organic Ginger",
                    barcode="8901234567814",
                    category="Alliums & Aromatics",
                    nutrition_tags=json.dumps(["mineral_sources", "vitamin_sources"]),
                    description="Spicy aromatic fresh ginger rhizomes packed with Gingerol and Shogaols for digestive health.",
                    price_paise=3800,
                    unit="250 g",
                    serving_size="10g",
                    stock_qty=95,
                    calories=80,
                    protein_g=1.8,
                    carbs_g=17.8,
                    fat_g=0.8,
                    fibre_g=2.0,
                    vitamins_json=json.dumps({"gingerol_active": True, "potassium_mg": 415, "magnesium_mg": 43}),
                    ingredients="100% Organically Farmed Ginger Rhizomes (Zingiber officinale)",
                    storage_info="Refrigerate unpeeled ginger in a paper bag or airtight container.",
                    prep_methods=json.dumps(["Fresh Grated Tea Decoction", "Julienne Pickle", "Curry Base Paste"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Anti-Inflammatory"]),
                    emoji="🫚",
                ),
                Food(
                    name="Sweet Muskmelon (Kharbuja)",
                    barcode="8901234567815",
                    category="Berries & Fruits",
                    nutrition_tags=json.dumps(["vitamin_sources", "fiber_rich"]),
                    description="Hydrating sweet cantaloupe muskmelon packed with Vitamin A, Vitamin C, and electrolytes.",
                    price_paise=6900,
                    unit="1 pc (approx 1 kg)",
                    serving_size="100g",
                    stock_qty=60,
                    calories=34,
                    protein_g=0.8,
                    carbs_g=8.2,
                    fat_g=0.2,
                    fibre_g=0.9,
                    vitamins_json=json.dumps({"vitamin_a_iu": 3382, "vitamin_c_mg": 36.7, "potassium_mg": 267}),
                    ingredients="100% Vine-Ripened Sweet Muskmelon (Cucumis melo)",
                    storage_info="Ripen at room temperature; once cut, wrap tightly and refrigerate.",
                    prep_methods=json.dumps(["Chilled Cubes", "Fresh Electrolyte Smoothie", "Hydration Bowl"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Hydrating"]),
                    emoji="🍈",
                ),
                Food(
                    name="Fresh Malai Paneer",
                    barcode="8901234567816",
                    category="Dairy & Probiotics",
                    nutrition_tags=json.dumps(["protein_rich", "mineral_sources"]),
                    description="Traditional soft cottage cheese made from pure cow milk. High protein and bioavailable calcium.",
                    price_paise=11900,
                    unit="200 g",
                    serving_size="100g",
                    stock_qty=75,
                    calories=289,
                    protein_g=18.3,
                    carbs_g=3.4,
                    fat_g=22.5,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"calcium_mg": 480, "phosphorus_mg": 280, "vitamin_a_iu": 360}),
                    ingredients="Pasteurized Cow Milk, Citric Acid",
                    storage_info="Store immersed in water in the refrigerator. Change water daily.",
                    prep_methods=json.dumps(["Tawa Grilled", "Curry Cubes", "Raw Spiced"]),
                    dietary_tags=json.dumps(["Vegetarian", "Gluten-Free", "High-Protein"]),
                    emoji="🧀",
                ),
                Food(
                    name="Organic Firm Tofu",
                    barcode="8901234567817",
                    category="Plant Proteins",
                    nutrition_tags=json.dumps(["protein_rich", "mineral_sources", "iron_rich"]),
                    description="Non-GMO organic firm soybean tofu providing all 9 essential amino acids and calcium sulfate.",
                    price_paise=9900,
                    unit="200 g",
                    serving_size="100g",
                    stock_qty=70,
                    calories=144,
                    protein_g=15.5,
                    carbs_g=3.2,
                    fat_g=8.0,
                    fibre_g=2.3,
                    vitamins_json=json.dumps({"calcium_mg": 350, "iron_mg": 2.7, "magnesium_mg": 58}),
                    ingredients="Organic Non-GMO Soybeans, Filtered Water, Calcium Sulfate",
                    storage_info="Keep submerged in fresh cold water refrigerated.",
                    prep_methods=json.dumps(["Pan-Seared Cubes", "Stir-Fry", "Marinated Scramble"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Complete Protein"]),
                    emoji="🧈",
                ),
                Food(
                    name="Fresh Green Chillies",
                    barcode="8901234567818",
                    category="Alliums & Aromatics",
                    nutrition_tags=json.dumps(["vitamin_sources", "mineral_sources"]),
                    description="Handpicked sharp native green chillies packed with natural capsaicin and high ascorbic acid.",
                    price_paise=1800,
                    unit="100 g",
                    serving_size="15g",
                    stock_qty=90,
                    calories=40,
                    protein_g=2.0,
                    carbs_g=9.0,
                    fat_g=0.2,
                    fibre_g=1.5,
                    vitamins_json=json.dumps({"vitamin_c_mg": 143.7, "capsaicin_active": True}),
                    ingredients="100% Native Indian Green Chillies (Capsicum annuum)",
                    storage_info="Store refrigerated in a breathable paper pouch.",
                    prep_methods=json.dumps(["Raw Chopped Tadka", "Slit Fry", "Chutney Paste"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Low-Calorie"]),
                    emoji="🌶️",
                ),
                Food(
                    name="Whole Finger Millet (Ragi / Ragulu)",
                    barcode="8901234567821",
                    category="Grains & Pseudocereals",
                    nutrition_tags=json.dumps(["carb_rich", "mineral_sources", "fiber_rich"]),
                    description="Whole red finger millet grains exceptionally rich in dietary calcium and low glycemic index.",
                    price_paise=8500,
                    unit="1 kg pack",
                    serving_size="100g",
                    stock_qty=90,
                    calories=328,
                    protein_g=7.3,
                    carbs_g=72.0,
                    fat_g=1.3,
                    fibre_g=11.5,
                    vitamins_json=json.dumps({"calcium_mg": 344, "iron_mg": 3.9, "potassium_mg": 408}),
                    ingredients="100% Whole Finger Millet Grains (Eleusine coracana)",
                    storage_info="Store in an airtight container in a dry pantry.",
                    prep_methods=json.dumps(["Ragi Mudde / Sangati", "Malted Porridge", "Dosa / Roti Flour"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "High-Calcium"]),
                    emoji="🌾",
                    approval_status="pending",
                ),
                Food(
                    name="Fresh Organic Pumpkin (Gummadikaya)",
                    barcode="8901234567822",
                    category="Fresh produce",
                    nutrition_tags=json.dumps(["vitamin_sources", "fiber_rich"]),
                    description="Sweet orange-fleshed local pumpkin packed with Beta-Carotene (Vitamin A) and potassium.",
                    price_paise=4500,
                    unit="1 kg cut",
                    serving_size="100g",
                    stock_qty=65,
                    calories=26,
                    protein_g=1.0,
                    carbs_g=6.5,
                    fat_g=0.1,
                    fibre_g=0.5,
                    vitamins_json=json.dumps({"vitamin_a_iu": 8513, "potassium_mg": 340, "vitamin_c_mg": 9.0}),
                    ingredients="100% Organically Farmed Pumpkin (Cucurbita moschata)",
                    storage_info="Store cut sections wrapped tightly in refrigerator.",
                    prep_methods=json.dumps(["Steamed Sambar Cubes", "Warm Roasted Mash", "Sweet Halwa"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Low-Calorie"]),
                    emoji="🎃",
                    approval_status="pending",
                ),
                Food(
                    name="Farm Fresh Brown Eggs",
                    barcode="8901234567823",
                    category="Dairy & Probiotics",
                    nutrition_tags=json.dumps(["protein_rich", "fat_sources", "vitamin_sources"]),
                    description="Free-range brown eggs supplying complete bioavailable protein, choline, and essential amino acids.",
                    price_paise=6500,
                    unit="6 pcs carton",
                    serving_size="100g (approx 2 eggs)",
                    stock_qty=80,
                    calories=143,
                    protein_g=12.6,
                    carbs_g=0.7,
                    fat_g=9.5,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"choline_mg": 294, "vitamin_b12_mcg": 1.1, "iron_mg": 1.8}),
                    ingredients="100% Fresh Whole Hen Eggs",
                    storage_info="Store refrigerated at 4°C pointy end down.",
                    prep_methods=json.dumps(["Soft Boiled (6 mins)", "Poached", "Scrambled with Pepper"]),
                    dietary_tags=json.dumps(["High-Protein", "Keto-Friendly"]),
                    emoji="🥚",
                    approval_status="pending",
                ),
                Food(
                    name="Raw Walnut Halves",
                    barcode="8901234567824",
                    category="Nuts & Seeds",
                    nutrition_tags=json.dumps(["fat_sources", "protein_rich", "mineral_sources"]),
                    description="Crisp premium walnut halves high in plant-based Omega-3 ALA fatty acids and polyphenols.",
                    price_paise=38000,
                    unit="250g pouch",
                    serving_size="30g",
                    stock_qty=50,
                    calories=654,
                    protein_g=15.2,
                    carbs_g=13.7,
                    fat_g=65.2,
                    fibre_g=6.7,
                    vitamins_json=json.dumps({"omega3_ala_g": 9.1, "magnesium_mg": 158, "phosphorus_mg": 346}),
                    ingredients="100% Raw Unsalted Walnut Halves (Juglans regia)",
                    storage_info="Refrigerate in an airtight glass jar to prevent oxidation.",
                    prep_methods=json.dumps(["Raw Morning Snack", "Chopped Salad Topping", "Smoothie Blend"]),
                    dietary_tags=json.dumps(["Vegan", "Keto", "Brain-Health"]),
                    emoji="🥜",
                    approval_status="pending",
                ),
                Food(
                    name="A2 Cultured Desi Cow Ghee",
                    barcode="8901234567825",
                    category="Healthy Oils & Fats",
                    nutrition_tags=json.dumps(["fat_sources"]),
                    description="Artisanal bilona ghee made from cultured A2 cow milk, rich in butyric acid and fat-soluble vitamins.",
                    price_paise=69000,
                    unit="500 ml jar",
                    serving_size="15ml",
                    stock_qty=40,
                    calories=897,
                    protein_g=0.0,
                    carbs_g=0.0,
                    fat_g=99.7,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"butyric_acid_g": 3.2, "vitamin_a_mcg": 653, "cla_g": 1.1}),
                    ingredients="100% Cultured Grass-Fed A2 Cow Milk Fat",
                    storage_info="Store at room temperature in a dry glass jar. Use dry spoon.",
                    prep_methods=json.dumps(["Warm Dal Drizzle", "Medicinal Tadka", "Morning Bullet Coffee"]),
                    dietary_tags=json.dumps(["Vegetarian", "Keto", "Traditional Ayurvedic"]),
                    emoji="🧈",
                    approval_status="pending",
                ),
                Food(
                    name="Golden Roasted Flax Seeds",
                    barcode="8901234567826",
                    category="Nuts & Seeds",
                    nutrition_tags=json.dumps(["fiber_rich", "fat_sources", "mineral_sources"]),
                    description="Slow-roasted golden flax seeds rich in soluble mucilage fiber and heart-protective lignans.",
                    price_paise=14000,
                    unit="250g jar",
                    serving_size="20g",
                    stock_qty=70,
                    calories=534,
                    protein_g=18.3,
                    carbs_g=28.9,
                    fat_g=42.2,
                    fibre_g=27.3,
                    vitamins_json=json.dumps({"omega3_ala_g": 22.8, "lignans_mg": 300, "magnesium_mg": 392}),
                    ingredients="100% Certified Golden Flax Seeds (Linum usitatissimum)",
                    storage_info="Store in an airtight jar in a cool, dry cabinet.",
                    prep_methods=json.dumps(["Fresh Ground Meal", "Yoghurt Sprinkle", "Warm Water Infusion"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "High-Fiber"]),
                    emoji="✨",
                    approval_status="pending",
                ),
                Food(
                    name="Whole Red Masoor Lentils",
                    barcode="8901234567827",
                    category="Dal and pulses",
                    nutrition_tags=json.dumps(["protein_rich", "iron_rich", "fiber_rich"]),
                    description="Unpolished whole red masoor lentils rich in Folate, iron, and slow-burning complex carbs.",
                    price_paise=13500,
                    unit="1 kg pack",
                    serving_size="100g raw",
                    stock_qty=85,
                    calories=343,
                    protein_g=25.8,
                    carbs_g=60.1,
                    fat_g=1.1,
                    fibre_g=10.8,
                    vitamins_json=json.dumps({"iron_mg": 7.5, "folate_mcg": 479, "potassium_mg": 677}),
                    ingredients="100% Whole Brown-Skinned Red Lentils (Lens culinaris)",
                    storage_info="Keep in an airtight pantry canister.",
                    prep_methods=json.dumps(["Pressure Cooked Tadka Dal", "Sprouted Salad", "Hearty Lentil Soup"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "High-Protein"]),
                    emoji="🫘",
                    approval_status="pending",
                ),
                Food(
                    name="Unpolished Single-Origin Brown Rice",
                    barcode="8901234567828",
                    category="Grains & Pseudocereals",
                    nutrition_tags=json.dumps(["carb_rich", "fiber_rich", "mineral_sources"]),
                    description="Traditional unpolished whole grain rice retaining bran and germ for sustained glucose stability.",
                    price_paise=9500,
                    unit="1 kg pack",
                    serving_size="100g cooked",
                    stock_qty=95,
                    calories=354,
                    protein_g=7.9,
                    carbs_g=76.5,
                    fat_g=2.7,
                    fibre_g=3.5,
                    vitamins_json=json.dumps({"thiamine_mg": 0.41, "magnesium_mg": 143, "phosphorus_mg": 264}),
                    ingredients="100% Single-Origin Unpolished Brown Rice (Oryza sativa)",
                    storage_info="Store in a cool dry place.",
                    prep_methods=json.dumps(["Soaked Simmer (35 mins)", "Wholesome Khichdi", "Steamed Meal Base"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free", "Low-GI"]),
                    emoji="🍚",
                    approval_status="pending",
                ),
                Food(
                    name="Traditional Clay Pot Desi Curd",
                    barcode="8901234567829",
                    category="Dairy & Probiotics",
                    nutrition_tags=json.dumps(["protein_rich", "calcium_rich"]),
                    description="Naturally fermented desi cow milk curd set in porous terracotta pots for cooling probiotic gut health.",
                    price_paise=6000,
                    unit="500g clay pot",
                    serving_size="100g",
                    stock_qty=50,
                    calories=61,
                    protein_g=3.5,
                    carbs_g=4.7,
                    fat_g=3.3,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"calcium_mg": 121, "phosphorus_mg": 95, "vitamin_b12_mcg": 0.4}),
                    ingredients="Pasteurized Whole Cow Milk, Lactic Culture Starter",
                    storage_info="Refrigerate at 2°C to 4°C. Consume within 3 days.",
                    prep_methods=json.dumps(["Chilled with Cumin Salt", "Buttermilk Majjiga", "Curd Rice (Thayir Sadam)"]),
                    dietary_tags=json.dumps(["Vegetarian", "Gut-Health", "Cooling"]),
                    emoji="🍶",
                    approval_status="pending",
                ),
                Food(
                    name="Cold-Pressed Wood Churned Sesame Oil",
                    barcode="8901234567830",
                    category="Healthy Oils & Fats",
                    nutrition_tags=json.dumps(["fat_sources"]),
                    description="Unrefined wood-pressed (vaagai marachekku) sesame oil rich in antioxidant Sesamol and lignans.",
                    price_paise=23000,
                    unit="500 ml bottle",
                    serving_size="15ml",
                    stock_qty=45,
                    calories=884,
                    protein_g=0.0,
                    carbs_g=0.0,
                    fat_g=100.0,
                    fibre_g=0.0,
                    vitamins_json=json.dumps({"sesamol_mg": 15.0, "vitamin_e_mg": 1.4, "mufa_g": 39.7}),
                    ingredients="100% First-Press Native Sesame Seeds (Sesamum indicum)",
                    storage_info="Amber glass bottle in cool cabinet away from heat.",
                    prep_methods=json.dumps(["Traditional Idli Podi Drizzle", "Low-Heat Sauté", "Tempering"]),
                    dietary_tags=json.dumps(["Vegan", "Unrefined", "Heart-Healthy"]),
                    emoji="🫒",
                    approval_status="pending",
                ),
                Food(
                    id="f-frac-1",
                    name="Fractional Test Grain",
                    barcode="8901111999999",
                    category="Grains & Pseudocereals",
                    nutrition_tags=json.dumps(["carb_rich", "fiber_rich"]),
                    description="Fractional test grain for accurate paise currency formatting.",
                    price_paise=3350,
                    unit="100g",
                    serving_size="50g",
                    stock_qty=50,
                    calories=100.0,
                    protein_g=4.0,
                    carbs_g=20.0,
                    fat_g=1.0,
                    fibre_g=2.0,
                    vitamins_json=json.dumps({}),
                    ingredients="100% Whole Test Grain",
                    storage_info="Store in a cool dry place.",
                    prep_methods=json.dumps(["Boiled"]),
                    dietary_tags=json.dumps(["Vegan", "Gluten-Free"]),
                    emoji="🌾",
                    approval_status="approved",
                    active=True,
                ),
            ]
            existing_ids = set(session.scalars(select(Food.id)).all())
            existing_barcodes = set(session.scalars(select(Food.barcode)).all())
            existing_names = set(session.scalars(select(Food.name)).all())
            for f in catalog_foods:
                if (f.id and f.id in existing_ids) or (f.barcode and f.barcode in existing_barcodes) or f.name in existing_names:
                    continue
                session.add(f)
            session.commit()

        # 3. Seed Calin Pack Tiers
        if session.scalar(select(CalinPackTier.id)) is None:
            tiers = [
                CalinPackTier(
                    tier="basic",
                    name="Calin Basic Pack",
                    base_price_paise=69900,
                    description="A foundational starter bundle pairing staple legumes, grains, and leafy greens for daily baseline nutrition.",
                    target_audience="College students, young adults, and beginners wanting clean staple nutrition without hassle.",
                    max_substitutions=2,
                    items_json=json.dumps(
                        [
                            {"food_name": "Sprouted Chickpeas", "qty": "500g", "nutrient": "Plant Protein + Iron"},
                            {"food_name": "Tender Baby Spinach", "qty": "250g", "nutrient": "Folate + Vitamin K"},
                            {"food_name": "Roasted Sweet Potato", "qty": "1kg", "nutrient": "Slow Energy + Vitamin A"},
                            {"food_name": "Organic Rolled Oats", "qty": "1kg", "nutrient": "Beta-Glucan Fiber"},
                            {"food_name": "Organic Black Chia Seeds", "qty": "250g", "nutrient": "Omega-3 ALA"},
                            {"food_name": "Sprouted Green Moong", "qty": "500g", "nutrient": "Digestive Protein"},
                        ]
                    ),
                ),
                CalinPackTier(
                    tier="minimal_plus",
                    name="Calin Minimal Plus Pack",
                    base_price_paise=109900,
                    description="Our most popular balanced bundle with expanded variety, probiotic gut support, and diverse antioxidants.",
                    target_audience="Busy working professionals and active adults needing sustained daily vitality.",
                    max_substitutions=3,
                    items_json=json.dumps(
                        [
                            {"food_name": "Sprouted Chickpeas", "qty": "500g", "nutrient": "Plant Protein + Iron"},
                            {"food_name": "Tender Baby Spinach", "qty": "250g", "nutrient": "Folate + Vitamin K"},
                            {"food_name": "Roasted Sweet Potato", "qty": "1kg", "nutrient": "Complex Carbs"},
                            {"food_name": "Probiotic Greek Yoghurt", "qty": "400g", "nutrient": "Calcium + Gut Health"},
                            {"food_name": "Organic White Quinoa", "qty": "500g", "nutrient": "Complete Amino Acids"},
                            {"food_name": "Wild Blueberries", "qty": "250g", "nutrient": "Antioxidant Anthocyanins"},
                            {"food_name": "Raw California Almonds", "qty": "500g", "nutrient": "Vitamin E + Magnesium"},
                            {"food_name": "Organic Black Chia Seeds", "qty": "250g", "nutrient": "Omega-3 ALA"},
                            {"food_name": "Fresh Organic Broccoli", "qty": "400g", "nutrient": "Sulforaphane + Vitamin C"},
                            {"food_name": "Organic Rolled Oats", "qty": "1kg", "nutrient": "Beta-Glucan Fiber"},
                        ]
                    ),
                ),
                CalinPackTier(
                    tier="premium",
                    name="Calin Premium Pack",
                    base_price_paise=169900,
                    description="Maximum variety, high micronutrient density, and artisanal cold-pressed ingredients for deep nourishment.",
                    target_audience="Fitness enthusiasts, gymgoers, and holistic wellness seekers.",
                    max_substitutions=5,
                    items_json=json.dumps(
                        [
                            {"food_name": "Sprouted Chickpeas", "qty": "500g", "nutrient": "Plant Protein + Iron"},
                            {"food_name": "Tender Baby Spinach", "qty": "250g", "nutrient": "Folate + Vitamin K"},
                            {"food_name": "Roasted Sweet Potato", "qty": "1kg", "nutrient": "Complex Carbs"},
                            {"food_name": "Probiotic Greek Yoghurt", "qty": "400g", "nutrient": "Calcium + Gut Health"},
                            {"food_name": "Organic White Quinoa", "qty": "500g", "nutrient": "Complete Amino Acids"},
                            {"food_name": "Wild Blueberries", "qty": "250g", "nutrient": "Antioxidants"},
                            {"food_name": "Raw California Almonds", "qty": "500g", "nutrient": "Vitamin E + Magnesium"},
                            {"food_name": "Organic Black Chia Seeds", "qty": "250g", "nutrient": "Omega-3 ALA"},
                            {"food_name": "Sprouted Green Moong", "qty": "500g", "nutrient": "Digestive Protein"},
                            {"food_name": "Cold-Pressed Mustard Oil", "qty": "1L", "nutrient": "Healthy MUFA / PUFA"},
                            {"food_name": "Organic Rolled Oats", "qty": "1kg", "nutrient": "Beta-Glucan Fiber"},
                            {"food_name": "Fresh Organic Broccoli", "qty": "400g", "nutrient": "Sulforaphane + Vitamin C"},
                        ]
                    ),
                ),
            ]
            session.add_all(tiers)
            session.commit()

        # 4. Seed Recipes
        if session.scalar(select(Recipe.id)) is None:
            recipes = [
                Recipe(
                    name="Golden Sprouted Chickpea & Spinach Bowl",
                    description="A vibrant high-iron, high-protein bowl pairing sprouted chickpeas with wilted spinach, lemon, and cumin.",
                    instructions="1. Lightly steam sprouted chickpeas for 6 minutes.\n2. In a skillet, warm 1 tsp cold-pressed oil with cumin seeds.\n3. Add baby spinach at the very end (30 seconds) to preserve heat-sensitive Folate and Vitamin C.\n4. Squeeze fresh lemon juice over chickpeas — Vitamin C boosts non-heme iron absorption by up to 300%!\n5. Serve warm with roasted sweet potato wedges.",
                    prep_method="Flash Steam & Warm Toss",
                    prep_time_mins=18,
                    servings=2,
                    calories=380,
                    protein_g=18.5,
                    emoji="🥗",
                    ingredients_json=json.dumps(
                        [
                            {"name": "Sprouted Chickpeas", "qty": "150", "unit": "g"},
                            {"name": "Tender Baby Spinach", "qty": "80", "unit": "g"},
                            {"name": "Cold-Pressed Mustard Oil", "qty": "10", "unit": "ml"},
                            {"name": "Roasted Sweet Potato", "qty": "100", "unit": "g"},
                        ]
                    ),
                ),
                Recipe(
                    name="Overnight Berry & Chia Protein Jar",
                    description="Slow-digesting prebiotic breakfast packed with soluble beta-glucan, omega-3s, and Greek yoghurt.",
                    instructions="1. In a glass jar, mix rolled oats, chia seeds, and probiotic Greek yoghurt.\n2. Add a splash of water or plant milk and stir well.\n3. Refrigerate overnight (6–8 hours) to activate chia mucilage and soften oat starch.\n4. Top with fresh blueberries and chopped raw almonds before eating.",
                    prep_method="No-Cook Cold Hydration",
                    prep_time_mins=10,
                    servings=1,
                    calories=340,
                    protein_g=21.0,
                    emoji="🫐",
                    ingredients_json=json.dumps(
                        [
                            {"name": "Organic Rolled Oats", "qty": "50", "unit": "g"},
                            {"name": "Probiotic Greek Yoghurt", "qty": "150", "unit": "g"},
                            {"name": "Organic Black Chia Seeds", "qty": "15", "unit": "g"},
                            {"name": "Wild Blueberries", "qty": "40", "unit": "g"},
                            {"name": "Raw California Almonds", "qty": "15", "unit": "g"},
                        ]
                    ),
                ),
                Recipe(
                    name="Warm Quinoa & Steamed Broccoli Power Lunch",
                    description="Complete protein profile combined with natural sulforaphane from lightly steamed broccoli florets.",
                    instructions="1. Rinse white quinoa and simmer in 2x water with a pinch of sea salt for 14 minutes until fluffy.\n2. Steam broccoli florets for exactly 3 to 4 minutes to maximize sulforaphane bioavailability.\n3. Toss together with roasted sweet potato cubes.\n4. Drizzle with cold-pressed oil and roasted almond flakes.",
                    prep_method="Simmer & Steam",
                    prep_time_mins=22,
                    servings=2,
                    calories=420,
                    protein_g=16.0,
                    emoji="🥦",
                    ingredients_json=json.dumps(
                        [
                            {"name": "Organic White Quinoa", "qty": "120", "unit": "g"},
                            {"name": "Fresh Organic Broccoli", "qty": "150", "unit": "g"},
                            {"name": "Roasted Sweet Potato", "qty": "100", "unit": "g"},
                            {"name": "Raw California Almonds", "qty": "20", "unit": "g"},
                        ]
                    ),
                ),
            ]
            session.add_all(recipes)
            session.commit()

        # 5. Seed Authenticated IFCT 2017 Dataset Expansion
        try:
            try:
                from backend.app.services.ifct_ingestion import ingest_ifct_expansion
            except ImportError:
                from app.services.ifct_ingestion import ingest_ifct_expansion
            ingest_ifct_expansion(session, dry_run=False, strict_mode=True)
        except Exception:
            session.rollback()


@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_secret_safety(settings)
    run_migrations()
    seed_initial_data()
    yield


app = FastAPI(
    title="Nutriverse API",
    description="Nutrition-First Grocery & Calin Packs Digital Platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health & Readiness Endpoints
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "nutriverse-api", "version": "2.0.0"}


@app.get("/ready")
def ready(session: Session = Depends(db)) -> dict[str, str]:
    session.execute(select(User.id).limit(1))
    return {"status": "ready", "database": "connected"}


# Auth Endpoints
@app.get("/api/auth/csrf")
def get_csrf(response: Response, request: Request) -> dict[str, str]:
    existing = request.cookies.get("nutriverse_csrf")
    token = existing if existing else generate_csrf_token()
    is_secure = settings.cookie_secure or settings.app_env == "production"
    response.set_cookie(
        key="nutriverse_csrf",
        value=token,
        max_age=settings.refresh_token_expire_days * 86400,
        httponly=False,
        secure=is_secure,
        samesite="lax",
        path="/",
    )
    return {"csrf_token": token}


@app.get("/api/auth/config")
def get_auth_config() -> dict[str, Any]:
    return {
        "app_env": settings.app_env,
        "development": settings.app_env == "development",
        "demo_shortcuts_enabled": settings.app_env == "development",
    }


@app.post("/api/auth/register")
@app.post("/auth/register")
@rate_limit_endpoint(limiter.shared_limit(lambda: settings.rate_limit_register, scope="auth_register"))
def register(
    payload: AuthPayload,
    response: Response,
    request: Request,
    session: Session = Depends(db),
) -> dict[str, Any]:
    verify_csrf(request)
    email_clean = payload.email.lower().strip()
    if session.scalar(select(User).where(User.email == email_clean)):
        raise HTTPException(status_code=409, detail="Email already registered")

    # Prevent privilege escalation: public registrations are strictly assigned Role.user
    user_role = Role.user.value
    user = User(
        name=payload.name.strip(),
        email=email_clean,
        password_hash=PasswordHasher.hash(payload.password),
        role=user_role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user, session)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token, refresh_token, csrf_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "csrf_token": csrf_token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


@app.post("/api/auth/login")
@app.post("/auth/login")
@rate_limit_endpoint(limiter.shared_limit(lambda: settings.rate_limit_login, scope="auth_login"))
def login(
    payload: LoginPayload,
    response: Response,
    request: Request,
    session: Session = Depends(db),
) -> dict[str, Any]:
    verify_csrf(request)
    email_clean = payload.email.lower().strip()
    user = session.scalar(select(User).where(User.email == email_clean))
    if not user or not PasswordHasher.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # If hash is legacy pbkdf2, rehash to bcrypt
    if PasswordHasher.needs_rehash(user.password_hash):
        user.password_hash = PasswordHasher.hash(payload.password)
        session.commit()

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user, session)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token, refresh_token, csrf_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "csrf_token": csrf_token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


class RefreshPayload(BaseModel):
    refresh_token: Optional[str] = None


@app.post("/api/auth/refresh")
@app.post("/auth/refresh")
@rate_limit_endpoint(limiter.shared_limit(lambda: settings.rate_limit_refresh, scope="auth_refresh"))
def refresh(
    response: Response,
    request: Request,
    payload: Optional[RefreshPayload] = None,
    session: Session = Depends(db),
) -> dict[str, Any]:
    verify_csrf(request)
    raw_token = (
        request.cookies.get("nutriverse_refresh")
        or (payload.refresh_token if payload else None)
    )
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    user, new_refresh_token = verify_and_rotate_refresh_token(raw_token, session)
    new_access_token = create_access_token(user)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, new_access_token, new_refresh_token, csrf_token)

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "csrf_token": csrf_token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


@app.post("/api/auth/logout")
def logout(
    response: Response,
    request: Request,
    session: Session = Depends(db),
) -> dict[str, str]:
    verify_csrf(request)
    raw_token = request.cookies.get("nutriverse_refresh")
    if raw_token:
        revoke_refresh_token(raw_token, session)
    clear_auth_cookies(response)
    return {"status": "logged_out"}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat(),
    }


# Profile & Nutrition Engine (Mifflin–St Jeor)
@app.post("/api/profile")
def save_profile(
    payload: ProfilePayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    if payload.age < 18:
        raise HTTPException(
            status_code=422,
            detail="Calin Pack personalized dietary targets require adult age (18+). Please consult a qualified pediatric dietitian."
        )

    # Scientific Mifflin-St Jeor Equation
    bmr = 10 * payload.weight_kg + 6.25 * payload.height_cm - 5 * payload.age + (5 if payload.sex == "male" else -161)
    raw_calories = round(bmr * payload.activity_level)

    # Caloric safety floors: > 1,200 kcal for women, > 1,500 kcal for men
    safety_floor = 1500 if payload.sex == "male" else 1200
    daily_calories = max(raw_calories, safety_floor)

    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if profile is None:
        profile = NutritionProfile(
            user_id=user.id,
            age=payload.age,
            sex=payload.sex,
            height_cm=payload.height_cm,
            weight_kg=payload.weight_kg,
            activity_level=payload.activity_level,
            calorie_target=daily_calories,
            bmr=round(bmr),
            food_preferences=payload.food_preferences or "All foods",
            allergies=payload.allergies or "None",
            budget_paise=getattr(payload, "budget_paise", None) or 150000,
            goal=payload.goal or "Balanced Nourishment",
            calculation_version="mifflin-st-jeor-v1",
        )
        session.add(profile)
    else:
        profile.age = payload.age
        profile.sex = payload.sex
        profile.height_cm = payload.height_cm
        profile.weight_kg = payload.weight_kg
        profile.activity_level = payload.activity_level
        profile.bmr = round(bmr)
        profile.calorie_target = daily_calories
        profile.food_preferences = payload.food_preferences or profile.food_preferences
        profile.allergies = payload.allergies or profile.allergies
        profile.budget_paise = getattr(payload, "budget_paise", None) or profile.budget_paise
        profile.goal = payload.goal or profile.goal
        profile.updated_at = datetime.now(timezone.utc)

    session.commit()
    return {
        "bmr": round(bmr),
        "calorie_target": daily_calories,
        "calculation_formula": "Mifflin-St Jeor: 10*weight(kg) + 6.25*height(cm) - 5*age + (5 male / -161 female)",
        "activity_multiplier": payload.activity_level,
        "safety_floor_applied": daily_calories > raw_calories,
        "version": "mifflin-st-jeor-v1",
        "goal": profile.goal,
        "disclaimer": "Scientific estimation for dietary planning. Not a medical prescription or guaranteed outcome.",
    }


@app.get("/api/profile")
def get_profile(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=404, detail="Nutrition profile not found. Please complete onboarding.")
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "age": profile.age,
        "sex": profile.sex,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "activity_level": profile.activity_level,
        "bmr": profile.bmr,
        "calorie_target": profile.calorie_target,
        "food_preferences": profile.food_preferences,
        "allergies": profile.allergies,
        "budget_paise": profile.budget_paise,
        "goal": profile.goal,
        "calculation_version": profile.calculation_version,
        "consent_revoked_at": profile.consent_revoked_at.isoformat() if profile.consent_revoked_at else None,
    }


@app.post("/api/profile/revoke-consent")
@app.delete("/api/profile/consent")
def revoke_profile_consent(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=404, detail="Nutrition profile not found")
    profile.consent_revoked_at = datetime.now(timezone.utc)
    profile.allergies = "None"
    profile.food_preferences = "General"
    session.add(
        AuditLog(
            user_id=user.id,
            action="health_consent_revoked",
            entity_type="nutrition_profile",
            entity_id=profile.id,
            details=json.dumps({"revoked_at": profile.consent_revoked_at.isoformat()}),
        )
    )
    session.commit()
    return {
        "message": "Health data consent revoked successfully.",
        "consent_revoked_at": profile.consent_revoked_at.isoformat(),
    }


# Phase 5: Deterministic Personalized Nutrition Target Estimation API
@app.post("/api/nutrition-targets/calculate")
def calculate_nutrition_targets_endpoint(
    payload: NutritionTargetCalculatePayload,
    user: User = Depends(current_user),
) -> dict[str, Any]:
    """Calculates personalized nutrition targets deterministically on-the-fly.

    Does not persist data to the database unless explicit save is invoked.
    """
    try:
        from backend.app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )
    except ImportError:
        from app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )

    try:
        result = calculate_nutrition_targets(
            age=payload.age,
            sex=payload.sex,
            height=payload.height,
            height_unit=payload.height_unit,
            weight=payload.weight,
            weight_unit=payload.weight_unit,
            activity_level=payload.activity_level,
            goal=payload.goal,
            method=payload.method or "mifflin_st_jeor",
            optional_allergies=payload.optional_allergies,
            optional_preferences=payload.optional_preferences,
        )
        return result
    except TargetIneligiblePopulationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except TargetEstimationValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Target estimation validation error: {exc}")


@app.get("/api/nutrition-targets/me")
def get_user_nutrition_targets(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    """Retrieves authenticated user's saved inputs and calculates the latest deterministic targets."""
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile or profile.consent_revoked_at is not None:
        raise HTTPException(
            status_code=404,
            detail="No active personalized nutrition profile found. Please configure your profile inputs."
        )

    try:
        from backend.app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier
    except ImportError:
        from app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier

    is_version_unrecognized = False
    try:
        method_to_use = resolve_method_identifier(profile.calculation_version)
    except Exception:
        method_to_use = "mifflin_st_jeor"
        is_version_unrecognized = True

    estimate = calculate_nutrition_targets(
        age=profile.age,
        sex=profile.sex,
        height=profile.height_cm,
        height_unit="cm",
        weight=profile.weight_kg,
        weight_unit="kg",
        activity_level=profile.activity_level,
        goal=profile.goal,
        method=method_to_use,
        optional_allergies=profile.allergies,
        optional_preferences=profile.food_preferences,
    )

    if is_version_unrecognized:
        estimate["warnings"].insert(
            0,
            f"Notice: Stored profile references an unrecognized or retired calculation method ('{profile.calculation_version}'). "
            "The displayed targets are an illustrative evaluation using the default Mifflin-St Jeor (1990) engine. "
            "Please review your inputs and recalibrate to establish updated targets."
        )

    persisted_cal = profile.calorie_target
    recalculated_cal = int(round(estimate["energy_targets"]["daily_energy_target_kcal"]))
    is_version_match = (profile.calculation_version == estimate["method"]["identifier"])
    is_stale = (persisted_cal != recalculated_cal) or not is_version_match or is_version_unrecognized

    return {
        "profile_id": profile.id,
        "user_id": user.id,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        "consent_revoked_at": None,
        "persisted_snapshot": {
            "calorie_target": profile.calorie_target,
            "bmr": profile.bmr,
            "calculation_version": profile.calculation_version,
            "saved_at": profile.updated_at.isoformat() if profile.updated_at else None,
        },
        "target_freshness": {
            "is_stale": is_stale,
            "persisted_calorie_target": persisted_cal,
            "freshly_calculated_daily_energy_target_kcal": recalculated_cal,
            "persisted_calculation_version": profile.calculation_version,
            "active_engine_version": estimate["method"]["identifier"],
            "version_matched": is_version_match and not is_version_unrecognized,
            "retired_or_unrecognized_version": is_version_unrecognized,
            "note": (
                f"Persisted calculation method '{profile.calculation_version}' is retired or unrecognized. "
                "Displaying default Mifflin-St Jeor (1990) estimate for review; please recalibrate and save your profile."
                if is_version_unrecognized
                else (
                    "Persisted target matches current engine calculation."
                    if not is_stale
                    else "Persisted target differs from latest engine calculation (stale snapshot or formula version update). Recalibration recommended."
                )
            ),
        },
        "saved_inputs": {
            "age": profile.age,
            "sex": profile.sex,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "activity_level": profile.activity_level,
            "goal": profile.goal,
            "food_preferences": profile.food_preferences,
            "allergies": profile.allergies,
            "budget_paise": profile.budget_paise,
            "calculation_version": profile.calculation_version,
            "persisted_calorie_target": profile.calorie_target,
            "persisted_bmr": profile.bmr,
        },
        "estimate": estimate,
    }


@app.put("/api/nutrition-targets/me")
@app.post("/api/nutrition-targets/me")
def save_user_nutrition_targets(
    payload: NutritionTargetProfileSavePayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    """Persists or recalibrates authenticated user's explicit profile inputs with mandatory consent."""
    if not payload.consent_given:
        raise HTTPException(
            status_code=422,
            detail="Explicit user consent is required to process and persist personal biometric and nutritional data."
        )

    try:
        from backend.app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )
    except ImportError:
        from app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )

    try:
        estimate = calculate_nutrition_targets(
            age=payload.age,
            sex=payload.sex,
            height=payload.height,
            height_unit=payload.height_unit,
            weight=payload.weight,
            weight_unit=payload.weight_unit,
            activity_level=payload.activity_level,
            goal=payload.goal,
            method=payload.method or "mifflin_st_jeor",
            optional_allergies=payload.allergies,
            optional_preferences=payload.food_preferences,
        )
    except TargetIneligiblePopulationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except TargetEstimationValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Target estimation validation error: {exc}")

    norm_height_cm = estimate["inputs"]["height"]["normalized_cm"]
    norm_weight_kg = estimate["inputs"]["weight"]["normalized_kg"]
    pal_multiplier = estimate["inputs"]["activity_level"]["pal_multiplier"]
    cal_target = int(round(estimate["energy_targets"]["daily_energy_target_kcal"]))
    bmr_int = int(round(estimate["energy_targets"]["bmr_kcal_day"]))
    method_id = estimate["method"]["identifier"]

    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if profile is None:
        profile = NutritionProfile(
            id=str(uuid4()),
            user_id=user.id,
            age=estimate["inputs"]["age_years"],
            sex=estimate["inputs"]["sex"],
            height_cm=norm_height_cm,
            weight_kg=norm_weight_kg,
            activity_level=pal_multiplier,
            calorie_target=cal_target,
            bmr=bmr_int,
            food_preferences=payload.food_preferences or "All foods",
            allergies=payload.allergies or "None",
            budget_paise=payload.budget_paise or 150000,
            goal=estimate["inputs"]["goal"]["name"],
            calculation_version=method_id,
            consent_revoked_at=None,
        )
        session.add(profile)
    else:
        profile.age = estimate["inputs"]["age_years"]
        profile.sex = estimate["inputs"]["sex"]
        profile.height_cm = norm_height_cm
        profile.weight_kg = norm_weight_kg
        profile.activity_level = pal_multiplier
        profile.calorie_target = cal_target
        profile.bmr = bmr_int
        profile.food_preferences = payload.food_preferences or profile.food_preferences
        profile.allergies = payload.allergies or profile.allergies
        profile.budget_paise = payload.budget_paise or profile.budget_paise
        profile.goal = estimate["inputs"]["goal"]["name"]
        profile.calculation_version = method_id
        profile.consent_revoked_at = None
        profile.updated_at = datetime.now(timezone.utc)

    session.flush()

    session.add(
        AuditLog(
            user_id=user.id,
            action="nutrition_targets_saved",
            entity_type="nutrition_profile",
            entity_id=profile.id,
            details=json.dumps({"method": method_id, "daily_energy_kcal": cal_target}),
        )
    )
    session.commit()

    return {
        "message": "Personalized nutrition targets saved successfully.",
        "profile_id": profile.id,
        "user_id": user.id,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        "persisted_snapshot": {
            "calorie_target": cal_target,
            "bmr": bmr_int,
            "calculation_version": method_id,
            "saved_at": profile.updated_at.isoformat() if profile.updated_at else None,
        },
        "target_freshness": {
            "is_stale": False,
            "persisted_calorie_target": cal_target,
            "freshly_calculated_daily_energy_target_kcal": cal_target,
            "persisted_calculation_version": method_id,
            "active_engine_version": method_id,
            "version_matched": True,
            "note": "Persisted target matches current engine calculation.",
        },
        "saved_inputs": {
            "age": profile.age,
            "sex": profile.sex,
            "height_cm": profile.height_cm,
            "weight_kg": profile.weight_kg,
            "activity_level": profile.activity_level,
            "goal": profile.goal,
            "food_preferences": profile.food_preferences,
            "allergies": profile.allergies,
            "budget_paise": profile.budget_paise,
            "calculation_version": profile.calculation_version,
            "persisted_calorie_target": profile.calorie_target,
            "persisted_bmr": profile.bmr,
        },
        "estimate": estimate,
    }


@app.delete("/api/nutrition-targets/me")
def delete_user_nutrition_targets(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    """Deletes authenticated user's saved nutrition targets and associated biometric profile."""
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile:
        return {
            "message": "No active nutrition targets found to delete.",
            "deleted": False,
        }

    profile_id = profile.id
    session.delete(profile)
    session.add(
        AuditLog(
            user_id=user.id,
            action="nutrition_targets_deleted",
            entity_type="nutrition_profile",
            entity_id=profile_id,
            details=json.dumps({"deleted_at": datetime.now(timezone.utc).isoformat()}),
        )
    )
    session.commit()
    return {
        "message": "Personalized nutrition targets and biometric data deleted successfully.",
        "deleted": True,
    }


# Phase 6.0: Personalized Nutrition Recommendations Engine API
@app.get("/api/recommendations/me")
def get_user_recommendations(
    target_nutrient: str = Query("protein", description="Target nutrient: protein, dietary_fiber, energy, fat, carbohydrates"),
    limit: int = Query(5, ge=1, le=50, description="Max recommendations to return (1-50)"),
    portion_override_g: Optional[float] = Query(None, gt=0, le=2000.0, description="Optional portion mass override in grams"),
    strict_verified: bool = Query(True, description="Strict mode requires 'verified_reference' data status"),
    food_state: str = Query("raw", description="Food preparation state (raw vs cooked)"),
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    """Generates personalized food recommendations based on authenticated user's verified targets.

    Deterministic, traceable, read-only. Excludes foods with unknown nutrient values.
    """
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile or profile.consent_revoked_at is not None:
        raise HTTPException(
            status_code=403,
            detail="Personalized nutrition recommendations require an active profile and explicit biometric consent. Please configure your profile targets."
        )

    try:
        from backend.app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier
    except ImportError:
        from app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier

    is_version_unrecognized = False
    try:
        method_to_use = resolve_method_identifier(profile.calculation_version)
    except Exception:
        method_to_use = "mifflin_st_jeor"
        is_version_unrecognized = True

    try:
        estimate = calculate_nutrition_targets(
            age=profile.age,
            sex=profile.sex,
            height=profile.height_cm,
            height_unit="cm",
            weight=profile.weight_kg,
            weight_unit="kg",
            activity_level=profile.activity_level,
            goal=profile.goal,
            method=method_to_use,
            optional_allergies=profile.allergies,
            optional_preferences=profile.food_preferences,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Target calculation error: {exc}")

    persisted_cal = profile.calorie_target
    recalculated_cal = int(round(estimate["energy_targets"]["daily_energy_target_kcal"]))
    is_version_match = (profile.calculation_version == estimate["method"]["identifier"])
    is_stale = (persisted_cal != recalculated_cal) or not is_version_match or is_version_unrecognized

    try:
        from backend.app.services.recommendations import (
            generate_recommendations,
            UnsupportedTargetNutrientError,
            TargetEligibilityError,
            InvalidPortionError,
        )
    except ImportError:
        from app.services.recommendations import (
            generate_recommendations,
            UnsupportedTargetNutrientError,
            TargetEligibilityError,
            InvalidPortionError,
        )

    try:
        result = generate_recommendations(
            session=session,
            target_nutrient=target_nutrient,
            target_estimate=estimate,
            user_allergies=profile.allergies,
            limit=limit,
            portion_override_g=portion_override_g,
            strict_verified=strict_verified,
            food_state=food_state,
            stale_target_warning=is_stale,
            retired_version_warning=is_version_unrecognized,
        )
        result["user_id"] = user.id
        result["profile_id"] = profile.id
        result["target_freshness"] = {
            "is_stale": is_stale,
            "persisted_calorie_target": persisted_cal,
            "freshly_calculated_daily_energy_target_kcal": recalculated_cal,
            "persisted_calculation_version": profile.calculation_version,
            "active_engine_version": estimate["method"]["identifier"],
            "version_matched": is_version_match and not is_version_unrecognized,
            "retired_or_unrecognized_version": is_version_unrecognized,
        }
        return result
    except UnsupportedTargetNutrientError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except (TargetEligibilityError, InvalidPortionError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Recommendation error: {exc}")


@app.post("/api/recommendations/calculate")
def calculate_recommendations_endpoint(
    payload: RecommendationCalculatePayload,
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    """Calculates personalized food recommendations statelessly from explicit inputs.

    Enforces authentication and CSRF. Does not persist profile or mutate inventory/cart.
    """
    verify_csrf(request)

    try:
        from backend.app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )
    except ImportError:
        from app.nutrition_targets import (
            calculate_nutrition_targets,
            TargetEstimationValidationError,
            TargetIneligiblePopulationError,
        )

    try:
        estimate = calculate_nutrition_targets(
            age=payload.age,
            sex=payload.sex,
            height=payload.height,
            height_unit=payload.height_unit,
            weight=payload.weight,
            weight_unit=payload.weight_unit,
            activity_level=payload.activity_level,
            goal=payload.goal,
            method=payload.method or "mifflin_st_jeor",
            optional_allergies=payload.optional_allergies,
            optional_preferences=payload.optional_preferences,
        )
    except TargetIneligiblePopulationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except TargetEstimationValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Target estimation error: {exc}")

    try:
        from backend.app.services.recommendations import (
            generate_recommendations,
            UnsupportedTargetNutrientError,
            TargetEligibilityError,
            InvalidPortionError,
        )
    except ImportError:
        from app.services.recommendations import (
            generate_recommendations,
            UnsupportedTargetNutrientError,
            TargetEligibilityError,
            InvalidPortionError,
        )

    try:
        result = generate_recommendations(
            session=session,
            target_nutrient=payload.target_nutrient,
            target_estimate=estimate,
            user_allergies=payload.optional_allergies,
            limit=payload.limit or 5,
            portion_override_g=payload.portion_override_g,
            strict_verified=payload.strict_verified if payload.strict_verified is not None else True,
            food_state=payload.food_state or "raw",
            stale_target_warning=False,
            retired_version_warning=False,
        )
        result["user_id"] = user.id
        result["target_freshness"] = None
        return result
    except UnsupportedTargetNutrientError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except (TargetEligibilityError, InvalidPortionError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Recommendation error: {exc}")


# Foods & Nutrition-First Catalog
@app.get("/api/foods", response_model=List[FoodOut])
def list_foods(
    q: str = Query("", max_length=80),
    nutrition_tag: Optional[str] = Query(None, description="protein_rich, carb_rich, fat_sources, vitamin_sources, mineral_sources, fiber_rich, iron_rich, calcium_rich"),
    category: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    sort_by: str = Query("name", pattern="^(name|price_asc|price_desc|protein|calories)$"),
    session: Session = Depends(db),
) -> List[Food]:
    query = select(Food).where(Food.active.is_(True))

    if q.strip():
        search = f"%{q.strip()}%"
        query = query.where(Food.name.ilike(search) | Food.description.ilike(search) | Food.ingredients.ilike(search))

    if category:
        cat_lower = category.lower().strip()
        category_aliases: dict[str, list[str]] = {
            "dal and pulses": ["Dal and pulses", "Legumes & Pulses", "Plant Proteins"],
            "legumes & pulses": ["Legumes & Pulses", "Dal and pulses", "Plant Proteins"],
            "fresh produce": ["Fresh produce", "Vegetables", "Leafy Greens", "Tubers & Roots", "Cruciferous & Greens", "Alliums & Aromatics"],
            "vegetables": ["Vegetables", "Fresh produce", "Leafy Greens", "Tubers & Roots", "Cruciferous & Greens", "Alliums & Aromatics"],
            "fruits": ["Fruits", "Berries & Fruits"],
            "berries & fruits": ["Berries & Fruits", "Fruits"],
            "rice and grains": ["Rice and grains", "Grains & Pseudocereals", "Grains"],
            "grains & pseudocereals": ["Grains & Pseudocereals", "Rice and grains", "Grains"],
            "grains": ["Grains", "Grains & Pseudocereals", "Rice and grains"],
            "healthy fats": ["Healthy fats", "Healthy Oils & Fats"],
            "healthy oils & fats": ["Healthy Oils & Fats", "Healthy fats"],
            "dairy & probiotics": ["Dairy & Probiotics"],
            "alliums & aromatics": ["Alliums & Aromatics"],
            "nuts & seeds": ["Nuts & Seeds"],
            "leafy greens": ["Leafy Greens"],
            "tubers & roots": ["Tubers & Roots"],
            "cruciferous & greens": ["Cruciferous & Greens"],
            "plant proteins": ["Plant Proteins", "Legumes & Pulses", "Dal and pulses"],
        }
        matching_cats = category_aliases.get(cat_lower, [category])
        query = query.where(Food.category.in_(matching_cats))

    if min_price is not None:
        query = query.where(Food.price_paise >= min_price)
    if max_price is not None:
        query = query.where(Food.price_paise <= max_price)

    # Sorting
    if sort_by == "price_asc":
        query = query.order_by(Food.price_paise.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Food.price_paise.desc())
    elif sort_by == "protein":
        query = query.order_by(Food.protein_g.desc())
    elif sort_by == "calories":
        query = query.order_by(Food.calories.desc())
    else:
        query = query.order_by(Food.name.asc())

    all_foods = list(session.scalars(query.limit(100)))

    # Filter by multi-nutrient tag if provided
    if nutrition_tag:
        all_foods = [f for f in all_foods if nutrition_tag in json.loads(f.nutrition_tags or "[]")]

    return all_foods


@app.get("/api/foods/{food_id}", response_model=FoodOut)
def get_food(food_id: str, session: Session = Depends(db)) -> Food:
    food = session.get(Food, food_id)
    if not food or not food.active:
        raise HTTPException(status_code=404, detail="Food item not found")
    return food


@app.get("/api/foods/barcode/{barcode}", response_model=FoodOut)
def get_food_by_barcode(barcode: str, session: Session = Depends(db)) -> Food:
    clean_code = barcode.strip()
    food = session.scalar(select(Food).where(Food.barcode == clean_code, Food.active.is_(True)))
    if not food:
        raise HTTPException(
            status_code=404,
            detail=f"No product found matching barcode {clean_code}. Try 8901234567890 (Chickpeas) or 8901234567893 (Greek Yoghurt).",
        )
    return food


# Exact Barcode Lookup with Normalization, Provenance & Safe External Integration (Phase 4 & 4.1)
@app.get("/api/barcode/lookup/{barcode}")
def lookup_barcode_endpoint(
    barcode: str,
    refresh: bool = False,
    session: Session = Depends(db),
) -> dict[str, Any]:
    try:
        from backend.app.services.barcode_lookup import (
            lookup_exact_barcode,
            BarcodeValidationError,
        )
        from backend.app.services.openfoodfacts import (
            OpenFoodFactsError,
            OpenFoodFactsRateLimitError,
            OpenFoodFactsTimeoutError,
            OpenFoodFactsBarcodeMismatchError,
        )
    except ImportError:
        from app.services.barcode_lookup import (
            lookup_exact_barcode,
            BarcodeValidationError,
        )
        from app.services.openfoodfacts import (
            OpenFoodFactsError,
            OpenFoodFactsRateLimitError,
            OpenFoodFactsTimeoutError,
            OpenFoodFactsBarcodeMismatchError,
        )

    try:
        allow_synthetic = (
            settings.allow_synthetic_barcodes
            if settings.app_env != "production"
            else False
        )
        result = lookup_exact_barcode(
            barcode=barcode,
            session=session,
            force_refresh=refresh,
            allow_synthetic=allow_synthetic,
        )
        if result is None:
            clean_b = barcode.strip()
            raise HTTPException(
                status_code=404,
                detail=f"No product found matching barcode '{clean_b}' in local catalog or Open Food Facts.",
            )
        return result
    except BarcodeValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except OpenFoodFactsBarcodeMismatchError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except OpenFoodFactsRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Open Food Facts upstream rate limit exceeded. Please retry in a few moments.",
        )
    except OpenFoodFactsTimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Open Food Facts upstream service timed out.",
        )
    except OpenFoodFactsError:
        raise HTTPException(
            status_code=502,
            detail="Open Food Facts upstream service is temporarily unavailable. Please retry later.",
        )



# Nutrition Categories Breakdown
@app.get("/api/categories")
def get_categories(session: Session = Depends(db)) -> dict[str, Any]:
    conventional = list(session.scalars(select(Food.category).distinct()))
    nutrition_categories = [
        {"id": "protein_rich", "label": "Protein-Rich Foods", "description": "High-density plant & clean dairy protein to support tissue repair and satiety."},
        {"id": "carb_rich", "label": "Complex Carbohydrates", "description": "Slow-release low-GI complex carbs for steady energy stamina."},
        {"id": "fat_sources", "label": "Healthy Fat Sources", "description": "Monounsaturated and Omega-3 rich whole foods for hormone & brain vitality."},
        {"id": "vitamin_sources", "label": "Vitamin Powerhouses", "description": "Bioavailable vitamins A, C, Folate, and K from vibrant raw produce."},
        {"id": "mineral_sources", "label": "Essential Minerals", "description": "Magnesium, potassium, zinc, and trace minerals for enzyme function."},
        {"id": "fiber_rich", "label": "Dietary Fiber & Prebiotics", "description": "Soluble beta-glucans and insoluble fiber for healthy gut microbiome."},
        {"id": "iron_rich", "label": "Bioavailable Iron", "description": "Plant-based non-heme iron paired with supporting nutrient boosters."},
        {"id": "calcium_rich", "label": "Calcium & Bone Support", "description": "Calcium-dense whole foods without synthetic fortification."},
    ]
    return {
        "nutrition_categories": nutrition_categories,
        "conventional_categories": conventional,
    }


# Recipes & Prep
@app.get("/api/recipes", response_model=List[RecipeOut])
def list_recipes(session: Session = Depends(db)) -> List[Recipe]:
    return list(session.scalars(select(Recipe).where(Recipe.active.is_(True)).order_by(Recipe.name)))


@app.get("/api/recipes/{recipe_id}", response_model=RecipeOut)
def get_recipe(recipe_id: str, session: Session = Depends(db)) -> Recipe:
    recipe = session.get(Recipe, recipe_id)
    if not recipe or not recipe.active:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


# Deterministic Nutrition Engine Endpoints
@app.post("/api/combinations/calculate")
def calculate_combination(
    payload: CombinationRequest,
    session: Session = Depends(db),
) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Please provide at least one food item")

    try:
        from backend.app.nutrition_engine import (
            calculate_combination_nutrition,
            NutritionCalculationError,
        )
    except ImportError:
        from app.nutrition_engine import (
            calculate_combination_nutrition,
            NutritionCalculationError,
        )

    try:
        return calculate_combination_nutrition(
            items=payload.items,
            session=session,
            mode=payload.mode or "standard",
        )
    except NutritionCalculationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/nutrition/calculate")
def calculate_nutrition(
    payload: NutritionCalculateRequest,
    session: Session = Depends(db),
) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Please provide at least one food item")

    try:
        from backend.app.nutrition_engine import (
            calculate_combination_nutrition,
            NutritionCalculationError,
        )
    except ImportError:
        from app.nutrition_engine import (
            calculate_combination_nutrition,
            NutritionCalculationError,
        )

    try:
        return calculate_combination_nutrition(
            items=payload.items,
            session=session,
            mode=payload.mode or "standard",
        )
    except NutritionCalculationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/recipes/calculate")
def calculate_recipe_endpoint(
    payload: RecipeCalculateRequest,
    session: Session = Depends(db),
) -> dict[str, Any]:
    try:
        from backend.app.nutrition_engine import (
            calculate_recipe_nutrition,
            NutritionCalculationError,
        )
    except ImportError:
        from app.nutrition_engine import (
            calculate_recipe_nutrition,
            NutritionCalculationError,
        )

    try:
        return calculate_recipe_nutrition(
            recipe_id=payload.recipe_id,
            session=session,
            servings=payload.servings,
            mode=payload.mode or "standard",
        )
    except NutritionCalculationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/recipes/{recipe_id}/nutrition")
def get_recipe_nutrition(
    recipe_id: str,
    servings: Optional[int] = None,
    mode: str = "standard",
    session: Session = Depends(db),
) -> dict[str, Any]:
    try:
        from backend.app.nutrition_engine import (
            calculate_recipe_nutrition,
            NutritionCalculationError,
        )
    except ImportError:
        from app.nutrition_engine import (
            calculate_recipe_nutrition,
            NutritionCalculationError,
        )

    try:
        return calculate_recipe_nutrition(
            recipe_id=recipe_id,
            session=session,
            servings=servings,
            mode=mode,
        )
    except NutritionCalculationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# Daily Food Intake Logging & Nutrition Dashboard Tracking
@app.get("/api/nutrition/daily-log", response_model=DailyNutritionSummaryOut)
def get_daily_food_log(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> DailyNutritionSummaryOut:
    logs = session.scalars(
        select(DailyFoodLog)
        .where(DailyFoodLog.user_id == user.id, DailyFoodLog.date == date)
        .order_by(DailyFoodLog.created_at.asc())
    ).all()

    consumed = {
        "calories": 0.0,
        "protein_g": 0.0,
        "carbs_g": 0.0,
        "fat_g": 0.0,
        "fibre_g": 0.0,
    }
    micronutrients_found: Dict[str, float] = {}
    completeness_notes: List[str] = []

    for item in logs:
        consumed["calories"] += item.calories or 0.0
        consumed["protein_g"] += item.protein_g or 0.0
        consumed["carbs_g"] += item.carbs_g or 0.0
        consumed["fat_g"] += item.fat_g or 0.0
        consumed["fibre_g"] += item.fibre_g or 0.0

        if item.data_completeness == "partial":
            completeness_notes.append(f"{item.food_name}: Contains unverified or unknown micronutrient fields; not assumed zero.")

        try:
            nutrients_dict = json.loads(item.nutrients_json or "{}")
            for k, v in nutrients_dict.items():
                if isinstance(v, (int, float)) and v is not None:
                    micronutrients_found[k] = micronutrients_found.get(k, 0.0) + float(v)
        except Exception:
            pass

    consumed_totals = {k: round(v, 1) for k, v in consumed.items()}
    consumed_totals["calories"] = round(consumed["calories"])

    # Fetch user's calculated targets if active
    target_totals: Optional[Dict[str, float]] = None
    remaining: Optional[Dict[str, float]] = None
    progress_percentage: Optional[Dict[str, float]] = None

    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if profile and profile.consent_revoked_at is None:
        try:
            from backend.app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier
        except ImportError:
            from app.nutrition_targets import calculate_nutrition_targets, resolve_method_identifier
        try:
            method_to_use = resolve_method_identifier(profile.calculation_version)
        except Exception:
            method_to_use = "mifflin_st_jeor"

        try:
            est = calculate_nutrition_targets(
                age=profile.age,
                sex=profile.sex,
                height=profile.height_cm,
                height_unit="cm",
                weight=profile.weight_kg,
                weight_unit="kg",
                activity_level=profile.activity_level,
                goal=profile.goal,
                method=method_to_use,
                optional_allergies=profile.allergies,
                optional_preferences=profile.food_preferences,
            )
            cal_tgt = est["energy_targets"]["daily_energy_target_kcal"]
            prot_tgt = est["macronutrient_targets"]["protein"]["target_g_day"]
            fat_tgt = est["macronutrient_targets"]["fat"]["target_g_day"]
            carb_tgt = est["macronutrient_targets"]["carbohydrates"]["target_g_day"]
            fib_tgt = est["macronutrient_targets"]["dietary_fiber"]["target_g_day"]

            target_totals = {
                "calories": round(cal_tgt),
                "protein_g": round(prot_tgt, 1),
                "fat_g": round(fat_tgt, 1),
                "carbs_g": round(carb_tgt, 1),
                "fibre_g": round(fib_tgt, 1),
            }

            remaining = {
                "calories": max(0.0, round(cal_tgt - consumed_totals["calories"])),
                "protein_g": max(0.0, round(prot_tgt - consumed_totals["protein_g"], 1)),
                "fat_g": max(0.0, round(fat_tgt - consumed_totals["fat_g"], 1)),
                "carbs_g": max(0.0, round(carb_tgt - consumed_totals["carbs_g"], 1)),
                "fibre_g": max(0.0, round(fib_tgt - consumed_totals["fibre_g"], 1)),
            }

            def pct(c: float, t: float) -> float:
                return round(min(100.0, (c / t) * 100.0), 1) if t > 0 else 0.0

            progress_percentage = {
                "calories": pct(consumed_totals["calories"], cal_tgt),
                "protein_g": pct(consumed_totals["protein_g"], prot_tgt),
                "fat_g": pct(consumed_totals["fat_g"], fat_tgt),
                "carbs_g": pct(consumed_totals["carbs_g"], carb_tgt),
                "fibre_g": pct(consumed_totals["fibre_g"], fib_tgt),
            }
        except Exception:
            pass

    return DailyNutritionSummaryOut(
        date=date,
        items=[
            DailyFoodLogOut(
                id=item.id,
                date=item.date,
                food_id=item.food_id,
                food_name=item.food_name,
                meal_type=item.meal_type,
                quantity=item.quantity,
                unit=item.unit,
                mass_g=item.mass_g,
                calories=item.calories,
                protein_g=item.protein_g,
                carbs_g=item.carbs_g,
                fat_g=item.fat_g,
                fibre_g=item.fibre_g,
                nutrients_json=item.nutrients_json,
                source_basis=item.source_basis,
                data_completeness=item.data_completeness,
                created_at=item.created_at,
            )
            for item in logs
        ],
        consumed_totals=consumed_totals,
        target_totals=target_totals,
        remaining=remaining,
        progress_percentage=progress_percentage,
        data_completeness_notes=list(set(completeness_notes)),
    )


@app.post("/api/nutrition/daily-log", response_model=DailyFoodLogOut)
def log_daily_food(
    payload: DailyFoodLogCreatePayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> DailyFoodLogOut:
    log_date = payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    try:
        from backend.app.nutrition_engine import (
            convert_quantity_to_grams,
            calculate_food_portion_nutrients,
            IncompatibleUnitError,
            CalculationMode,
        )
    except ImportError:
        from app.nutrition_engine import (
            convert_quantity_to_grams,
            calculate_food_portion_nutrients,
            IncompatibleUnitError,
            CalculationMode,
        )

    food: Optional[Food] = None
    if payload.food_id:
        food = session.get(Food, payload.food_id)
        if not food:
            raise HTTPException(status_code=404, detail=f"Food '{payload.food_id}' not found.")
    elif payload.food_name:
        food = session.scalar(
            select(Food).where(Food.name.ilike(payload.food_name.strip()), Food.active.is_(True))
        )
        if not food:
            raise HTTPException(
                status_code=404,
                detail=f"Food '{payload.food_name}' not found in catalog. Please select a verified catalog food."
            )
    else:
        raise HTTPException(status_code=400, detail="Either food_id or food_name must be provided.")

    try:
        mass_g, assumptions = convert_quantity_to_grams(
            quantity=payload.quantity,
            unit=payload.unit,
            food=food,
        )
    except IncompatibleUnitError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    portion_result = calculate_food_portion_nutrients(
        food=food,
        mass_g=mass_g,
        session=session,
        mode=CalculationMode.STANDARD,
        food_state=payload.food_state,
    )

    nutrients = portion_result.get("nutrients", {})
    calories = nutrients.get("energy_kcal", {}).get("amount") if nutrients.get("energy_kcal") else None
    if calories is None:
        calories = round(food.calories * (mass_g / 100.0), 1)

    protein_g = nutrients.get("protein_g", {}).get("amount") if nutrients.get("protein_g") else None
    if protein_g is None:
        protein_g = round(food.protein_g * (mass_g / 100.0), 1)

    carbs_g = nutrients.get("carbohydrates_g", {}).get("amount") if nutrients.get("carbohydrates_g") else None
    if carbs_g is None:
        carbs_g = round(food.carbs_g * (mass_g / 100.0), 1)

    fat_g = nutrients.get("fat_total_g", {}).get("amount") if nutrients.get("fat_total_g") else None
    if fat_g is None:
        fat_g = round(food.fat_g * (mass_g / 100.0), 1)

    fibre_g = nutrients.get("dietary_fiber_g", {}).get("amount") if nutrients.get("dietary_fiber_g") else None
    if fibre_g is None:
        fibre_g = round(food.fibre_g * (mass_g / 100.0), 1)

    has_partial = any(n.get("is_unknown") for n in nutrients.values())

    raw_nutrients = {}
    for code, info in nutrients.items():
        if info.get("amount") is not None:
            raw_nutrients[code] = info["amount"]

    daily_entry = DailyFoodLog(
        user_id=user.id,
        date=log_date,
        food_id=food.id,
        food_name=food.name,
        meal_type=payload.meal_type,
        quantity=payload.quantity,
        unit=payload.unit,
        mass_g=round(mass_g, 2),
        calories=round(float(calories), 1),
        protein_g=round(float(protein_g), 1),
        carbs_g=round(float(carbs_g), 1),
        fat_g=round(float(fat_g), 1),
        fibre_g=round(float(fibre_g), 1),
        nutrients_json=json.dumps(raw_nutrients),
        source_basis="verified_ifct_reference" if any(fn.verification_status == "verified_reference" for fn in food.nutrients_rel) else "catalog",
        data_completeness="partial" if has_partial else "verified",
    )
    session.add(daily_entry)
    session.commit()
    session.refresh(daily_entry)

    return DailyFoodLogOut(
        id=daily_entry.id,
        date=daily_entry.date,
        food_id=daily_entry.food_id,
        food_name=daily_entry.food_name,
        meal_type=daily_entry.meal_type,
        quantity=daily_entry.quantity,
        unit=daily_entry.unit,
        mass_g=daily_entry.mass_g,
        calories=daily_entry.calories,
        protein_g=daily_entry.protein_g,
        carbs_g=daily_entry.carbs_g,
        fat_g=daily_entry.fat_g,
        fibre_g=daily_entry.fibre_g,
        nutrients_json=daily_entry.nutrients_json,
        source_basis=daily_entry.source_basis,
        data_completeness=daily_entry.data_completeness,
        created_at=daily_entry.created_at,
    )


@app.delete("/api/nutrition/daily-log/{log_id}")
def delete_daily_food_log(
    log_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    entry = session.get(DailyFoodLog, log_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Daily food log entry not found.")
    if entry.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot delete another user's food log.")

    session.delete(entry)
    session.commit()
    return {"message": "Food log entry deleted successfully.", "deleted_id": log_id}


# Calin Packs Core Module
@app.get("/api/packs", response_model=List[CalinPackTierOut])
def list_pack_tiers(session: Session = Depends(db)) -> List[CalinPackTier]:
    return list(session.scalars(select(CalinPackTier).where(CalinPackTier.active.is_(True))))


@app.get("/api/packs/{tier}", response_model=CalinPackTierOut)
def get_pack_tier(tier: str, session: Session = Depends(db)) -> CalinPackTier:
    pack = session.scalar(select(CalinPackTier).where(CalinPackTier.tier == tier, CalinPackTier.active.is_(True)))
    if not pack:
        raise HTTPException(status_code=404, detail="Calin pack tier not found")
    return pack


@app.post("/api/packs/customize")
def customize_pack(
    payload: CustomizePackPayload,
    session: Session = Depends(db),
) -> dict[str, Any]:
    tier_record = session.scalar(select(CalinPackTier).where(CalinPackTier.tier == payload.tier))
    if not tier_record:
        raise HTTPException(status_code=404, detail="Invalid Calin pack tier")

    # Fetch selected foods
    selected_foods = []
    total_calories = 0.0
    total_protein = 0.0
    total_fibre = 0.0
    calculated_price = 0

    for fid in payload.selected_food_ids:
        food = session.get(Food, fid)
        if food and food.active:
            selected_foods.append(food)
            total_calories += food.calories
            total_protein += food.protein_g
            total_fibre += food.fibre_g
            calculated_price += food.price_paise

    # Bundle discount formula: bundled pack price is structured ~20% more value than standalone
    bundle_price = max(tier_record.base_price_paise, (calculated_price * 85) // 100)

    return {
        "tier": tier_record.tier,
        "name": tier_record.name,
        "customized_price_paise": bundle_price,
        "base_price_paise": tier_record.base_price_paise,
        "item_count": len(selected_foods),
        "selected_foods": [
            {
                "id": f.id,
                "name": f.name,
                "category": f.category,
                "unit": f.unit,
                "calories": f.calories,
                "protein_g": f.protein_g,
                "price_paise": f.price_paise,
            }
            for f in selected_foods
        ],
        "nutrition_summary": {
            "total_calories": round(total_calories, 1),
            "total_protein_g": round(total_protein, 1),
            "total_fibre_g": round(total_fibre, 1),
        },
        "max_substitutions": tier_record.max_substitutions,
        "allowed_customization": True,
    }


# Cart & Demonstration Checkout
@app.get("/api/cart")
def get_cart(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    items = session.scalars(select(CartItem).where(CartItem.user_id == user.id)).all()
    cart_list = []
    subtotal = 0

    for it in items:
        if it.item_type == "pack":
            customization = json.loads(it.customization_json or "{}")
            price = it.unit_price_paise
            item_total = price * it.quantity
            subtotal += item_total
            cart_list.append({
                "id": it.id,
                "item_type": "pack",
                "pack_tier": it.pack_tier,
                "name": it.pack_name or "Calin Pack",
                "unit_price_paise": price,
                "quantity": it.quantity,
                "total_paise": item_total,
                "customization": customization,
            })
        else:
            food = session.get(Food, it.food_id)
            if not food:
                continue
            item_total = food.price_paise * it.quantity
            subtotal += item_total
            cart_list.append({
                "id": it.id,
                "item_type": "food",
                "food_id": food.id,
                "name": food.name,
                "category": food.category,
                "unit": food.unit,
                "unit_price_paise": food.price_paise,
                "quantity": it.quantity,
                "total_paise": item_total,
                "stock_available": food.stock_qty >= it.quantity,
            })

    delivery_fee = 0 if subtotal >= 80000 or subtotal == 0 else 4900
    total = subtotal + delivery_fee

    return {
        "items": cart_list,
        "subtotal_paise": subtotal,
        "delivery_fee_paise": delivery_fee,
        "total_paise": total,
    }


@app.post("/api/cart/items")
def add_to_cart(
    payload: AddCartPayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    if payload.quantity < 1:
        raise HTTPException(status_code=422, detail="Quantity must be at least 1")

    if payload.item_type == "pack":
        tier_record = session.scalar(select(CalinPackTier).where(CalinPackTier.tier == payload.pack_tier))
        if not tier_record:
            raise HTTPException(status_code=404, detail="Pack tier not found")

        # Determine price based on customization
        unit_price = tier_record.base_price_paise
        cust_json = json.dumps(payload.customization or {})

        item = CartItem(
            user_id=user.id,
            item_type="pack",
            pack_tier=payload.pack_tier,
            pack_name=tier_record.name,
            customization_json=cust_json,
            unit_price_paise=unit_price,
            quantity=payload.quantity,
        )
        session.add(item)
        session.commit()
        return {"status": "added", "item_type": "pack", "name": tier_record.name, "quantity": payload.quantity}

    else:
        if not payload.food_id:
            raise HTTPException(status_code=422, detail="food_id required for grocery items")
        food = session.get(Food, payload.food_id)
        if not food or not food.active:
            raise HTTPException(status_code=404, detail="Food item not found")
        if food.stock_qty < payload.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {food.name} (Only {food.stock_qty} left)")

        existing = session.scalar(
            select(CartItem).where(
                CartItem.user_id == user.id,
                CartItem.item_type == "food",
                CartItem.food_id == food.id,
            )
        )
        if existing:
            existing.quantity += payload.quantity
        else:
            session.add(
                CartItem(
                    user_id=user.id,
                    item_type="food",
                    food_id=food.id,
                    unit_price_paise=food.price_paise,
                    quantity=payload.quantity,
                )
            )
        session.commit()
        return {"status": "added", "item_type": "food", "name": food.name, "quantity": payload.quantity}


@app.delete("/api/cart/items/{item_id}")
def remove_cart_item(
    item_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, str]:
    item = session.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    session.delete(item)
    session.commit()
    return {"status": "removed"}


class MergeCartItemPayload(BaseModel):
    item_type: str = "food"  # food | pack
    food_id: Optional[str] = None
    pack_tier: Optional[str] = None
    pack_name: Optional[str] = None
    customization: Optional[Dict[str, Any]] = None
    quantity: int = Field(ge=1, default=1)


class MergeCartPayload(BaseModel):
    items: List[MergeCartItemPayload]


@app.post("/api/cart/merge")
def merge_cart(
    payload: MergeCartPayload,
    request: Request,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    verify_csrf(request)
    for it in payload.items:
        if it.item_type == "pack":
            if not it.pack_tier:
                continue
            tier_record = session.scalar(select(CalinPackTier).where(CalinPackTier.tier == it.pack_tier))
            if not tier_record:
                continue
            server_unit_price = tier_record.base_price_paise
            existing_pack = session.scalar(
                select(CartItem).where(
                    CartItem.user_id == user.id,
                    CartItem.item_type == "pack",
                    CartItem.pack_tier == it.pack_tier,
                )
            )
            if existing_pack:
                existing_pack.quantity += it.quantity
            else:
                session.add(
                    CartItem(
                        user_id=user.id,
                        item_type="pack",
                        pack_tier=it.pack_tier,
                        pack_name=tier_record.name,
                        customization_json=json.dumps(it.customization or {}),
                        unit_price_paise=server_unit_price,
                        quantity=it.quantity,
                    )
                )
        else:
            if not it.food_id:
                continue
            food = session.get(Food, it.food_id)
            if not food or not food.active or food.stock_qty <= 0:
                continue

            existing_item = session.scalar(
                select(CartItem).where(
                    CartItem.user_id == user.id,
                    CartItem.item_type == "food",
                    CartItem.food_id == food.id,
                )
            )
            current_qty = existing_item.quantity if existing_item else 0
            # Sum quantities and cap at available stock
            merged_qty = min(current_qty + it.quantity, food.stock_qty)
            if merged_qty > 0:
                if existing_item:
                    existing_item.quantity = merged_qty
                    existing_item.unit_price_paise = food.price_paise  # Authoritative server price
                else:
                    session.add(
                        CartItem(
                            user_id=user.id,
                            item_type="food",
                            food_id=food.id,
                            unit_price_paise=food.price_paise,  # Authoritative server price
                            quantity=merged_qty,
                        )
                    )

    session.commit()
    return get_cart(user=user, session=session)


@app.post("/api/orders/checkout")
def place_order(
    payload: CheckoutPayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    cart_items = session.scalars(select(CartItem).where(CartItem.user_id == user.id)).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    subtotal = 0
    order_items = []

    # Server-side validation of prices and inventory
    for it in cart_items:
        if it.item_type == "pack":
            subtotal += it.unit_price_paise * it.quantity
            order_items.append({
                "item_type": "pack",
                "pack_tier": it.pack_tier,
                "name": it.pack_name,
                "unit_price_paise": it.unit_price_paise,
                "quantity": it.quantity,
                "customization": json.loads(it.customization_json or "{}"),
            })
        else:
            food = session.get(Food, it.food_id)
            if not food or not food.active:
                raise HTTPException(status_code=400, detail="Item in cart is no longer available")
            if food.stock_qty < it.quantity:
                raise HTTPException(status_code=400, detail=f"Stock depleted for {food.name}")
            # Deduct inventory atomically
            food.stock_qty -= it.quantity
            item_total = food.price_paise * it.quantity
            subtotal += item_total
            order_items.append({
                "item_type": "food",
                "food_id": food.id,
                "name": food.name,
                "unit_price_paise": food.price_paise,
                "quantity": it.quantity,
            })

    delivery_fee = 0 if subtotal >= 80000 else 4900
    total = subtotal + delivery_fee

    new_order_id = str(uuid4())
    order = Order(
        id=new_order_id,
        user_id=user.id,
        status="placed",
        subtotal_paise=subtotal,
        delivery_fee_paise=delivery_fee,
        total_paise=total,
        items_json=json.dumps(order_items),
        delivery_address_json=json.dumps(payload.address.model_dump()),
        demo_payment=True,
    )
    session.add(order)
    session.flush()

    # Clear user's cart
    for it in cart_items:
        session.delete(it)

    # Save audit log
    session.add(
        AuditLog(
            id=str(uuid4()),
            user_id=user.id,
            action="order_placed",
            entity_type="order",
            entity_id=new_order_id,
            details=json.dumps({"total_paise": total, "items_count": len(order_items)}),
        )
    )

    session.commit()
    return {
        "order_id": order.id,
        "status": order.status,
        "subtotal_paise": subtotal,
        "delivery_fee_paise": delivery_fee,
        "total_paise": total,
        "items": order_items,
        "delivery_address": payload.address.model_dump(),
        "demo_payment": True,
        "message": "Demonstration order placed successfully! Check order status in your dashboard.",
    }


@app.get("/api/orders")
def get_orders(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> List[dict[str, Any]]:
    if user.role == Role.admin.value:
        orders_list = session.scalars(select(Order).order_by(Order.created_at.desc())).all()
    else:
        orders_list = session.scalars(
            select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc())
        ).all()

    return [
        {
            "id": o.id,
            "status": o.status,
            "subtotal_paise": o.subtotal_paise,
            "delivery_fee_paise": o.delivery_fee_paise,
            "total_paise": o.total_paise,
            "items": json.loads(o.items_json or "[]"),
            "delivery_address": json.loads(o.delivery_address_json or "{}"),
            "demo_payment": o.demo_payment,
            "created_at": o.created_at.isoformat(),
            "updated_at": o.updated_at.isoformat(),
        }
        for o in orders_list
    ]


@app.get("/api/orders/{order_id}")
def get_order_detail(
    order_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    order = session.get(Order, order_id)
    if not order or (order.user_id != user.id and user.role != Role.admin.value):
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "id": order.id,
        "user_id": order.user_id,
        "status": order.status,
        "subtotal_paise": order.subtotal_paise,
        "delivery_fee_paise": order.delivery_fee_paise,
        "total_paise": order.total_paise,
        "items": json.loads(order.items_json or "[]"),
        "delivery_address": json.loads(order.delivery_address_json or "{}"),
        "demo_payment": order.demo_payment,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
    }


@app.post("/api/orders/{order_id}/cancel")
def cancel_demo_order(
    order_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    order = session.get(Order, order_id)
    if not order or (order.user_id != user.id and user.role != Role.admin.value):
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "cancelled_demo":
        raise HTTPException(status_code=400, detail="Order is already cancelled")

    # Restore reserved stock for food items in order
    items = json.loads(order.items_json or "[]")
    for item in items:
        food_id = item.get("food_id")
        qty = item.get("quantity", 0)
        if food_id and qty > 0:
            food = session.get(Food, food_id)
            if food:
                food.stock_qty += qty

    old_status = order.status
    order.status = "cancelled_demo"
    order.updated_at = datetime.now(timezone.utc)

    session.add(
        AuditLog(
            user_id=user.id,
            action="order_cancelled_demo",
            entity_type="order",
            entity_id=order.id,
            details=json.dumps({"old_status": old_status, "new_status": "cancelled_demo", "restored_items_count": len(items)}),
        )
    )
    session.commit()
    return {
        "id": order.id,
        "status": order.status,
        "message": "Demo order cancelled successfully. Reserved inventory restored.",
    }


# Calin Pack Subscriptions
@app.get("/api/subscriptions")
def get_subscriptions(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> List[dict[str, Any]]:
    subs = session.scalars(select(Subscription).where(Subscription.user_id == user.id)).all()
    return [
        {
            "id": s.id,
            "pack_tier": s.pack_tier,
            "pack_name": s.pack_name,
            "frequency": s.frequency,
            "status": s.status,
            "price_per_delivery_paise": s.price_per_delivery_paise,
            "next_delivery_date": s.next_delivery_date.isoformat(),
            "created_at": s.created_at.isoformat(),
        }
        for s in subs
    ]


@app.post("/api/subscriptions")
def create_subscription(
    payload: SubscriptionPayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    tier_record = session.scalar(select(CalinPackTier).where(CalinPackTier.tier == payload.pack_tier))
    if not tier_record:
        raise HTTPException(status_code=404, detail="Invalid Calin pack tier")

    days_delta = 7 if payload.frequency == "weekly" else 14 if payload.frequency == "bi_weekly" else 30
    next_date = datetime.now(timezone.utc) + timedelta(days=days_delta)

    sub = Subscription(
        user_id=user.id,
        pack_tier=tier_record.tier,
        pack_name=tier_record.name,
        frequency=payload.frequency,
        status="active",
        price_per_delivery_paise=tier_record.base_price_paise,
        next_delivery_date=next_date,
    )
    session.add(sub)
    session.commit()
    return {
        "id": sub.id,
        "pack_name": sub.pack_name,
        "frequency": sub.frequency,
        "status": sub.status,
        "next_delivery_date": sub.next_delivery_date.isoformat(),
        "message": f"Demonstration subscription created for {sub.pack_name} ({payload.frequency}).",
    }


@app.put("/api/subscriptions/{sub_id}/status")
def update_subscription_status(
    sub_id: str,
    status_val: str = Query(pattern="^(active|paused|cancelled)$"),
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    sub = session.scalar(select(Subscription).where(Subscription.id == sub_id, Subscription.user_id == user.id))
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.status = status_val
    session.commit()
    return {"id": sub.id, "status": sub.status, "message": f"Subscription {status_val}"}


# Nutritionist Customization Workflow
@app.post("/api/nutritionist/requests")
def request_nutritionist_review(
    payload: NutritionistRequestPayload,
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    req = NutritionistReviewRequest(
        user_id=user.id,
        user_name=user.name,
        pack_tier=payload.pack_tier,
        customer_notes=payload.customer_notes,
        status="pending",
    )
    session.add(req)
    session.commit()
    return {
        "id": req.id,
        "status": req.status,
        "pack_tier": req.pack_tier,
        "message": "Your nutrition guidance request has been submitted to a qualified nutritionist on our team.",
    }


@app.get("/api/nutritionist/requests")
def get_user_nutritionist_requests(
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> List[dict[str, Any]]:
    # If admin role, view all; if nutritionist, view assigned to them or unassigned queue; if customer, view own
    if user.role == Role.admin.value:
        requests = session.scalars(select(NutritionistReviewRequest).order_by(NutritionistReviewRequest.created_at.desc())).all()
    elif user.role == Role.nutritionist.value:
        from sqlalchemy import or_
        requests = session.scalars(
            select(NutritionistReviewRequest)
            .where(or_(NutritionistReviewRequest.nutritionist_id == user.id, NutritionistReviewRequest.nutritionist_id.is_(None)))
            .order_by(NutritionistReviewRequest.created_at.desc())
        ).all()
    else:
        requests = session.scalars(
            select(NutritionistReviewRequest)
            .where(NutritionistReviewRequest.user_id == user.id)
            .order_by(NutritionistReviewRequest.created_at.desc())
        ).all()

    return [
        {
            "id": r.id,
            "user_name": r.user_name,
            "pack_tier": r.pack_tier,
            "customer_notes": r.customer_notes,
            "status": r.status,
            "guidance_notes": r.guidance_notes,
            "nutritionist_name": r.nutritionist_name,
            "created_at": r.created_at.isoformat(),
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        }
        for r in requests
    ]


@app.post("/api/nutritionist/requests/{req_id}/review")
def submit_nutritionist_review(
    req_id: str,
    payload: NutritionistReviewSubmit,
    user: User = Depends(require_role([Role.nutritionist.value, Role.admin.value])),
    session: Session = Depends(db),
) -> dict[str, Any]:
    req = session.get(NutritionistReviewRequest, req_id)
    if not req:
        raise HTTPException(status_code=404, detail="Review request not found")

    req.status = "reviewed"
    req.guidance_notes = payload.guidance_notes
    req.nutritionist_id = user.id
    req.nutritionist_name = user.name
    req.reviewed_at = datetime.now(timezone.utc)
    session.commit()
    return {
        "id": req.id,
        "status": req.status,
        "guidance_notes": req.guidance_notes,
        "reviewed_by": req.nutritionist_name,
        "message": "Nutritionist review recorded successfully.",
    }


# Grounded AI Nutrition Assistant (Rule & Database Retrieval)
@app.post("/api/ai/chat")
@app.post("/ai/chat")
@rate_limit_endpoint(limiter.shared_limit(lambda: settings.rate_limit_ai_chat, scope="ai_chat"))
def ai_nutrition_chat(
    request: Request,
    question: str = Query(min_length=2, max_length=500),
    user: User = Depends(current_user),
    session: Session = Depends(db),
) -> dict[str, Any]:
    q_lower = question.lower().strip()
    catalog_foods = session.scalars(select(Food).where(Food.active.is_(True))).all()
    recipes = session.scalars(select(Recipe).where(Recipe.active.is_(True))).all()

    # Match foods grounded in database
    matched_foods = []
    for f in catalog_foods:
        if f.name.lower() in q_lower or f.category.lower() in q_lower:
            matched_foods.append(f)

    # Match recipes grounded in database
    matched_recipes = []
    for r in recipes:
        if any(w in r.name.lower() for w in q_lower.split()):
            matched_recipes.append(r)

    # Retrieval response generation
    if "iron" in q_lower:
        iron_foods = [f.name for f in catalog_foods if "iron_rich" in json.loads(f.nutrition_tags or "[]")]
        answer = (
            f"Based on our store catalog, your top iron-dense options are {', '.join(iron_foods)}. "
            "Tip: Squeeze fresh lemon over these foods — Vitamin C enhances plant (non-heme) iron absorption by up to 300%!"
        )
        sources = iron_foods
    elif "protein" in q_lower:
        protein_foods = [f.name for f in catalog_foods if "protein_rich" in json.loads(f.nutrition_tags or "[]")]
        answer = (
            f"For clean protein, we recommend: {', '.join(protein_foods)}. "
            "Probiotic Greek Yoghurt offers 10g protein/100g, while Sprouted Chickpeas and Quinoa supply plant-based amino acids."
        )
        sources = protein_foods
    elif "calin pack" in q_lower or "pack" in q_lower:
        answer = (
            "Nutriverse offers three Calin Pack tiers: Basic (essential everyday whole food staples for ₹699), "
            "Minimal Plus (balanced diversity, berries & Greek yoghurt for ₹1,099), and Premium (deep micronutrient density and cold-pressed oils for ₹1,699). "
            "You can customize any pack and swap up to 5 items to match your allergies."
        )
        sources = ["Calin Basic Pack", "Calin Minimal Plus Pack", "Calin Premium Pack"]
    elif matched_foods:
        f = matched_foods[0]
        answer = (
            f"{f.name} provides {f.calories} kcal, {f.protein_g}g protein, and {f.fibre_g}g fiber per {f.serving_size}. "
            f"It is classified under {f.category}. Preparation recommendations: {', '.join(json.loads(f.prep_methods))}."
        )
        sources = [f.name]
    elif matched_recipes:
        r = matched_recipes[0]
        answer = (
            f"Recipe match: {r.name} ({r.prep_time_mins} mins, {r.calories} kcal, {r.protein_g}g protein). "
            f"Preparation method: {r.prep_method}. Ingredients available in catalog."
        )
        sources = [r.name]
    else:
        answer = (
            "Nutriverse organizes food by nutritional purpose rather than supermarket aisles. "
            "You can explore our catalog by Protein-rich, Complex Carbs, Fiber, and Iron categories, "
            "or generate a personalized Calin Pack built for your weekly calorie target."
        )
        sources = ["Nutriverse Catalog Database"]

    return {
        "question": question,
        "answer": answer,
        "grounded_sources": sources,
        "disclaimer": "Answers are grounded in the verified Nutriverse database. For educational nutrition guidance only; not medical diagnosis.",
        "ai_engine": "Nutriverse Grounded Nutrition Assistant v2 (Database-Backed)",
    }


# Admin Management & Operations
@app.get("/api/admin/stats")
def admin_stats(
    user: User = Depends(require_role([Role.admin.value])),
    session: Session = Depends(db),
) -> dict[str, Any]:
    food_count = session.query(Food).count()
    order_count = session.query(Order).count()
    user_count = session.query(User).count()
    sub_count = session.query(Subscription).count()
    pending_reviews = session.query(NutritionistReviewRequest).filter_by(status="pending").count()
    low_stock_foods = session.scalars(select(Food).where(Food.stock_qty <= 40)).all()

    recent_orders = session.scalars(select(Order).order_by(Order.created_at.desc()).limit(10)).all()

    return {
        "counts": {
            "products": food_count,
            "orders": order_count,
            "users": user_count,
            "subscriptions": sub_count,
            "pending_nutritionist_reviews": pending_reviews,
        },
        "low_stock_alerts": [{"name": f.name, "stock": f.stock_qty} for f in low_stock_foods],
        "recent_orders": [
            {
                "id": o.id,
                "status": o.status,
                "total_paise": o.total_paise,
                "created_at": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
    }


@app.put("/api/admin/orders/{order_id}/status")
def admin_update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    user: User = Depends(require_role([Role.admin.value])),
    session: Session = Depends(db),
) -> dict[str, Any]:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = payload.status
    order.updated_at = datetime.now(timezone.utc)

    session.add(
        AuditLog(
            user_id=user.id,
            action="order_status_updated",
            entity_type="order",
            entity_id=order.id,
            details=json.dumps({"old_status": old_status, "new_status": payload.status}),
        )
    )
    session.commit()
    return {"order_id": order.id, "old_status": old_status, "new_status": order.status}


@app.post("/api/admin/foods", response_model=FoodOut)
def admin_create_food(
    payload: FoodCreatePayload,
    user: User = Depends(require_role([Role.admin.value])),
    session: Session = Depends(db),
) -> Food:
    food = Food(
        name=payload.name,
        barcode=payload.barcode,
        category=payload.category,
        nutrition_tags=json.dumps(payload.nutrition_tags),
        description=payload.description,
        price_paise=payload.price_paise,
        gst_rate_percent=payload.gst_rate_percent,
        unit=payload.unit,
        serving_size=payload.serving_size,
        stock_qty=payload.stock_qty,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        fibre_g=payload.fibre_g,
        vitamins_json=json.dumps(payload.vitamins_json or {}),
        ingredients=payload.ingredients or "",
        storage_info=payload.storage_info or "Cool dry place",
        prep_methods=json.dumps(payload.prep_methods),
        dietary_tags=json.dumps(payload.dietary_tags),
        emoji=payload.emoji,
    )
    session.add(food)
    session.commit()
    session.refresh(food)
    return food


@app.get("/api/admin/audit-logs")
def admin_get_audit_logs(
    limit: int = 50,
    user: User = Depends(require_role([Role.admin.value])),
    session: Session = Depends(db),
) -> List[dict[str, Any]]:
    logs = session.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": json.loads(l.details or "{}"),
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
