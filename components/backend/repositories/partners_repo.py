from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Partner
from services.partner_auth import hash_password


def get_partners(
    db: Session,
    status: Optional[str] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[List[Partner], int]:
    q = db.query(Partner)
    if status:
        q = q.filter(Partner.status == status)
    if category:
        q = q.filter(Partner.category == category)
    if city:
        q = q.filter(Partner.city == city)
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total


def get_partner_by_id(db: Session, partner_id: int) -> Optional[Partner]:
    return db.query(Partner).filter(Partner.id == partner_id).first()


def get_partner_by_login(db: Session, login: str) -> Optional[Partner]:
    return db.query(Partner).filter(Partner.login == login).first()


def create_partner(db: Session, data: dict) -> Partner:
    if data.get("password"):
        data["password"] = hash_password(data["password"])

    partner = Partner(**data)
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


def update_partner(db: Session, partner: Partner, data: dict) -> Partner:
    for key, value in data.items():
        if value is not None:
            setattr(partner, key, value)
    try:
        db.commit()
        db.refresh(partner)
    except Exception:
        db.rollback()
        raise
    return partner
