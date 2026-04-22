Please confirm you have read CLAUDE.md before starting. 
Then build the complete project file by file in the exact 
build order specified. After each file, briefly state 
what you just created and what comes next.

Build the complete saralprivacy-user microservice. Start: docker compose up --build
Frontend: React 18 + TypeScript 5 strict. Backend: Python FastAPI.
No JSX files — all .tsx/.ts. No `any` types anywhere.

═══════════════════════════════════════════
DIRECTORY STRUCTURE
═══════════════════════════════════════════

saralprivacy-user/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── .github/
│   └── workflows/
│       └── docker-publish.yml
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── entrypoint.sh
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   └── person.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   └── person.py
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py
│       │   └── persons.py
│       ├── services/
│       │   ├── __init__.py
│       │   ├── auth_service.py
│       │   └── person_service.py
│       └── middleware/
│           └── auth.py
│   └── alembic/
│       ├── env.py
│       └── versions/
│           ├── 001_create_users.py
│           └── 002_create_persons.py
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── vite-env.d.ts
        ├── env.ts
        ├── types/
        │   ├── auth.ts
        │   ├── person.ts
        │   └── api.ts
        ├── api/
        │   ├── axiosInstance.ts
        │   ├── auth.ts
        │   └── persons.ts
        ├── context/
        │   └── AuthContext.tsx
        ├── components/
        │   ├── ProtectedRoute.tsx
        │   ├── Navbar.tsx
        │   ├── PersonList.tsx
        │   ├── PersonForm.tsx
        │   └── Toast.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            └── DashboardPage.tsx

═══════════════════════════════════════════
DATABASE MODELS
═══════════════════════════════════════════

backend/app/models/user.py — class User(Base):
  __tablename__ = "users"
  id            : UUID, PK, default uuid4
  full_name     : str(255), not null
  email         : str(255), unique, not null, indexed
  password_hash : str | None  (null for OAuth/SSO users)
  provider      : str, default "local"  — "local"|"google"|"orchestrator"
  provider_id   : str | None  (Google sub ID)
  avatar_url    : str | None
  refresh_token_hash : str | None
  is_active     : bool, default True
  created_at    : datetime, server_default now()
  updated_at    : datetime, onupdate now()

backend/app/models/person.py — class Person(Base):
  __tablename__ = "persons"
  id            : UUID, PK, default uuid4
  user_id       : UUID, FK→users.id CASCADE delete, indexed
  full_name     : str(255), not null
  email         : str(255), not null
  phone_number  : str | None (20)
  address_line1 : str | None (255)
  address_line2 : str | None (255)
  city          : str | None (100)
  state         : str | None (100)
  postal_code   : str | None (20)
  country       : str | None (100)
  national_id   : str | None (64) — SHA-256 hex, never plaintext
  created_at    : datetime
  updated_at    : datetime
  is_deleted    : bool, default False, indexed

═══════════════════════════════════════════
BACKEND CONFIG
═══════════════════════════════════════════

backend/app/config.py — pydantic-settings BaseSettings:
  DATABASE_URL                : str
  ACCESS_TOKEN_SECRET         : str
  REFRESH_TOKEN_SECRET        : str
  ORCHESTRATOR_TOKEN_SECRET   : str   ← shared secret with orchestrator
  ACCESS_TOKEN_EXPIRE_MINUTES : int = 15
  REFRESH_TOKEN_EXPIRE_DAYS   : int = 7
  GOOGLE_CLIENT_ID            : str
  GOOGLE_CLIENT_SECRET        : str
  GOOGLE_REDIRECT_URI         : str
  BCRYPT_ROUNDS               : int = 12
  CORS_ORIGINS                : list[str] = ["http://localhost:3000"]

═══════════════════════════════════════════
BACKEND AUTH ROUTES — /api/auth
═══════════════════════════════════════════

POST /api/auth/register
  Body   : { full_name, email, password }
  Rules  : email format, password min 8 chars + 1 uppercase + 1 number
  Action : bcrypt hash password, insert user, issue tokens
  Cookie : httpOnly refresh token (7 days)
  Return : { access_token, user: {id, full_name, email, avatar_url, provider} }

