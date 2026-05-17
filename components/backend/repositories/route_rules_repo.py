from typing import List, Optional
from sqlalchemy.orm import Session

from models import RouteInsertionRule, PartnerPlace


def get_route_rules(
    db: Session,
    partner_id: Optional[int] = None,
    status: Optional[str] = None,
    trigger_type: Optional[str] = None,
    city: Optional[str] = None,
) -> List[RouteInsertionRule]:
    q = db.query(RouteInsertionRule)
    if partner_id:
        q = q.filter(RouteInsertionRule.partner_id == partner_id)
    if status:
        q = q.filter(RouteInsertionRule.status == status)
    if trigger_type:
        q = q.filter(RouteInsertionRule.trigger_type == trigger_type)
    if city:
        # filter via partner_place -> place city (join)
        q = (
            q.join(PartnerPlace, RouteInsertionRule.partner_place_id == PartnerPlace.id, isouter=True)
        )
    return q.all()


def get_route_rule_by_id(db: Session, rule_id: int) -> Optional[RouteInsertionRule]:
    return db.query(RouteInsertionRule).filter(RouteInsertionRule.id == rule_id).first()


def create_route_rule(db: Session, data: dict) -> RouteInsertionRule:
    rule = RouteInsertionRule(**data)
    db.add(rule)
    try:
        db.commit()
        db.refresh(rule)
    except Exception:
        db.rollback()
        raise
    return rule


def update_route_rule(db: Session, rule: RouteInsertionRule, data: dict) -> RouteInsertionRule:
    for key, value in data.items():
        if value is not None:
            setattr(rule, key, value)
    try:
        db.commit()
        db.refresh(rule)
    except Exception:
        db.rollback()
        raise
    return rule
