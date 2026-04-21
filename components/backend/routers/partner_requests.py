from fastapi import APIRouter, status

from schemas import PartnerInquiryCreate
from services.partner_inquiry_email import send_partner_inquiry_email

router = APIRouter(prefix="/api/v1/partner-requests", tags=["Partner Requests"])


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_partner_request(body: PartnerInquiryCreate):
    send_partner_inquiry_email(body)
    return {"status": "accepted"}
