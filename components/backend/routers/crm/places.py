from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Float
from typing import Optional
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2 import WKTElement

from db import SessionLocal
from models import Place
from schemas import CrmPlaceCreate, CrmPlaceOut

router = APIRouter(prefix="/api/v1/crm/places", tags=["CRM – Places"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


@router.post("", response_model=CrmPlaceOut, status_code=201)
def create_place(body: CrmPlaceCreate, db: Session = Depends(get_db)):
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point

    place_id = body.external_id or f"manual_{body.name.lower().replace(' ', '_')}_{int(body.lat * 1000)}_{int(body.lng * 1000)}"

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
    )
    db.add(place)
    try:
        db.commit()
        db.refresh(place)
    except Exception:
        db.rollback()
        raise
    return place
