from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models import EventLog


def create_event(db: Session, data: dict) -> EventLog:
    event = EventLog(**data)
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except Exception:
        db.rollback()
        raise
    return event


def get_events(
    db: Session,
    partner_id: Optional[int] = None,
    event_type: Optional[str] = None,
    from_ts: Optional[datetime] = None,
    to_ts: Optional[datetime] = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[List[EventLog], int]:
    q = db.query(EventLog)
    if partner_id:
        q = q.filter(EventLog.partner_id == partner_id)
    if event_type:
        q = q.filter(EventLog.event_type == event_type)
    if from_ts:
        q = q.filter(EventLog.event_ts >= from_ts)
    if to_ts:
        q = q.filter(EventLog.event_ts <= to_ts)
    total = q.count()
    items = q.order_by(EventLog.event_ts.desc()).offset((page - 1) * limit).limit(limit).all()
    return items, total
