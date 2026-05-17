from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from db import SessionLocal
from schemas import EventListOut, EventOut
from repositories import events_repo

router = APIRouter(prefix="/api/v1/crm/events", tags=["CRM – Events"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=EventListOut)
def list_events(
    partner_id: Optional[int] = Query(None),
    event_type: Optional[str] = Query(None),
    from_ts: Optional[datetime] = Query(None, alias="from"),
    to_ts: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    items, total = events_repo.get_events(
        db,
        partner_id=partner_id,
        event_type=event_type,
        from_ts=from_ts,
        to_ts=to_ts,
        page=page,
        limit=limit,
    )
    return EventListOut(items=items, total=total, page=page, limit=limit)
