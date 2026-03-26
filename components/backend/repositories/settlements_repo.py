from typing import List, Optional
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Settlement, EventLog, PartnerPlace, Partner


def get_settlements(
    db: Session,
    partner_id: Optional[int] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[List[Settlement], int]:
    q = db.query(Settlement)
    if partner_id:
        q = q.filter(Settlement.partner_id == partner_id)
    if period_start:
        q = q.filter(Settlement.period_start >= period_start)
    if period_end:
        q = q.filter(Settlement.period_end <= period_end)
    if status:
        q = q.filter(Settlement.status == status)
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return items, total


def get_settlement_by_id(db: Session, settlement_id: int) -> Optional[Settlement]:
    return db.query(Settlement).filter(Settlement.id == settlement_id).first()


def generate_settlements(
    db: Session,
    period_start: date,
    period_end: date,
    partner_id: Optional[int] = None,
) -> List[Settlement]:
    """
    Aggregate EventLog for the period and create Settlement records (draft).
    If partner_id is given – only for that partner, otherwise for all active partners.
    """
    partner_q = db.query(Partner).filter(Partner.status == "active")
    if partner_id:
        partner_q = partner_q.filter(Partner.id == partner_id)
    partners = partner_q.all()

    results: List[Settlement] = []
    for partner in partners:
        base_q = db.query(EventLog).filter(
            EventLog.partner_id == partner.id,
            EventLog.event_ts >= period_start,
            EventLog.event_ts <= period_end,
        )
        leads_count = base_q.filter(EventLog.event_type == "lead").count()
        bookings_count = base_q.filter(EventLog.event_type == "booking").count()

        gross = Decimal("0")
        for pp in partner.partner_places:
            if pp.commission_type and pp.commission_value:
                pp_events = base_q.filter(EventLog.partner_place_id == pp.id)
                if pp.commission_type == "cpa":
                    cnt = pp_events.filter(EventLog.event_type == "booking").count()
                elif pp.commission_type == "cpl":
                    cnt = pp_events.filter(EventLog.event_type == "lead").count()
                else:  # fixed
                    cnt = 1
                gross += Decimal(str(pp.commission_value)) * cnt

        settlement = Settlement(
            partner_id=partner.id,
            period_start=period_start,
            period_end=period_end,
            leads_count=leads_count,
            bookings_count=bookings_count,
            gross_amount=gross,
            payout_amount=gross,
            currency="RUB",
            status="draft",
        )
        db.add(settlement)
        results.append(settlement)

    try:
        db.commit()
        for s in results:
            db.refresh(s)
    except Exception:
        db.rollback()
        raise
    return results


def update_settlement(db: Session, settlement: Settlement, data: dict) -> Settlement:
    if "status" in data and data["status"] is not None:
        settlement.status = data["status"]
    if "adjustment_amount" in data and data["adjustment_amount"] is not None:
        settlement.payout_amount = settlement.gross_amount + Decimal(str(data["adjustment_amount"]))
    try:
        db.commit()
        db.refresh(settlement)
    except Exception:
        db.rollback()
        raise
    return settlement
