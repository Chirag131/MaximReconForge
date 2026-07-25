# MaximReconForge — Backend Scaffolding & Docker Build Guide

**Purpose of this document:** a step-by-step build spec for Claude Code to execute. It scaffolds the FastAPI backend, the tool-runner worker skeleton, and the full Docker Compose stack — everything **except** the actual pentest tool implementations.

> **Explicitly out of scope for this build:** `tools/registry.py` and `runner/executor.py` are created as empty placeholders only. No tool logic (subfinder, nmap, nuclei, etc.), no ScopeGuard rule implementation, no LangGraph Commander prompts. Those come in a later pass with their own spec.

---

## 0. Build order (do these in sequence)

1. Create the repo structure (§1)
2. Write `.env.example` and `.gitignore` (§2)
3. Write `docker-compose.yml` (§3)
4. Scaffold the `backend/` service — Dockerfile, deps, FastAPI app, DB models, auth, domain validator (§4–§9)
5. Scaffold the `worker/` service — Dockerfile, deps, ARQ entrypoint, placeholder executor (§10)
6. Write the Nginx config (§11)
7. Run `docker compose up --build` and verify health endpoints (§12)

Each step below is self-contained — create every file with the exact content shown before moving to the next step.

---

## 1. Repository structure

```
maximreconforge/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/            # empty, migrations generated later
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── db/
│       │   ├── __init__.py
│       │   ├── base.py
│       │   ├── session.py
│       │   └── models.py
│       ├── auth/
│       │   ├── __init__.py
│       │   ├── security.py
│       │   ├── schemas.py
│       │   └── routes.py
│       ├── core/
│       │   ├── __init__.py
│       │   └── scope_validator.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── engagements.py
│       │   └── websocket.py
│       ├── graph/
│       │   ├── __init__.py
│       │   ├── state.py
│       │   └── supervisor.py
│       ├── context_store/
│       │   ├── __init__.py
│       │   └── store.py
│       ├── vector/
│       │   ├── __init__.py
│       │   └── qdrant_client.py
│       ├── queue/
│       │   ├── __init__.py
│       │   └── arq_settings.py
│       └── tools/
│           ├── __init__.py
│           └── registry.py          # PLACEHOLDER — out of scope
├── worker/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── runner/
│       ├── __init__.py
│       ├── main.py
│       └── executor.py              # PLACEHOLDER — out of scope
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       └── default.conf
└── engagements/                     # bind-mounted volume, per-engagement context folders live here
```

---

## 2. Root config files

### `.env.example`
```env
# --- App ---
ENVIRONMENT=development
JWT_SECRET_KEY=change-me-to-a-long-random-string
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Postgres ---
POSTGRES_USER=maximreconforge
POSTGRES_PASSWORD=change-me
POSTGRES_DB=maximreconforge
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://maximreconforge:change-me@postgres:5432/maximreconforge

# --- Redis / ARQ ---
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://redis:6379/0

# --- Qdrant ---
QDRANT_HOST=qdrant
QDRANT_PORT=6333

# --- CORS ---
FRONTEND_ORIGIN=https://your-frontend.vercel.app

# --- LLM (placeholder, fill in later) ---
LLM_PROVIDER=groq
LLM_API_KEY=
```

### `.gitignore`
```gitignore
.env
__pycache__/
*.pyc
.venv/
venv/
engagements/*/
!engagements/.gitkeep
*.log
.DS_Store
```

---

## 3. `docker-compose.yml`

```yaml
services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    env_file: .env
    depends_on:
      - postgres
      - redis
      - qdrant
    volumes:
      - ./engagements:/engagements
    expose:
      - "8000"
    restart: unless-stopped

  worker:
    build: ./worker
    env_file: .env
    depends_on:
      - postgres
      - redis
      - qdrant
    volumes:
      - ./engagements:/engagements
    user: "1000:1000"       # non-root
    read_only: true
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1g
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    env_file: .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    expose:
      - "5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    expose:
      - "6379"
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_data:/qdrant/storage
    expose:
      - "6333"
    restart: unless-stopped

volumes:
  postgres_data:
  qdrant_data:
```

