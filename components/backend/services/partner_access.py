from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt as pyjwt

from services.auth_utils import ALGORITHM, SECRET_KEY


partner_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/crm/partners/login")


def extract_partner_id_from_token(token: str) -> int:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except pyjwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    if payload.get("role") != "partner":
        raise HTTPException(status_code=403, detail="Partner access required")

    partner_id = payload.get("partner_id")
    try:
        return int(partner_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid partner token") from exc


def get_current_partner_id(token: str = Depends(partner_oauth2_scheme)) -> int:
    return extract_partner_id_from_token(token)
