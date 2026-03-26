from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import SessionLocal
from schemas import PartnerPlaceCreate, PartnerPlaceUpdate, PartnerPlaceOut
from repositories import partners_repo, partner_places_repo

router = APIRouter(prefix="/api/v1/crm/partner-places", tags=["CRM – PartnerPlaces"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=PartnerPlaceOut, status_code=201)
def create_partner_place(body: PartnerPlaceCreate, db: Session = Depends(get_db)):
    partner = partners_repo.get_partner_by_id(db, body.partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    data = body.dict()
    if data.get("commission_value") is not None:
        data["commission_value"] = float(data["commission_value"])

    pp = partner_places_repo.create_partner_place(db, data)
    return pp


@router.patch("/{partner_place_id}", response_model=PartnerPlaceOut)
def update_partner_place(
    partner_place_id: int,
    body: PartnerPlaceUpdate,
    db: Session = Depends(get_db),
):
    pp = partner_places_repo.get_partner_place_by_id(db, partner_place_id)
    if not pp:
        raise HTTPException(status_code=404, detail="PartnerPlace not found")

    data = {k: v for k, v in body.dict().items() if v is not None}
    if "commission_value" in data and data["commission_value"] is not None:
        data["commission_value"] = float(data["commission_value"])

    return partner_places_repo.update_partner_place(db, pp, data)
