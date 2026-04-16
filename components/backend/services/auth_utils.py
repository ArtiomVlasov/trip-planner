import base64
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jwt import JWT, jwk_from_dict
from jwt.utils import get_int_from_datetime

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../", ".env"))

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24


class TokenDecodeError(Exception):
    pass


def _build_secret_key():
    secret_bytes = (SECRET_KEY or "").encode("utf-8")
    encoded_secret = base64.urlsafe_b64encode(secret_bytes).rstrip(b"=").decode("ascii")
    return jwk_from_dict({"kty": "oct", "k": encoded_secret})


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": get_int_from_datetime(expire)})
    return JWT().encode(to_encode, _build_secret_key(), alg=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return JWT().decode(token, _build_secret_key(), do_time_check=True)
    except Exception as exc:
        raise TokenDecodeError("Invalid token") from exc