POST /api/auth/login
  Body   : { email, password }
  Rules  : verify bcrypt. Rate limit: 10/15 min per IP (slowapi)
  Cookie : httpOnly refresh token
  Return : { access_token, user }

POST /api/auth/logout
  Action : clear cookie, set refresh_token_hash=None in DB
  Return : 204

POST /api/auth/refresh
  Action : read refresh cookie, verify JWT, compare SHA-256 hash vs DB,
           issue new access token
  Return : { access_token }

GET /api/auth/google
  Action : Authlib redirect to Google consent (scopes: openid email profile)

GET /api/auth/google/callback
  Action : Authlib callback, upsert user by (provider=google, provider_id=sub),
           issue tokens, set cookie
  Return : redirect to /dashboard?token={access_token}

GET /api/auth/me  [protected]
  Return : { id, full_name, email, avatar_url, provider }

POST /api/auth/sso-token                        ← SSO HANDOFF FROM ORCHESTRATOR
  Body   : { orch_token: string }
  Steps  :
    1. Verify orch_token JWT using ORCHESTRATOR_TOKEN_SECRET
       Reject if invalid OR if payload.source != "orchestrator"
       Reject if expired → return 401 { detail: "Access link expired" }
    2. Extract email from payload
    3. Upsert user: find by email; if not found create with
       provider="orchestrator", full_name=email prefix, no password_hash
    4. Issue saralprivacy-user access token + refresh token, set httpOnly cookie
    5. Return: { access_token, user }
  Rate limit : 10/min per IP
  Never log orch_token value

GET /health
  Return : { status: "ok" }  — used by Docker healthcheck and worker polling

═══════════════════════════════════════════
BACKEND PERSONS ROUTES — /api/persons
═══════════════════════════════════════════

All routes require JWT bearer auth. All queries filter user_id = current_user.id

GET    /api/persons          ?search= (ILIKE full_name or email)
GET    /api/persons/{id}     404 if not found / deleted / wrong user
POST   /api/persons          SHA-256 hash national_id, return 201
PUT    /api/persons/{id}     SHA-256 hash national_id if provided
DELETE /api/persons/{id}     soft delete is_deleted=True, return 204

Pydantic schemas:
  PersonCreate : full_name(req), email(req), all others optional
  PersonUpdate : all fields Optional
  PersonResponse : all fields EXCEPT national_id (never return the hash)

═══════════════════════════════════════════
BACKEND DOCKERFILES & ENTRYPOINT
═══════════════════════════════════════════

backend/Dockerfile:
  FROM python:3.12-slim
  RUN adduser --disabled-password --gecos "" appuser
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  RUN chown -R appuser:appuser /app
  USER appuser
  EXPOSE 8000
  ENTRYPOINT ["./entrypoint.sh"]

backend/entrypoint.sh:
  #!/bin/sh
  set -e
  alembic upgrade head
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000

backend/requirements.txt (pinned):
  fastapi==0.111.0
  uvicorn[standard]==0.29.0
  sqlalchemy==2.0.30
  asyncpg==0.29.0
  alembic==1.13.1
  passlib[bcrypt]==1.7.4
  python-jose[cryptography]==3.3.0
  authlib==1.3.0
  httpx==0.27.0
  pydantic-settings==2.2.1
  slowapi==0.1.9
  python-dotenv==1.0.1
  python-multipart==0.0.9

═══════════════════════════════════════════
TYPESCRIPT CONFIG
═══════════════════════════════════════════

frontend/tsconfig.json:
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}

frontend/tsconfig.node.json:
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts","tailwind.config.ts","postcss.config.ts"]
}

═══════════════════════════════════════════
FRONTEND PACKAGE.JSON
═══════════════════════════════════════════

dependencies:
  react, react-dom: ^18.3.1
  react-router-dom: ^6.23.1
  axios: ^1.7.2

devDependencies:
  typescript: ^5.4.5
  @types/react: ^18.3.3
  @types/react-dom: ^18.3.0
  @types/node: ^20.14.2
  @vitejs/plugin-react: ^4.3.0
  vite: ^5.3.1
  tailwindcss: ^3.4.4
  postcss: ^8.4.38
  autoprefixer: ^10.4.19

