from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, Generator, List, Optional, Union
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./nutriverse.db"
    jwt_secret: str = "change-this-in-production"
    jwt_expire_minutes: int = 60
    allowed_origins: str = "http://localhost:3000"


settings = Settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"


class Base(DeclarativeBase):
    pass


class Role(str, Enum):
    user = "user"
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
    calculation_version: Mapped[str] = mapped_column(String(20), default="mifflin-1")


class Food(Base):
    __tablename__ = "foods"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str] = mapped_column(Text)
    price_inr: Mapped[int] = mapped_column(Integer, default=199)
    calories: Mapped[float] = mapped_column(Float, default=0)
    protein_g: Mapped[float] = mapped_column(Float, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0)
    fat_g: Mapped[float] = mapped_column(Float, default=0)
    fibre_g: Mapped[float] = mapped_column(Float, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class CartItem(Base):
    __tablename__ = "cart_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    food_id: Mapped[str] = mapped_column(ForeignKey("foods.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), default="demo_placed")
    total_inr: Mapped[int] = mapped_column(Integer)
    demo_payment: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Address(Base):
    __tablename__ = "addresses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(40), default="Home")
    line1: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(80))
    postal_code: Mapped[str] = mapped_column(String(12))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)


Base.metadata.create_all(engine)


def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def token_for(user: User) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": user.id, "role": user.role, "exp": expires}, settings.jwt_secret, algorithm=ALGORITHM)


def current_user(authorization: Optional[str] = Header(default=None), session: Session = Depends(db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=[ALGORITHM])
        user = session.get(User, payload.get("sub"))
    except JWTError:
        user = None
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user


class AuthPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class ProfilePayload(BaseModel):
    age: int = Field(ge=13, le=100)
    sex: str
    height_cm: float = Field(ge=100, le=240)
    weight_kg: float = Field(ge=30, le=250)
    activity_level: float = Field(ge=1.2, le=1.9)


class AddressPayload(BaseModel):
    label: str = Field(default="Home", max_length=40)
    line1: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(min_length=4, max_length=12)
    is_default: bool = False


class FoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category: str
    description: str
    price_inr: int
    calories: float
    protein_g: float
    barcode: Optional[str] = None


app = FastAPI(title="Nutriverse API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in settings.allowed_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def seed_catalog() -> None:
    with SessionLocal() as session:
        if session.scalar(select(Food.id)) is not None:
            return
        entries = [
            Food(name="Chickpeas", category="Iron rich", description="Plant protein + iron", price_inr=299, calories=164, protein_g=8.9, fibre_g=7.6, barcode="8901234567890"),
            Food(name="Spinach", category="Folate rich", description="Folate + vitamin K", price_inr=199, calories=23, protein_g=2.9),
            Food(name="Sweet potato", category="Energy", description="Complex carbs + vitamin A", price_inr=249, calories=86, protein_g=1.6),
            Food(name="Greek yoghurt", category="Calcium", description="Calcium + protein", price_inr=399, calories=59, protein_g=10),
        ]
        session.add_all(entries)
        session.commit()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(session: Session = Depends(db)) -> dict[str, str]:
    session.execute(select(User.id).limit(1))
    return {"status": "ready", "database": "ok"}


@app.post("/api/auth/register")
def register(payload: AuthPayload, session: Session = Depends(db)) -> dict[str, str]:
    if session.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(name=payload.name, email=payload.email.lower(), password_hash=pwd_context.hash(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"access_token": token_for(user), "token_type": "bearer", "user_id": user.id}


@app.post("/api/auth/login")
def login(payload: LoginPayload, session: Session = Depends(db)) -> dict[str, str]:
    user = session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": token_for(user), "token_type": "bearer", "user_id": user.id}


@app.post("/api/profile")
def save_profile(payload: ProfilePayload, user: User = Depends(current_user), session: Session = Depends(db)) -> Dict[str, Union[int, str]]:
    base = 10 * payload.weight_kg + 6.25 * payload.height_cm - 5 * payload.age + (5 if payload.sex == "male" else -161)
    calories = round(base * payload.activity_level)
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if profile is None:
        profile = NutritionProfile(user_id=user.id, **payload.model_dump(), calorie_target=calories)
        session.add(profile)
    else:
        for key, value in payload.model_dump().items():
            setattr(profile, key, value)
        profile.calorie_target = calories
    session.commit()
    return {"calorie_target": calories, "calculation_version": "mifflin-1"}


@app.get("/api/profile", response_model=None)
def get_profile(user: User = Depends(current_user), session: Session = Depends(db)) -> NutritionProfile:
    profile = session.scalar(select(NutritionProfile).where(NutritionProfile.user_id == user.id))
    if not profile:
        raise HTTPException(status_code=404, detail="Nutrition profile not found")
    return profile


@app.get("/api/foods", response_model=list[FoodOut])
def foods(q: str = Query("", max_length=80), category: Optional[str] = None, session: Session = Depends(db)) -> List[Food]:
    query = select(Food).where(Food.active.is_(True))
    if q:
        query = query.where(Food.name.ilike(f"%{q}%") | Food.description.ilike(f"%{q}%"))
    if category:
        query = query.where(Food.category == category)
    return list(session.scalars(query.order_by(Food.name).limit(100)))


@app.get("/api/foods/barcode/{barcode}", response_model=FoodOut)
def barcode(barcode: str, session: Session = Depends(db)) -> Food:
    food = session.scalar(select(Food).where(Food.barcode == barcode, Food.active.is_(True)))
    if not food:
        raise HTTPException(status_code=404, detail="Unknown barcode")
    return food


@app.post("/api/cart/items")
def add_cart(food_id: str, quantity: int = 1, user: User = Depends(current_user), session: Session = Depends(db)) -> Dict[str, Union[str, int]]:
    if quantity < 1:
        raise HTTPException(status_code=422, detail="Quantity must be positive")
    if not session.get(Food, food_id):
        raise HTTPException(status_code=404, detail="Food not found")
    item = session.scalar(select(CartItem).where(CartItem.user_id == user.id, CartItem.food_id == food_id))
    if item:
        item.quantity += quantity
    else:
        session.add(CartItem(user_id=user.id, food_id=food_id, quantity=quantity))
    session.commit()
    return {"status": "added", "food_id": food_id, "quantity": quantity}


@app.get("/api/cart")
def cart(user: User = Depends(current_user), session: Session = Depends(db)) -> List[Dict[str, Union[int, str]]]:
    items = session.scalars(select(CartItem).where(CartItem.user_id == user.id)).all()
    return [{"food_id": item.food_id, "quantity": item.quantity} for item in items]


@app.post("/api/orders/demo")
def demo_order(user: User = Depends(current_user), session: Session = Depends(db)) -> Dict[str, Union[str, int, bool]]:
    items = session.scalars(select(CartItem).where(CartItem.user_id == user.id)).all()
    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    total = sum((session.get(Food, item.food_id).price_inr * item.quantity) for item in items)
    order = Order(user_id=user.id, total_inr=total, demo_payment=True)
    session.add(order)
    for item in items:
        session.delete(item)
    session.commit()
    return {"id": order.id, "total_inr": total, "status": order.status, "demo_payment": True}


@app.get("/api/orders", response_model=None)
def orders(user: User = Depends(current_user), session: Session = Depends(db)) -> list[Order]:
    return list(session.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.created_at.desc())))


@app.get("/api/addresses", response_model=None)
def addresses(user: User = Depends(current_user), session: Session = Depends(db)) -> list[Address]:
    return list(session.scalars(select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc())))


