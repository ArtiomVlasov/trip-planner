from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from db import SessionLocal
from models import PartnerPlace, RouteInsertionRule, EventLog
from schemas import RecommendationsOut, RecommendationItem, RouteInsertRequest, RouteInsertOut

router = APIRouter(prefix="/api/v1/partners", tags=["Runtime – Partner Recommendations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/recommendations", response_model=RecommendationsOut)
def get_recommendations(
    user_id: Optional[int] = Query(None),
    trip_id: Optional[int] = Query(None),
    day: Optional[int] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    context_type: Optional[str] = Query(None),
    budget_level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()

    q = (
        db.query(PartnerPlace)
        .filter(
            PartnerPlace.status == "active",
            PartnerPlace.is_promotable == True,
        )
    )

    q = q.filter(
        (PartnerPlace.start_date == None) | (PartnerPlace.start_date <= today)
    )
    q = q.filter(
        (PartnerPlace.end_date == None) | (PartnerPlace.end_date >= today)
    )

    partner_places = q.all()

    items = []
    for pp in partner_places:
        score = float(pp.priority_weight)

        rules = (
            db.query(RouteInsertionRule)
            .filter(
                RouteInsertionRule.partner_place_id == pp.id,
                RouteInsertionRule.status == "active",
            )
            .all()
        )

        reason_parts = []
        for rule in rules:
            score += rule.priority_boost
            if context_type and rule.trigger_type == "after_poi_type" and rule.trigger_value == context_type:
                score += 2.0
                reason_parts.append(f"matches context '{context_type}'")
            elif rule.trigger_type == "nearby":
                reason_parts.append("nearby rule")

        reason = ", ".join(reason_parts) if reason_parts else "partner promotion"

        place = pp.place
        items.append(
            RecommendationItem(
                partner_place_id=pp.id,
                partner_id=pp.partner_id,
                place_id=pp.place_id,
                place_name=place.name if place else None,
                score=round(score, 3),
                reason=reason,
                commission_type=pp.commission_type,
            )
        )

    items.sort(key=lambda x: x.score, reverse=True)

    return RecommendationsOut(items=items[:20])


@router.post("/route/insert", response_model=RouteInsertOut)
def insert_into_route(body: RouteInsertRequest, db: Session = Depends(get_db)):
    from repositories.partner_places_repo import get_partner_place_by_id

    pp = get_partner_place_by_id(db, body.partner_place_id)
    if not pp:
        raise HTTPException(status_code=404, detail="PartnerPlace not found")

    event = EventLog(
        trip_id=body.trip_id,
        route_id=body.route_id,
        partner_id=pp.partner_id,
        place_id=pp.place_id,
        partner_place_id=pp.id,
        event_type="impression",
    )
    db.add(event)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return RouteInsertOut(
        status="inserted",
        message=f"Partner place {pp.id} inserted into trip {body.trip_id} day {body.day}",
        partner_place_id=pp.id,
        trip_id=body.trip_id,
        day=body.day,
    )
