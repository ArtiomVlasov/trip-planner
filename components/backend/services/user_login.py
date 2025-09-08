from sqlalchemy.orm import Session
from fastapi import HTTPException
from passlib.context import CryptContext
from models import User
from schemas import UserLogin

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def login_user(db: Session, user_data: UserLogin):
    user = db.query(User).filter(User.username == user_data.username).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password")

    if not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=400, detail="Invalid username or password")

    return {
        "user_id": user.id,
    }