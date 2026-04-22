# saralprivacy-user

A production-ready, containerized PII management application. Users can securely store and manage personally identifiable information (PII) records. Supports local auth, Google OAuth, and SSO handoff from the saralprivacy-orchestrator.

## Quick Start

```bash
cp .env.example .env
# Edit .env: set ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, ORCHESTRATOR_TOKEN_SECRET,
#            GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
docker compose up --build
# Open http://localhost:3000
```

## Stack

- **Frontend**: React 18 + TypeScript 5 (strict) + Vite + Tailwind CSS, served by Nginx
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 async + Alembic
- **Database**: PostgreSQL 16

## Auth

- Local email/password (bcrypt 12 rounds)
- Google OAuth via Authlib
- SSO handoff: orchestrator issues a short-lived JWT, exchanged at `POST /api/auth/sso-token`

## Security

- Access token: 15-min JWT in React state (memory only, never localStorage)
- Refresh token: 7-day JWT in httpOnly SameSite=Strict cookie, SHA-256 hashed in DB
- `national_id` always SHA-256 hashed before DB write, never returned in responses
- All DB access via SQLAlchemy ORM — no raw SQL
- Rate limiting on login, register, sso-token (slowapi)
- Non-root containers

## Publishing the Combined Image

```bash
docker build -t yourname/saralprivacy-user:latest .
docker push yourname/saralprivacy-user:latest
```

The CI/CD pipeline (`.github/workflows/docker-publish.yml`) does this automatically on push to `main`.

## Environment Variables

See `.env.example` for all required variables.
