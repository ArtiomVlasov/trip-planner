import os
from dotenv import load_dotenv
import jwt as pyjwt
from datetime import datetime, timedelta

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../", ".env"))

SECRET_KEY = os.getenv("SECRET_KEY")  # лучше в .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # сутки

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt