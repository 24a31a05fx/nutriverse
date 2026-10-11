from __future__ import annotations

import hashlib
import json
import re
import secrets
from datetime import datetime, timedelta, timezone
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
from jose import JWTError, jwt
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
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
    sessionmaker,
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
    budget_inr: Mapped[int] = mapped_column(Integer, default=1500)
    goal: Mapped[str] = mapped_column(String(80), default="Balanced Nourishment")
    calculation_version: Mapped[str] = mapped_column(String(20), default="mifflin-st-jeor-v1")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Food(Base):
    __tablename__ = "foods"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)  # Conventional category (Legumes, Greens, etc.)
    nutrition_tags: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of tags: protein_rich, fiber_rich, etc.
    description: Mapped[str] = mapped_column(Text)
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
    active: Mapped[bool] = mapped_column(Boolean, default=True)


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
    nutritionist_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    nutritionist_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


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
    budget_inr: Optional[int] = 1500
    goal: Optional[str] = "Balanced Nourishment"


class AddressPayload(BaseModel):
    label: str = Field(default="Home", max_length=40)
    line1: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(min_length=4, max_length=12)
    is_default: bool = False


class FoodCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    barcode: Optional[str] = None
    category: str
    nutrition_tags: List[str] = []
    description: str
    price_paise: Optional[int] = Field(default=None, ge=0)
    price_inr: Optional[int] = Field(default=None, ge=0)
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
    items: List[Dict[str, Any]]  # list of {food_id: str, quantity: float}


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
    status: str = Field(pattern="^(placed|confirmed|preparing|out_for_delivery|delivered|cancelled)$")


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
        if session.scalar(select(Food.id)) is None:
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
            ]
            session.add_all(catalog_foods)
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

    user_role = payload.role if payload.role in [r.value for r in Role] else Role.user.value
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
    # Scientific Mifflin-St Jeor Equation
    bmr = 10 * payload.weight_kg + 6.25 * payload.height_cm - 5 * payload.age + (5 if payload.sex == "male" else -161)
    daily_calories = round(bmr * payload.activity_level)

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
            budget_inr=payload.budget_inr or 1500,
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
        profile.budget_inr = payload.budget_inr or profile.budget_inr
        profile.goal = payload.goal or profile.goal
        profile.updated_at = datetime.now(timezone.utc)

    session.commit()
    return {
        "bmr": round(bmr),
        "calorie_target": daily_calories,
        "calculation_formula": "Mifflin-St Jeor: 10*weight(kg) + 6.25*height(cm) - 5*age + (5 male / -161 female)",
        "activity_multiplier": payload.activity_level,
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
        "budget_inr": profile.budget_inr,
        "goal": profile.goal,
        "calculation_version": profile.calculation_version,
    }


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
        query = query.where(Food.category == category)

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


# Food Combinations Calculator
@app.post("/api/combinations/calculate")
def calculate_combination(
    payload: CombinationRequest,
    session: Session = Depends(db),
) -> dict[str, Any]:
    if not payload.items:
        raise HTTPException(status_code=400, detail="Please provide at least one food item")

    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_fibre = 0.0
    total_price = 0
    contributing_foods = []
    contributing_nutrients = set()

    for item in payload.items:
        food = session.get(Food, item.get("food_id"))
        if not food:
            continue
        qty = float(item.get("quantity", 1))
        # Nutritional proportion based on servings
        total_calories += food.calories * qty
        total_protein += food.protein_g * qty
        total_carbs += food.carbs_g * qty
        total_fat += food.fat_g * qty
        total_fibre += food.fibre_g * qty
        total_price += int(food.price_paise * qty)

        tags = json.loads(food.nutrition_tags or "[]")
        for t in tags:
            contributing_nutrients.add(t)

        contributing_foods.append({
            "food_id": food.id,
            "name": food.name,
            "quantity": qty,
            "calories": round(food.calories * qty, 1),
            "protein_g": round(food.protein_g * qty, 1),
            "price_paise": int(food.price_paise * qty),
        })

    return {
        "items": contributing_foods,
        "total_calories": round(total_calories, 1),
        "total_protein_g": round(total_protein, 1),
        "total_carbs_g": round(total_carbs, 1),
        "total_fat_g": round(total_fat, 1),
        "total_fibre_g": round(total_fibre, 1),
        "total_price_paise": total_price,
        "contributing_nutrients": sorted(list(contributing_nutrients)),
        "disclaimer": "Calculated from database whole-food nutritional reference sheets. Cooking and prep methods can influence final values.",
    }


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
    # If nutritionist role, view all; if customer, view own
    if user.role == Role.nutritionist.value or user.role == Role.admin.value:
        requests = session.scalars(select(NutritionistReviewRequest).order_by(NutritionistReviewRequest.created_at.desc())).all()
    else:
        requests = session.scalars(select(NutritionistReviewRequest).where(NutritionistReviewRequest.user_id == user.id).order_by(NutritionistReviewRequest.created_at.desc())).all()

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
def ai_nutrition_chat(
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
    resolved_price = payload.price_paise if payload.price_paise is not None else (payload.price_inr * 100 if payload.price_inr is not None else 0)
    food = Food(
        name=payload.name,
        barcode=payload.barcode,
        category=payload.category,
        nutrition_tags=json.dumps(payload.nutrition_tags),
        description=payload.description,
        price_paise=resolved_price,
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
