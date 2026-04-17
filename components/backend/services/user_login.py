from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import User
from schemas import UserLogin
import base64
import hashlib
import secrets

SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1}
SALT_LEN = 16
KEY_LEN = 64

def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split("$")
        assert parts[0] == "scrypt"
        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = base64.b64decode(parts[4])
        expected = base64.b64decode(parts[5])
        dk = hashlib.scrypt(
            plain_password.encode(),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected)
        )
        return secrets.compare_digest(dk, expected)
    except Exception:
        return False
    
def login_user(db: Session, user_data: UserLogin):
    user = db.query(User).filter(User.email == user_data.email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    return user
