import hashlib
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models.person import Person
from app.schemas.person import PersonCreate, PersonUpdate


def _hash_national_id(national_id: str) -> str:
    return hashlib.sha256(national_id.encode()).hexdigest()


async def get_persons(db: AsyncSession, user_id: uuid.UUID, search: str | None = None) -> list[Person]:
    query = select(Person).where(Person.user_id == user_id, Person.is_deleted == False)  # noqa: E712
    if search:
        like = f"%{search}%"
        query = query.where(or_(Person.full_name.ilike(like), Person.email.ilike(like)))
    result = await db.execute(query.order_by(Person.created_at.desc()))
    return list(result.scalars().all())


async def get_person(db: AsyncSession, person_id: uuid.UUID, user_id: uuid.UUID) -> Person | None:
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.user_id == user_id,
            Person.is_deleted == False,  # noqa: E712
        )
    )
    return result.scalar_one_or_none()


async def create_person(db: AsyncSession, user_id: uuid.UUID, data: PersonCreate) -> Person:
    national_id = _hash_national_id(data.national_id) if data.national_id else None
    person = Person(
        user_id=user_id,
        full_name=data.full_name,
        email=data.email,
        phone_number=data.phone_number,
        address_line1=data.address_line1,
        address_line2=data.address_line2,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        country=data.country,
        national_id=national_id,
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person


async def update_person(db: AsyncSession, person: Person, data: PersonUpdate) -> Person:
    update_data = data.model_dump(exclude_unset=True)
    if "national_id" in update_data and update_data["national_id"] is not None:
        update_data["national_id"] = _hash_national_id(update_data["national_id"])
    for field, value in update_data.items():
        setattr(person, field, value)
    await db.commit()
    await db.refresh(person)
    return person


async def delete_person(db: AsyncSession, person: Person) -> None:
    person.is_deleted = True
    await db.commit()
