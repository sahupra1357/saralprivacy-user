import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.person import PersonCreate, PersonResponse, PersonUpdate
from app.services.person_service import (
    create_person,
    delete_person,
    get_person,
    get_persons,
    update_person,
)

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.get("", response_model=list[PersonResponse])
async def list_persons(
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PersonResponse]:
    persons = await get_persons(db, current_user.id, search)
    return [PersonResponse.model_validate(p) for p in persons]


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person_by_id(
    person_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = await get_person(db, person_id, current_user.id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return PersonResponse.model_validate(person)


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person_route(
    body: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = await create_person(db, current_user.id, body)
    return PersonResponse.model_validate(person)


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person_route(
    person_id: uuid.UUID,
    body: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonResponse:
    person = await get_person(db, person_id, current_user.id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    updated = await update_person(db, person, body)
    return PersonResponse.model_validate(updated)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person_route(
    person_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await get_person(db, person_id, current_user.id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    await delete_person(db, person)
