import asyncio
import hashlib
import logging
from datetime import datetime, timezone, timedelta

import httpx
from authlib.integrations.starlette_client import OAuth

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.responses import RedirectResponse

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.user import (
    AuthResponse,
    RefreshResponse,
    SSOTokenRequest,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_user_by_email,
    get_user_by_provider,
    hash_password,
    sha256_hex,
    validate_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        secure=False,
    )


def _issue_tokens(user: User, response: Response) -> AuthResponse:
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


async def _notify_orchestrator(callback_url: str, email: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(callback_url, json={"email": email, "secret": settings.ORCHESTRATOR_TOKEN_SECRET})
    except Exception as exc:
        logger.warning("Orchestrator callback failed: %s", exc)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, response: Response, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    if not validate_password(body.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 chars with 1 uppercase and 1 number")
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        provider="local",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    auth = _issue_tokens(user, response)
    user.refresh_token_hash = sha256_hex(create_refresh_token(str(user.id)))
    await db.commit()

    if settings.ORCHESTRATOR_CALLBACK_URL:
        asyncio.ensure_future(_notify_orchestrator(settings.ORCHESTRATOR_CALLBACK_URL, user.email))

    return auth


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/15minutes")
async def login(request: Request, body: UserLogin, response: Response, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await get_user_by_email(db, body.email)
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token_hash = sha256_hex(refresh_token)
    await db.commit()
    access_token = create_access_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    current_user.refresh_token_hash = None
    await db.commit()
    response.delete_cookie(COOKIE_NAME)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)) -> RefreshResponse:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        user_id_str = decode_refresh_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    import uuid
    from app.services.auth_service import get_user_by_id
    user = await get_user_by_id(db, uuid.UUID(user_id_str))
    if not user or user.refresh_token_hash != sha256_hex(token):
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    return RefreshResponse(access_token=create_access_token(str(user.id)))


@router.get("/google")
async def google_login(request: Request) -> RedirectResponse:
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)  # type: ignore[no-any-return]


@router.get("/google/callback")
async def google_callback(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> RedirectResponse:
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or {}
    sub = str(userinfo.get("sub", ""))
    email = str(userinfo.get("email", ""))
    full_name = str(userinfo.get("name", email.split("@")[0]))
    avatar_url = userinfo.get("picture")

    user = await get_user_by_provider(db, "google", sub)
    if not user:
        user = await get_user_by_email(db, email)
        if user:
            user.provider = "google"
            user.provider_id = sub
            user.avatar_url = avatar_url
        else:
            user = User(
                full_name=full_name,
                email=email,
                provider="google",
                provider_id=sub,
                avatar_url=avatar_url,
            )
            db.add(user)
    else:
        user.avatar_url = avatar_url

    refresh_token = create_refresh_token(str(user.id) if user.id else "temp")
    await db.commit()
    await db.refresh(user)
    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token_hash = sha256_hex(refresh_token)
    await db.commit()

    access_token = create_access_token(str(user.id))
    redirect = RedirectResponse(url=f"/dashboard?token={access_token}")
    _set_refresh_cookie(redirect, refresh_token)
    return redirect


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/sso-token", response_model=AuthResponse)
@limiter.limit("10/minute")
async def exchange_sso_token(
    request: Request,
    body: SSOTokenRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    try:
        payload = jwt.decode(body.orch_token, settings.ORCHESTRATOR_TOKEN_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Access link expired")

    if payload.get("source") != "orchestrator":
        raise HTTPException(status_code=401, detail="Invalid token source")

    email = payload.get("email")
    if not isinstance(email, str):
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await get_user_by_email(db, email)
    if not user:
        user = User(
            full_name=email.split("@")[0],
            email=email,
            provider="orchestrator",
        )
        db.add(user)
        await db.flush()

    refresh_token = create_refresh_token(str(user.id))
    user.refresh_token_hash = sha256_hex(refresh_token)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)
    return AuthResponse(access_token=access_token, user=UserResponse.model_validate(user))
