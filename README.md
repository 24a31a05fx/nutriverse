# Nutriverse

Nutriverse is a nutrition discovery and personalization web application.
The web client is built with Next.js and the API is built with FastAPI.

## Repository structure

```text
app/                    Next.js routes, layout, and global styles
backend/                FastAPI service, migrations, and API tests
docs/                   Deployment and product/technical documentation
legacy/static-prototype/ Archived static frontend prototype
lib/                    Shared web-client helpers
public/assets/          Images and other browser-served assets
```

The Next.js application is the canonical frontend. The files in
`legacy/static-prototype/` are retained for reference only and are not part of
the Next.js build.

## Run the web app

```powershell
npm install
npm run dev
```

## Run the API

See [backend/README.md](backend/README.md) for local API setup and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the production-shaped environment.
