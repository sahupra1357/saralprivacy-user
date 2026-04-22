import uuid
from pydantic import BaseModel, EmailStr
from typing import Literal


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None
    provider: Literal["local", "google", "orchestrator"]

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse


class RefreshResponse(BaseModel):
    access_token: str


class SSOTokenRequest(BaseModel):
    orch_token: str
