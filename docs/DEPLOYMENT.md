# Nutriverse deployment

## Vercel multi-service project

The root [`vercel.json`](../vercel.json) configures two services in one Vercel
project:

- `app` is the public Next.js frontend.
- `backend` is the FastAPI service. Top-level rewrites publish `/api/*`,
  `/health`, and `/ready` through the same project domain; other paths go to
  the frontend.
- The `app` service binds `BACKEND_INTERNAL_URL` to the internal URL of
  `backend`. Server-rendered food, recipe, and barcode detail pages use this
  binding at runtime. Browser API calls use same-origin `/api`.

Configure production environment variables for the relevant services in Vercel.
At minimum, the backend needs a strong `JWT_SECRET`, a managed PostgreSQL
`DATABASE_URL`, and `ALLOWED_ORIGINS` containing the public project origin.
SQLite is suitable for local development only; serverless local files are not
persistent production storage. Add any required AI or payment credentials only
to the backend service. Do not manually define `BACKEND_INTERNAL_URL`; Vercel
injects it from the service binding.

## Local production-shaped environment

1. Copy `.env.example` to `.env` and replace `JWT_SECRET`.
2. Start PostgreSQL with `docker compose up db -d`.
3. Start the API from `backend/` using the documented migration and seed commands.
4. Run `npm install`, `npm run build`, and `npm run start`.

The web application uses `NEXT_PUBLIC_API_URL` to connect to FastAPI. The API uses `ALLOWED_ORIGINS` for CORS.

## Payments

Razorpay credentials are server-only environment variables. The API creates orders and verifies signatures; never expose `RAZORPAY_KEY_SECRET` to the browser. Until credentials are configured, checkout remains a clearly labeled demo order.

## Operations

- Terminate TLS at the hosting platform or reverse proxy.
- Use managed PostgreSQL with automated backups.
- Configure structured API logs and error tracking.
- Add health checks for `/health` and the database.
- Rotate JWT/payment/AI secrets through the deployment secret manager.
- Restrict admin endpoints by role and review audit logs.
