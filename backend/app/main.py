from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.routers import auth, persons

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="SaralPrivacy User API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.ACCESS_TOKEN_SECRET)

app.include_router(auth.router)
app.include_router(persons.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
