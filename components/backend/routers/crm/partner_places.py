from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session
from typing import Any, Optional

from db import SessionLocal
from schemas import (
    PartnerManagedPlaceOut,
    PartnerManagedPlaceWithStatsOut,
    PartnerPlaceCreate,
    PartnerPlacesDashboardOut,
    PartnerPlacesSummaryOut,
    PartnerPlaceOut,
    PartnerPlaceUpdate,
)
from repositories import partners_repo, partner_places_repo
from services.partner_access import get_current_partner_id

router = APIRouter(prefix="/api/v1/crm/partner-places", tags=["CRM – PartnerPlaces"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_partner_place(pp) -> PartnerManagedPlaceOut:
    place = pp.place
    geom = to_shape(place.location) if place and place.location is not None else None
    category = place.types[0] if place and place.types else None

    return PartnerManagedPlaceOut(
        partner_place_id=pp.id,
        partner_id=pp.partner_id,
        place_id=pp.place_id,
        name=place.name if place else None,
        category=category,
        formatted_address=place.formatted_address if place else None,
        lat=geom.y if geom is not None else None,
        lng=geom.x if geom is not None else None,
        types=place.types if place else None,
        relationship_type=pp.relationship_type,
        priority_weight=pp.priority_weight,
        commission_type=pp.commission_type,
        commission_value=pp.commission_value,
        is_promotable=pp.is_promotable,
        start_date=pp.start_date,
        end_date=pp.end_date,
        status=pp.status,
    )


def serialize_partner_place_with_stats(
    pp,
    stats: Optional[dict[str, Any]] = None,
) -> PartnerManagedPlaceWithStatsOut:
    base_payload = serialize_partner_place(pp).dict()
    return PartnerManagedPlaceWithStatsOut(
        **base_payload,
        stats=stats or partner_places_repo.build_partner_place_stats_payload(),
    )


def build_partner_dashboard_summary(
    partner_places,
    overall_stats: dict[str, Any],
) -> PartnerPlacesSummaryOut:
    return PartnerPlacesSummaryOut(
        total_places=len(partner_places),
        active_places=sum(1 for pp in partner_places if pp.status == "active"),
        paused_places=sum(1 for pp in partner_places if pp.status == "paused"),
        archived_places=sum(1 for pp in partner_places if pp.status == "archived"),
        promotable_places=sum(1 for pp in partner_places if pp.is_promotable),
        **overall_stats,
    )


@router.get("/mine", response_model=list[PartnerManagedPlaceOut])
def list_my_partner_places(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    partner_places = partner_places_repo.get_partner_places(
        db,
        partner_id=current_partner_id,
        status=status,
    )
    return [serialize_partner_place(pp) for pp in partner_places]


@router.get("/mine/stats", response_model=PartnerPlacesDashboardOut)
def get_my_partner_places_dashboard(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    partner_places = partner_places_repo.get_partner_places(
        db,
        partner_id=current_partner_id,
        status=status,
    )
    stats_by_partner_place_id = partner_places_repo.get_partner_place_stats_map(
        db,
        partner_id=current_partner_id,
    )
    overall_stats = partner_places_repo.get_partner_overall_stats(
        db,
        partner_id=current_partner_id,
    )

    return PartnerPlacesDashboardOut(
        summary=build_partner_dashboard_summary(partner_places, overall_stats),
        items=[
            serialize_partner_place_with_stats(
                pp,
                stats_by_partner_place_id.get(pp.id),
            )
            for pp in partner_places
        ],
    )


@router.post("", response_model=PartnerPlaceOut, status_code=201)
def create_partner_place(
    body: PartnerPlaceCreate,
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    partner = partners_repo.get_partner_by_id(db, current_partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    data = body.dict()
    data["partner_id"] = current_partner_id
    if data.get("commission_value") is not None:
        data["commission_value"] = float(data["commission_value"])

    pp = partner_places_repo.create_partner_place(db, data)
    return pp


@router.patch("/{partner_place_id}", response_model=PartnerPlaceOut)
def update_partner_place(
    partner_place_id: int,
    body: PartnerPlaceUpdate,
    db: Session = Depends(get_db),
    current_partner_id: int = Depends(get_current_partner_id),
):
    pp = partner_places_repo.get_partner_place_by_id(db, partner_place_id)
    if not pp:
        raise HTTPException(status_code=404, detail="PartnerPlace not found")
    if pp.partner_id != current_partner_id:
        raise HTTPException(status_code=403, detail="Access denied for this partner place")

    data = {k: v for k, v in body.dict().items() if v is not None}
    if "commission_value" in data and data["commission_value"] is not None:
        data["commission_value"] = float(data["commission_value"])

    return partner_places_repo.update_partner_place(db, pp, data)