scripts:
  "dev": "vite"
  "build": "tsc && vite build"
  "typecheck": "tsc --noEmit"

═══════════════════════════════════════════
FRONTEND TYPE DEFINITIONS
═══════════════════════════════════════════

frontend/src/vite-env.d.ts:
  /// <reference types="vite/client" />
  interface ImportMetaEnv { readonly VITE_API_BASE_URL: string }
  interface ImportMeta { readonly env: ImportMetaEnv }

frontend/src/env.ts:
  const env = {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  } as const;
  export default env;

frontend/src/types/auth.ts:
  export interface User {
    id: string; full_name: string; email: string;
    avatar_url: string | null;
    provider: 'local' | 'google' | 'orchestrator';
  }
  export interface AuthContextType {
    user: User | null; accessToken: string | null;
    isAuthenticated: boolean; isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => Promise<void>;
  }
  export interface LoginRequest { email: string; password: string }
  export interface RegisterRequest {
    full_name: string; email: string; password: string
  }
  export interface AuthResponse { access_token: string; user: User }
  export interface SSOTokenRequest { orch_token: string }

frontend/src/types/person.ts:
  export interface Person {
    id: string; user_id: string; full_name: string; email: string;
    phone_number: string | null; address_line1: string | null;
    address_line2: string | null; city: string | null;
    state: string | null; postal_code: string | null;
    country: string | null; created_at: string; updated_at: string;
  }
  export interface PersonCreate {
    full_name: string; email: string; phone_number?: string;
    address_line1?: string; address_line2?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
    national_id?: string;
  }
  export type PersonUpdate = Partial<PersonCreate>;

frontend/src/types/api.ts:
  export interface ValidationError {
    loc: (string | number)[]; msg: string; type: string;
  }
  export interface ApiError { detail: string | ValidationError[] }
  export function isValidationErrors(
    d: string | ValidationError[]
  ): d is ValidationError[] { return Array.isArray(d) }

═══════════════════════════════════════════
FRONTEND API LAYER
═══════════════════════════════════════════

frontend/src/api/axiosInstance.ts:
  - baseURL: /api
  - Request interceptor: inject Authorization: Bearer {accessToken}
    (read token from AuthContext via a module-level setter function)
  - Response interceptor: on 401 → POST /api/auth/refresh → retry once
    on refresh failure → logout() + navigate /login

frontend/src/api/auth.ts (all typed):
  login(data: LoginRequest): Promise<AuthResponse>
  register(data: RegisterRequest): Promise<AuthResponse>
  logout(): Promise<void>
  refreshToken(): Promise<{ access_token: string }>
  getMe(): Promise<User>
  exchangeSSOToken(orchToken: string): Promise<AuthResponse>
    → POST /api/auth/sso-token  { orch_token: orchToken }

frontend/src/api/persons.ts (all typed):
  getPersons(search?: string): Promise<Person[]>
  getPerson(id: string): Promise<Person>
  createPerson(data: PersonCreate): Promise<Person>
  updatePerson(id: string, data: PersonUpdate): Promise<Person>
  deletePerson(id: string): Promise<void>

═══════════════════════════════════════════
FRONTEND AUTH CONTEXT
═══════════════════════════════════════════

frontend/src/context/AuthContext.tsx:
  - user: User | null — useState
  - accessToken: string | null — useState (memory only, never localStorage)
  - isLoading: boolean — true during initial session restore
  - On mount: POST /api/auth/refresh to restore session from httpOnly cookie
  - login(token, user): set both state values
  - logout(): POST /api/auth/logout, clear state
  - useAuth() hook: throws if used outside provider

═══════════════════════════════════════════
FRONTEND APP.TSX — SSO HANDLING
═══════════════════════════════════════════

