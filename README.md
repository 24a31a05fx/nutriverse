# Nutriverse

Nutriverse is a nutrition discovery and personalization application. It pairs a
Next.js web client with a FastAPI service for user accounts, nutrition profiles,
a food catalog, and demo orders.

> **Project status:** This repository is an active prototype. Some screens and
> interactions use demonstration data and are not connected to a production
> service. See [Current capabilities and limitations](#current-capabilities-and-limitations).

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [Tests and API documentation](#tests-and-api-documentation)
- [Current capabilities and limitations](#current-capabilities-and-limitations)
- [Project documentation](#project-documentation)

## Features

- Browse and search a nutrition-focused food catalog.
- Create an account and save a nutrition profile with an estimated daily calorie target.
- Add catalog items to a cart and place a demo order.
- View the app’s nutrition dashboard, food packs, recipes, progress, scanner,
  assistant, order, and admin screens.
- Use a REST API with JWT-protected account, profile, cart, order, address, and
  admin operations.

## Technology stack

| Area | Technologies |
| --- | --- |
| Web client | Next.js 14, React 18, TypeScript |
| API | FastAPI, Pydantic, SQLAlchemy |
| Local database | SQLite |
| Container setup | Dockerfiles and Docker Compose |

## Repository layout

```text
app/                       Next.js page, layout, and global styles
backend/
  app/main.py              FastAPI application and database models
  migrations/              PostgreSQL baseline schema
  tests/                   API tests
  requirements.txt         Python dependencies
docs/
  DEPLOYMENT.md            Deployment notes
  product/                 Product, technical, and design documents
legacy/static-prototype/   Archived frontend prototype (not used by Next.js)
lib/                       Web-client API helper
public/assets/             Static assets served by the web client
```

## Prerequisites

- Node.js 20 or later and npm.
- Python 3.12 (pinned to 3.12.10) required for the API.

## Run locally

The web client and API run as separate processes. Start each in its own terminal
from the repository root.

### 1. Configure the API

Create a local environment file from the SQLite example:

```powershell
Copy-Item backend\.env.example .env
```

On macOS or Linux:

```sh
cp backend/.env.example .env
```

The API reads `.env` from its current working directory. The example uses a
local SQLite database, so a separate database server is not required.

### 2. Start the API

Create and activate a virtual environment, install the Python requirements, and
start FastAPI:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

On macOS or Linux, activate the environment with
`source .venv/bin/activate` instead of the PowerShell activation command.

The API creates its local database tables on startup and seeds the catalog when
it is empty. Its health endpoints are available at `http://localhost:8000/health`
and `http://localhost:8000/ready`.

### 3. Start the web client

In a second terminal:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). By default, the web client
connects to the API at `http://localhost:8000/api`.

## Configuration

The API settings are read from `.env` in the working directory:

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./nutriverse.db` |
| `JWT_SECRET` | Secret used to sign access tokens | `change-this-in-production` |
| `JWT_EXPIRE_MINUTES` | Access-token lifetime | `60` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:3000` |

The web client uses `NEXT_PUBLIC_API_URL` to choose the API base URL. If it is
not set, the client uses `http://localhost:8000/api`.

For any shared or production environment, replace the example JWT secret with a
long, randomly generated secret and keep credentials out of source control.
The root `.env.example` and `backend/.env.example` are templates, not production
secrets.

## Tests and API documentation

With the Python virtual environment active, run the API tests from the
repository root:

```sh
python -m pytest backend/tests
```

Build the web client with:

```sh
npm run build
```

When the API is running, interactive OpenAPI documentation is available at
[http://localhost:8000/docs](http://localhost:8000/docs).

The API currently includes these main routes:

| Area | Routes |
| --- | --- |
| Health | `GET /health`, `GET /ready` |
| Accounts | `POST /api/auth/register`, `POST /api/auth/login` |
| Nutrition profile | `GET /api/profile`, `POST /api/profile` |
| Food catalog | `GET /api/foods`, `GET /api/foods/barcode/{barcode}` |
| Cart and orders | `GET /api/cart`, `POST /api/cart/items`, `POST /api/orders/demo`, `GET /api/orders` |
| Addresses | `GET /api/addresses`, `POST /api/addresses` |
| Guidance and admin | `POST /api/ai/chat`, `GET /api/admin/dashboard` |

Routes that operate on a user account require a bearer access token. The admin
dashboard additionally requires an account with the `admin` role.

## Current capabilities and limitations

- The API supports account registration and login, profile storage, catalog
  search, cart and address operations, demo orders, and role-protected admin
  metrics.
- The web client includes demonstration screens for food packs, recipes,
  progress, scanning, guidance, orders, and admin metrics; not all of these
  screens are wired to persistent API data.
- The barcode route can look up the seeded sample barcode
  `8901234567890`. Camera scanning is not implemented.
- Guidance currently uses fixed catalog-based responses; it does not call an
  external AI provider.
- Razorpay order creation is not configured. Checkout uses demo orders and does
  not process payments.
- Nutrition information is general guidance, not medical advice or treatment.

## Project documentation

- [Deployment notes](docs/DEPLOYMENT.md)
- [Backend setup and API coverage](backend/README.md)
- Product and technical specifications are in `docs/product/`.
