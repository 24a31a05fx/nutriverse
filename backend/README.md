# Nutriverse API

FastAPI service for authentication, nutrition profiles, catalog search, carts,
demo orders, barcode lookup, AI guidance, and admin metrics.

## Runtime & Python Version
Pinned to Python 3.12 (3.12.10). Ensure Python 3.12 is used when creating the virtual environment.

## Run locally

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

The default local database is SQLite. Set `DATABASE_URL` to a PostgreSQL
SQLAlchemy URL for production.

## API coverage

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/profile`
- `GET /api/profile`
- `GET /api/foods`
- `GET /api/foods/barcode/{barcode}`
- `POST /api/cart/items`
- `GET /api/cart`
- `POST /api/orders/demo`
- `GET /api/orders`
- `POST /api/ai/chat`
- `GET /api/admin/dashboard`

All protected routes require a bearer JWT. Admin metrics require a user with
the `admin` role. Payment credentials and AI provider credentials are never
read by the frontend.