frontend/src/App.tsx:
  Inner component AppRoutes has access to AuthContext.
  On mount:
    1. Read ?orch_token= from URL params
    2. If present:
       - Set isHandlingSSO = true
       - Show full-screen spinner: "Setting up your workspace..."
       - Call exchangeSSOToken(orchToken)
       - On success: login(access_token, user),
                     window.history.replaceState({}, '', pathname),
                     navigate('/dashboard', { replace: true })
       - On failure (401): replaceState to clear URL,
                           navigate('/login',
                             { state: { ssoError: "Your access link
                               has expired. Please request a new one." }})
       - Finally: isHandlingSSO = false
    3. This runs BEFORE session restore and BEFORE any route renders
    4. While isHandlingSSO || isLoading: render only the spinner

  Routes:
    /login       → <LoginPage />
    /register    → <RegisterPage />
    /dashboard   → <ProtectedRoute><DashboardPage /></ProtectedRoute>
    /            → <Navigate to="/dashboard" replace />

═══════════════════════════════════════════
FRONTEND PAGES & COMPONENTS
═══════════════════════════════════════════

LoginPage.tsx:
  Props: (none — reads navigation state for ssoError)
  - Read location.state?.ssoError — if present show red dismissible banner
  - Email + password form with validation
  - "Sign in with Google" → redirect GET /api/auth/google
  - Handle ?token= in URL for Google OAuth callback
  - Link to /register

RegisterPage.tsx:
  - full_name + email + password + confirm password
  - Password strength indicator (weak/medium/strong)
  - "Sign up with Google" button
  - On success: auto-login, navigate /dashboard
  - Link to /login

DashboardPage.tsx:
  - Welcome message with user.full_name
  - Renders <PersonList />

PersonList.tsx:
  - Table: Full Name, Email, Phone, City, Country, Created At
  - Search bar (debounced 300ms) → getPersons(search)
  - "Add New" button → opens PersonForm in create mode
  - Edit button per row → opens PersonForm in edit mode
  - Delete button per row → confirm dialog → deletePerson
  - Empty state when no records
  - Loading spinner while fetching

PersonForm.tsx:
  Props: { person: Person | null, onSuccess: ()=>void, onClose: ()=>void }
  - Modal overlay
  - Fields: Full Name*, Email*, Phone, Address Line 1, Address Line 2,
            City, State, Postal Code, Country, National ID
  - National ID: info tooltip "Stored as one-way hash — cannot be retrieved"
  - Client-side validation before submit
  - Create mode: POST, Edit mode: PUT
  - On success: onSuccess() + toast "Saved successfully"
  - On error: inline error message

Navbar.tsx:
  - App name/logo left
  - User avatar (Google photo) or initials circle right
  - User full_name + email
  - Logout button

Toast.tsx:
  Props: { message: string, type: 'success'|'error'|'info', onDismiss: ()=>void }
  - Auto-dismiss after 3s
  - Green/red/blue styling via Tailwind

ProtectedRoute.tsx:
  Props: { children: ReactNode }
  - If isLoading: spinner
  - If not isAuthenticated: <Navigate to="/login" replace />
  - Else: render children

═══════════════════════════════════════════
FRONTEND DOCKER + NGINX
═══════════════════════════════════════════

frontend/Dockerfile:
  Stage 1 — node:20-alpine:
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm ci
    COPY . .
    RUN npm run build   ← runs tsc && vite build (TS errors = build fails)
  Stage 2 — nginx:1.25-alpine:
    COPY --from=0 /app/dist /usr/share/nginx/html
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    RUN chown -R nginx:nginx /usr/share/nginx/html
    USER nginx
    EXPOSE 80

frontend/nginx.conf:
  - SPA fallback: all unmatched → index.html
  - Proxy /api/ → http://backend:8000/api/
  - Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff,
    Referrer-Policy strict-origin-when-cross-origin
  - Gzip enabled

═══════════════════════════════════════════
DEV DOCKER COMPOSE
═══════════════════════════════════════════

Services: db (postgres:16-alpine), backend, frontend
  db: internal only, named volume pii_pgdata, healthcheck pg_isready
  backend: depends_on db (healthy), port 8000:8000
  frontend: depends_on backend, port 3000:80
  All secrets from .env file

═══════════════════════════════════════════
CI/CD — GITHUB ACTIONS
═══════════════════════════════════════════

.github/workflows/docker-publish.yml:
  Trigger: push to main
  Steps:
    1. Checkout
    2. Login to Docker Hub (secrets: DOCKER_USERNAME, DOCKER_TOKEN)
    3. Build combined image using root Dockerfile (supervisord runs
       nginx + uvicorn together in one container)
    4. Tag: {DOCKER_USERNAME}/saralprivacy-user:latest and :${GITHUB_SHA}
    5. Push both tags

Root Dockerfile (combined single image for orchestrator to pull):
  FROM python:3.12-slim as base
  Install Node.js 20, nginx, supervisor
  Stage: build frontend (npm ci → tsc && vite build)
  Copy dist to /usr/share/nginx/html
  Copy nginx.conf
  Install Python deps
  Copy backend app
  Write /etc/supervisor/conf.d/app.conf:
    [program:nginx]  command=/usr/sbin/nginx -g "daemon off;"
    [program:uvicorn] command=uvicorn app.main:app --host 0.0.0.0 --port 8000
  Run entrypoint: alembic upgrade head then supervisord
  EXPOSE 80 8000

═══════════════════════════════════════════
ENV VARIABLES (.env.example)
═══════════════════════════════════════════

# Database
DATABASE_URL=postgresql+asyncpg://piiuser:changeme@db:5432/piidb
POSTGRES_USER=piiuser
POSTGRES_PASSWORD=changeme
POSTGRES_DB=piidb

# JWT
ACCESS_TOKEN_SECRET=replace_with_64_char_random_string
REFRESH_TOKEN_SECRET=replace_with_different_64_char_random_string

# Google OAuth (saralprivacy-user)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# SSO — must match ORCHESTRATOR_TOKEN_SECRET in orchestrator repo
ORCHESTRATOR_TOKEN_SECRET=replace_with_shared_secret

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# Frontend build
VITE_API_BASE_URL=http://localhost:8000

═══════════════════════════════════════════
SECURITY CHECKLIST
═══════════════════════════════════════════

- [ ] TypeScript strict: true — zero `any` types
- [ ] All API responses typed in src/types/
- [ ] Passwords bcrypt 12 rounds
- [ ] Access token in React state only — never localStorage
- [ ] Refresh token httpOnly SameSite=Strict cookie
- [ ] Refresh token stored as SHA-256 hash in DB
- [ ] national_id SHA-256 hashed before DB write
- [ ] national_id never returned in any API response
- [ ] All DB via SQLAlchemy ORM — no raw SQL
- [ ] Person records scoped to user_id
- [ ] Rate limiting on /login, /register, /sso-token (slowapi)
- [ ] POST /api/auth/sso-token checks source=="orchestrator" claim
- [ ] Expired orch_token → navigate /login with ssoError message
- [ ] orch_token removed from URL immediately after exchange
- [ ] orch_token never logged
- [ ] No PII in any log output
- [ ] Containers run as non-root users
- [ ] TypeScript build errors fail Docker build

═══════════════════════════════════════════
BUILD ORDER
═══════════════════════════════════════════

.env.example → .gitignore →
backend/requirements.txt → backend/app/config.py → backend/app/database.py →
backend/app/models/ → backend/app/schemas/ →
backend/app/services/ → backend/app/middleware/auth.py →
backend/app/routers/auth.py (all endpoints incl. sso-token) →
backend/app/routers/persons.py → backend/app/main.py →
backend/alembic/ → backend/entrypoint.sh → backend/Dockerfile →
frontend/tsconfig.json → frontend/tsconfig.node.json →
frontend/src/vite-env.d.ts → frontend/src/env.ts →
frontend/src/types/ → frontend/src/api/ →
frontend/src/context/AuthContext.tsx →
frontend/src/components/ → frontend/src/pages/ →
frontend/src/App.tsx → frontend/src/main.tsx →
frontend/package.json → frontend/vite.config.ts →
frontend/tailwind.config.ts → frontend/postcss.config.ts →
frontend/nginx.conf → frontend/Dockerfile →
docker-compose.yml →
.github/workflows/docker-publish.yml →
README.md