@app.post("/api/addresses", response_model=None)
def create_address(payload: AddressPayload, user: User = Depends(current_user), session: Session = Depends(db)) -> Address:
    if payload.is_default:
        for existing in session.scalars(select(Address).where(Address.user_id == user.id)):
            existing.is_default = False
    address = Address(user_id=user.id, **payload.model_dump())
    session.add(address)
    session.commit()
    session.refresh(address)
    return address


@app.post("/api/payments/razorpay/order")
def razorpay_order(user: User = Depends(current_user)) -> Dict[str, str]:
    raise HTTPException(status_code=503, detail="Razorpay is not configured. Demo checkout remains available.")


@app.post("/api/ai/chat")
def ai_chat(question: str = Query(min_length=1, max_length=500), user: User = Depends(current_user)) -> dict[str, str]:
    lower = question.lower()
    if "iron" in lower:
        answer = "Chickpeas and spinach are catalog matches for an iron-focused meal. Add colourful vegetables for a balanced bowl."
    elif "fibre" in lower:
        answer = "Chickpeas, blueberries and sweet potato are useful fibre-rich choices in the Nutriverse catalog."
    else:
        answer = "Try a chickpea bowl with spinach, tahini and roasted sweet potato. I can only answer from available catalog data."
    return {"answer": answer, "disclaimer": "General guidance only; not diagnosis or medical treatment."}


@app.get("/api/admin/dashboard")
def admin_dashboard(user: User = Depends(current_user), session: Session = Depends(db)) -> dict[str, int]:
    if user.role != Role.admin.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"foods": session.query(Food).count(), "orders": session.query(Order).count(), "users": session.query(User).count()}
