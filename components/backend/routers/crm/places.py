from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID

from db import SessionLocal
from models import PartnerPlace, Place
from schemas import CrmPlaceCreate, CrmPlaceOut, GeneratedExternalIdOut
from services.partner_access import get_current_partner_id
from services.place_external_ids import (
    build_partner_external_id_base,
    pick_unique_external_id,
)

router = APIRouter(prefix="/api/v1/crm/places", tags=["CRM – Places"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_partner_external_id(db: Session, partner_id: int, place_name: str) -> str:
    base_id = build_partner_external_id_base(partner_id, place_name)

    linked_ids = {
        place_id
        for (place_id,) in db.query(PartnerPlace.place_id)
        .filter(
            PartnerPlace.partner_id == partner_id,
            PartnerPlace.place_id.startswith(base_id),
        )
        .all()
    }
    owned_ids = {
        place_id
        for (place_id,) in db.query(Place.place_id)
        .filter(
            Place.partner_id == partner_id,
            Place.place_id.startswith(base_id),
        )
        .all()
    }

    return pick_unique_external_id(base_id, linked_ids | owned_ids)


@router.get("/search", response_model=list[CrmPlaceOut])
def search_places(
    external_id: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_m: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Place)

    if external_id:
        q = q.filter(Place.place_id == external_id)
    elif name:
        q = q.filter(Place.name.ilike(f"%{name}%"))

    if lat is not None and lng is not None and radius_m is not None:
        point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        q = q.filter(ST_DWithin(Place.location, point, radius_m))

    return q.limit(20).all()


@router.get("/external-id-preview", response_model=GeneratedExternalIdOut)
def preview_external_id(
    name: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    return GeneratedExternalIdOut(
        external_id=generate_partner_external_id(db, current_partner_id, name)
    )


@router.post("", response_model=CrmPlaceOut, status_code=201)
def create_place(
    body: CrmPlaceCreate,
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point

    place_id = generate_partner_external_id(db, current_partner_id, body.name)

    existing = db.query(Place).filter(Place.place_id == place_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Place with this ID already exists")

    geom = from_shape(Point(body.lng, body.lat), srid=4326)

    tags = body.tags or []
    place = Place(
        place_id=place_id,
        name=body.name,
        formatted_address=body.address,
        location=geom,
        types=[body.category] + tags,
        rating=body.rating,
        source="partner",
        partner_id=current_partner_id,
    )
    db.add(place)
    try:
        db.commit()
        db.refresh(place)
    except Exception:
        db.rollback()
        raise
    return place
