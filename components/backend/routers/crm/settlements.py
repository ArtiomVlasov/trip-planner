from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from db import SessionLocal
from schemas import SettlementGenerateRequest, SettlementUpdate, SettlementOut, SettlementListOut
from repositories import settlements_repo

router = APIRouter(prefix="/api/v1/crm/settlements", tags=["CRM – Settlements"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=SettlementListOut)
def list_settlements(
    partner_id: Optional[int] = Query(None),
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    items, total = settlements_repo.get_settlements(
        db,
        partner_id=partner_id,
        period_start=period_start,
        period_end=period_end,
        status=status,
        page=page,
        limit=limit,
    )
    return SettlementListOut(items=items, total=total, page=page, limit=limit)


@router.post("/generate", response_model=list[SettlementOut], status_code=201)
def generate_settlements(body: SettlementGenerateRequest, db: Session = Depends(get_db)):
    records = settlements_repo.generate_settlements(
        db,
        period_start=body.period_start,
        period_end=body.period_end,
        partner_id=body.partner_id,
    )
    return records


@router.patch("/{settlement_id}", response_model=SettlementOut)
def update_settlement(
    settlement_id: int,
    body: SettlementUpdate,
    db: Session = Depends(get_db),
):
    settlement = settlements_repo.get_settlement_by_id(db, settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")

    data = body.dict()
    return settlements_repo.update_settlement(db, settlement, data)
