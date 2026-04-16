from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point

from db import SessionLocal
from models import PartnerPlace, Place
from schemas import (
    CrmPlaceCreate,
    GeocodedAddressOut,
    CrmPlaceManageOut,
    CrmPlaceOut,
    CrmPlaceUpdate,
    GeneratedExternalIdOut,
)
from services.geocoding import GeocodingError, geocode_address
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


def get_place_category(place: Place) -> Optional[str]:
    return place.types[0] if place.types else None


def serialize_managed_place(place: Place) -> CrmPlaceManageOut:
    geom = to_shape(place.location) if place.location is not None else None
    return CrmPlaceManageOut(
        place_id=place.place_id,
        name=place.name,
        category=get_place_category(place),
        formatted_address=place.formatted_address,
        lat=geom.y if geom is not None else None,
        lng=geom.x if geom is not None else None,
        types=place.types,
    )


def ensure_partner_can_manage_place(db: Session, place_id: str, partner_id: int) -> Place:
    place = db.query(Place).filter(Place.place_id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    has_access = place.partner_id == partner_id or (
        db.query(PartnerPlace.id)
        .filter(
            PartnerPlace.partner_id == partner_id,
            PartnerPlace.place_id == place_id,
        )
        .first()
        is not None
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied for this place")

    return place


def resolve_place_coordinates(
    *,
    address: str | None,
    city: str | None,
    lat: float | None,
    lng: float | None,
) -> tuple[str | None, float, float]:
    if (lat is None) != (lng is None):
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be provided together",
        )

    if lat is not None and lng is not None:
        return address, lat, lng

    if not address or not address.strip():
        raise HTTPException(
            status_code=400,
            detail="Address is required to determine coordinates",
        )

    try:
        geocoded = geocode_address(address=address, city=city)
    except GeocodingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return geocoded["formatted_address"], geocoded["lat"], geocoded["lng"]


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


@router.get("/geocode-preview", response_model=GeocodedAddressOut)
def preview_geocoded_address(
    address: str = Query(..., min_length=3),
    city: str = Query("sochi"),
    current_partner_id: int = Depends(get_current_partner_id),
):
    del current_partner_id
    try:
        geocoded = geocode_address(address=address, city=city)
    except GeocodingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return GeocodedAddressOut(**geocoded)


@router.post("", response_model=CrmPlaceOut, status_code=201)
def create_place(
    body: CrmPlaceCreate,
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    place_id = generate_partner_external_id(db, current_partner_id, body.name)

    existing = db.query(Place).filter(Place.place_id == place_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Place with this ID already exists")

    formatted_address, lat, lng = resolve_place_coordinates(
        address=body.address,
        city=body.city,
        lat=body.lat,
        lng=body.lng,
    )
    geom = from_shape(Point(lng, lat), srid=4326)

    tags = body.tags or []
    place = Place(
        place_id=place_id,
        name=body.name,
        formatted_address=formatted_address,
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


@router.patch("/{place_id}", response_model=CrmPlaceManageOut)
def update_place(
    place_id: str,
    body: CrmPlaceUpdate,
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    place = ensure_partner_can_manage_place(db, place_id, current_partner_id)
    data = body.dict()

    if data.get("name") is not None:
        stripped_name = data["name"].strip()
        if not stripped_name:
            raise HTTPException(status_code=400, detail="Place name cannot be empty")
        place.name = stripped_name

    if data.get("address") is not None:
        place.formatted_address = data["address"]

    if data.get("category") is not None:
        category = data["category"].strip()
        if not category:
            raise HTTPException(status_code=400, detail="Category cannot be empty")
        extra_types = [value for value in (place.types or [])[1:] if value != category]
        place.types = [category] + extra_types

    address_changed = data.get("address") is not None
    coordinates_changed = data.get("lat") is not None or data.get("lng") is not None
    if address_changed or coordinates_changed:
        formatted_address, lat, lng = resolve_place_coordinates(
            address=data.get("address") if address_changed else place.formatted_address,
            city="sochi",
            lat=data.get("lat"),
            lng=data.get("lng"),
        )
        place.formatted_address = formatted_address
        place.location = from_shape(Point(lng, lat), srid=4326)

    try:
        db.commit()
        db.refresh(place)
    except Exception:
        db.rollback()
        raise

    return serialize_managed_place(place)
