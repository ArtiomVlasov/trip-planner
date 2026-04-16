from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from models import PartnerPlace


def get_partner_place_by_id(db: Session, pp_id: int) -> Optional[PartnerPlace]:
    return (
        db.query(PartnerPlace)
        .options(joinedload(PartnerPlace.place))
        .filter(PartnerPlace.id == pp_id)
        .first()
    )


def get_partner_places(
    db: Session,
    partner_id: Optional[int] = None,
    place_id: Optional[str] = None,
    status: Optional[str] = None,
) -> List[PartnerPlace]:
    q = db.query(PartnerPlace).options(joinedload(PartnerPlace.place))
    if partner_id:
        q = q.filter(PartnerPlace.partner_id == partner_id)
    if place_id:
        q = q.filter(PartnerPlace.place_id == place_id)
    if status:
        q = q.filter(PartnerPlace.status == status)
    return q.order_by(PartnerPlace.id.desc()).all()


def create_partner_place(db: Session, data: dict) -> PartnerPlace:
    pp = PartnerPlace(**data)
    db.add(pp)
    try:
        db.commit()
        db.refresh(pp)
    except Exception:
        db.rollback()
        raise
    return pp


def update_partner_place(db: Session, pp: PartnerPlace, data: dict) -> PartnerPlace:
    for key, value in data.items():
        if value is not None:
            setattr(pp, key, value)
    try:
        db.commit()
        db.refresh(pp)
    except Exception:
        db.rollback()
        raise
    return pp
