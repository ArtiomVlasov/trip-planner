from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from db import SessionLocal
from schemas import PartnerCreate, PartnerUpdate, PartnerOut, PartnerListOut
from repositories import partners_repo

router = APIRouter(prefix="/api/v1/crm/partners", tags=["CRM – Partners"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=PartnerListOut)
def list_partners(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = partners_repo.get_partners(
        db, status=status, category=category, city=city, page=page, limit=limit
    )
    return PartnerListOut(items=items, total=total, page=page, limit=limit)


@router.post("", response_model=PartnerOut, status_code=201)
def create_partner(body: PartnerCreate, db: Session = Depends(get_db)):
    data = body.dict()
    partner = partners_repo.create_partner(db, data)
    return partner


@router.patch("/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: int,
    body: PartnerUpdate,
    db: Session = Depends(get_db),
):
    partner = partners_repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    data = {k: v for k, v in body.dict().items() if v is not None}
    return partners_repo.update_partner(db, partner, data)