**Note on `worker`:** `read_only: true` + non-root `user` + resource limits are already wired in per §3.6 of the architecture doc, even though the executor itself is a placeholder — get the sandbox constraints right from the start so nobody forgets to add them later.

---

## 4. `backend/requirements.txt`

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
asyncpg==0.29.0
alembic==1.13.2
pydantic==2.9.2
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
arq==0.26.1
redis==5.0.8
qdrant-client==1.11.1
langgraph==0.2.34
langgraph-checkpoint-postgres==2.0.1
websockets==13.1
```

## 5. `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 6. `backend/app/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str = "development"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    database_url: str
    redis_url: str
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333

    frontend_origin: str = "http://localhost:3000"

    llm_provider: str = "groq"
    llm_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 7. Database layer

### `backend/app/db/base.py`
```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

### `backend/app/db/session.py`
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

### `backend/app/db/models.py`
```python
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, JSON, Text, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Engagement(Base):
    __tablename__ = "engagements"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_domain: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending|running|aborted|completed|failed
    scope_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("engagements.id"))
    asset_type: Mapped[str] = mapped_column(String)  # subdomain|ip|cidr|url
    value: Mapped[str] = mapped_column(String)
    discovered_from: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Finding(Base):
    __tablename__ = "findings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("engagements.id"))
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"))
    caused_by_finding_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("findings.id"), nullable=True)
    severity: Mapped[str] = mapped_column(String)  # Critical|High|Medium|Low|Info
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text)
    evidence_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("engagements.id"))
    agent: Mapped[str] = mapped_column(String)
    tool: Mapped[str | None] = mapped_column(String, nullable=True)
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    target: Mapped[str | None] = mapped_column(String, nullable=True)
    result_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    prev_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

`caused_by_finding_id` is the parent-reference column discussed earlier — enough to reconstruct an attack chain with one recursive query, no graph database needed at this scale.

### Alembic
Run these once scaffolding is in place (Claude Code should execute, not just write):
```bash
cd backend
alembic init alembic   # only if alembic/env.py below isn't already sufficient
alembic revision --autogenerate -m "init tables"
alembic upgrade head
```

`backend/alembic/env.py` should import `Base` from `app.db.base` and all models from `app.db.models` so autogenerate picks them up, and read `DATABASE_URL` from `app.config.settings`.

---

## 8. Auth scaffolding

### `backend/app/auth/security.py`
```python
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    expire = datetime.utcnow() + expires_delta
    payload = {"sub": subject, "exp": expire, "type": token_type}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

def create_access_token(subject: str) -> str:
    return create_token(subject, timedelta(minutes=settings.jwt_access_token_expire_minutes), "access")

def create_refresh_token(subject: str) -> str:
    return create_token(subject, timedelta(days=settings.jwt_refresh_token_expire_days), "refresh")

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
```

### `backend/app/auth/schemas.py`
```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

### `backend/app/auth/routes.py`
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import User
from app.auth.schemas import UserCreate, UserLogin, TokenPair
from app.auth.security import hash_password, verify_password, create_access_token, create_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenPair)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )

@router.post("/login", response_model=TokenPair)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenPair(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )

@router.post("/refresh", response_model=TokenPair)
async def refresh(refresh_token: str):
    from app.auth.security import decode_token
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    subject = payload["sub"]
    return TokenPair(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )
```

---

## 9. Domain/IP scope validator

This is the gate discussed earlier — runs before an engagement is created, rejects bad targets before anything is enqueued.

### `backend/app/core/scope_validator.py`
```python
import re
import socket
import ipaddress

DOMAIN_REGEX = re.compile(
    r"^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63}(?<!-))*\.[A-Za-z]{2,}$"
)

BLOCKLIST = {"localhost", "google.com", "example.com"}  # placeholder — expand as needed

class ScopeValidationError(Exception):
    pass

def is_valid_domain_syntax(domain: str) -> bool:
    return bool(DOMAIN_REGEX.match(domain))

def resolve_domain(domain: str) -> list[str]:
    try:
        return list({info[4][0] for info in socket.getaddrinfo(domain, None)})
    except socket.gaierror:
        raise ScopeValidationError(f"Domain '{domain}' does not resolve")

def is_private_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return addr.is_private or addr.is_loopback or addr.is_link_local

