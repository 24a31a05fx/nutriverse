# Nutriverse deployment

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
