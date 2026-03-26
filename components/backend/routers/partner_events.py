from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import SessionLocal
from schemas import EventCreate, EventOut
from repositories import events_repo

router = APIRouter(prefix="/api/v1/events", tags=["Events – Partner"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/partner", response_model=EventOut, status_code=201)
def log_partner_event(body: EventCreate, db: Session = Depends(get_db)):
    data = {
        "event_type": body.event_type,
        "user_id": body.user_id,
        "trip_id": body.trip_id,
        "route_id": body.route_id,
        "partner_id": body.partner_id,
        "place_id": body.place_id,
        "partner_place_id": body.partner_place_id,
        "attribution_key": body.attribution_key,
        "metadata_json": body.metadata,
    }
    if body.event_ts:
        data["event_ts"] = body.event_ts

    event = events_repo.create_event(db, data)
    return event
