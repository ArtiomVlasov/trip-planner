from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from db import SessionLocal
from schemas import RouteRuleCreate, RouteRuleUpdate, RouteRuleOut
from repositories import route_rules_repo, partner_places_repo

router = APIRouter(prefix="/api/v1/crm/route-rules", tags=["CRM – RouteInsertionRules"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=list[RouteRuleOut])
def list_route_rules(
    partner_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    trigger_type: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    rules = route_rules_repo.get_route_rules(
        db,
        partner_id=partner_id,
        status=status,
        trigger_type=trigger_type,
        city=city,
    )
    return rules


@router.post("", response_model=RouteRuleOut, status_code=201)
def create_route_rule(body: RouteRuleCreate, db: Session = Depends(get_db)):
    pp = partner_places_repo.get_partner_place_by_id(db, body.partner_place_id)
    if not pp:
        raise HTTPException(status_code=404, detail="PartnerPlace not found")

    data = body.dict()
    data["partner_id"] = pp.partner_id

    rule = route_rules_repo.create_route_rule(db, data)
    return rule


@router.patch("/{rule_id}", response_model=RouteRuleOut)
def update_route_rule(
    rule_id: int,
    body: RouteRuleUpdate,
    db: Session = Depends(get_db),
):
    rule = route_rules_repo.get_route_rule_by_id(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="RouteInsertionRule not found")

    data = {k: v for k, v in body.dict().items() if v is not None}
    return route_rules_repo.update_route_rule(db, rule, data)