def validate_target_domain(domain: str) -> list[str]:
    """Raises ScopeValidationError on any failure. Returns resolved IPs on success."""
    domain = domain.strip().lower()

    if domain in BLOCKLIST:
        raise ScopeValidationError(f"'{domain}' is on the blocklist")

    if not is_valid_domain_syntax(domain):
        raise ScopeValidationError(f"'{domain}' is not a valid domain")

    resolved_ips = resolve_domain(domain)

    for ip in resolved_ips:
        if is_private_ip(ip):
            raise ScopeValidationError(f"Resolved IP {ip} is private/internal — not allowed")

    return resolved_ips
```

Wire this into `POST /engagements` in `app/api/engagements.py` — call `validate_target_domain()` first, return `422` with the error message on failure, only create the `Engagement` row and enqueue the recon job on success.

---

## 10. Worker service (tool-runner skeleton)

### `worker/requirements.txt`
```txt
arq==0.26.1
redis==5.0.8
pydantic==2.9.2
```

### `worker/Dockerfile`
```dockerfile
FROM python:3.12-slim

RUN useradd -m -u 1000 runner
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY runner ./runner

# NOTE: actual tool binaries (subfinder, amass, httpx, naabu, nmap, nuclei, ffuf)
# get installed here in a later pass, once the tool registry scope is defined.

USER runner
CMD ["python", "-m", "runner.main"]
```

### `worker/runner/main.py`
```python
from arq import run_worker
from arq.connections import RedisSettings
import os

async def startup(ctx):
    pass

async def shutdown(ctx):
    pass

class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
    on_startup = startup
    on_shutdown = shutdown
    functions = []  # tool-call functions registered here once registry.py is implemented

if __name__ == "__main__":
    run_worker(WorkerSettings)
```

### `worker/runner/executor.py`
```python
"""
PLACEHOLDER — out of scope for this build pass.

This is where validated tool-call requests (tool name + typed params) get
executed against the whitelisted tool registry and return structured,
parsed output. No tool logic goes here yet.
"""

async def execute_tool_call(tool_name: str, params: dict) -> dict:
    raise NotImplementedError("Tool registry not yet implemented")
```

### `backend/app/tools/registry.py`
```python
"""
PLACEHOLDER — out of scope for this build pass.

Tools will be defined here as Pydantic-validated function schemas, e.g.:
    run_subfinder(domain: str)
    run_httpx(urls: list[str])
    run_nuclei(target: str, templates: list[str])
    run_nmap(target: str, flags: str)

Each entry needs: timeout, output size cap, scope check hook, result parser.
"""

TOOL_REGISTRY: dict = {}
```

---

## 11. Nginx

### `nginx/nginx.conf`
```nginx
events {}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    client_max_body_size 10M;

    include /etc/nginx/conf.d/*.conf;
}
```

### `nginx/conf.d/default.conf`
```nginx
server {
    listen 80;
    server_name _;

    # Once a domain + cert are available, add:
    # listen 443 ssl;
    # ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

TLS block is commented out deliberately — it needs a real domain pointed at the VPS and a certbot run first (still an open item from the previous doc).

---

## 12. `backend/app/main.py` and verification

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth.routes import router as auth_router

app = FastAPI(title="MaximReconForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

**Verify after `docker compose up --build`:**
```bash
curl http://localhost/health
# → {"status": "ok"}

curl -X POST http://localhost/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass123"}'
# → returns access_token + refresh_token
```

---

## 13. Explicitly out of scope for this pass

- Tool registry implementation (`backend/app/tools/registry.py`) and executor logic (`worker/runner/executor.py`) — placeholders only, per your instruction.
- ScopeGuard enforcement logic, Commander system prompts, LangGraph phase subgraphs beyond an empty `supervisor.py`/`state.py` stub.
- Aggregator / whiteboard writer, ContextStore ACL enforcement — stub the files/folders so imports don't break, no real logic yet.
- TLS certificate issuance (needs a real domain first).
- `GET /engagements/{id}/report`, `POST /engagements/{id}/abort`, `WS /engagements/{id}/live` — routes can be stubbed as `501 Not Implemented` for now so the API surface exists.

Everything above should come in a follow-up pass once the tool scope is defined.
