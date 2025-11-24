import os
from fastapi import FastAPI, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi import Query
from services.auth_utils import SECRET_KEY
from .db import Base, engine, SessionLocal
from models import User, Route
from .schemas import *

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt as pyjwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        if username.startswith("{'") and username.endswith("'}"):
            username = username[2:-2]  
        elif username.startswith("'") and username.endswith("'"):
            username = username[1:-1]
                
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first()
                        
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            return user.id  
        finally:
            db.close()
            
    except pyjwt.PyJWTError as e:
        print("JWT Error:", e)
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print("Unexpected error in get_current_user:", e)
        raise HTTPException(status_code=401, detail="Authentication failed")


Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://43.245.224.126:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    from services.user_login import login_user
    from services.auth_utils import create_access_token

    db_user = login_user(db, user)  # проверяет логин и пароль
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(db_user)})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/register")
def register(user: UserRegistration, db: Session = Depends(get_db)):
    from services.user_resgister import register_user
    from services.auth_utils import create_access_token

    new_user = register_user(db, user)
    if not new_user:
        raise HTTPException(status_code=400, detail="User registration failed")

    token = create_access_token({"sub": new_user.username})
    return {"status": "registered", "token": token, "user_id": new_user.id}

@app.get("/")
async def root():
    return {"message": "Hello, FastAPI backend is working!"}

@app.get("/api/maps-key")
def get_maps_key():
    return {"apiKey": os.environ.get("GOOGLE_PLACES_API_KEY")}

@app.post("/prompt/")
def process_prompt(data: dict = Body(...), current_user_id: int = Depends(get_current_user)):
    from services.gemini_handler import handle_prompt
    prompt = data.get("prompt")
    try:
        handle_prompt(prompt, current_user_id)
        return {"status": "ok"}
    except RuntimeError as e:
        return {"status": "error", "detail": str(e)}
    except Exception as e:
        print("Error in process_prompt:", e)
        return {"status": "error", "detail": "Unknown error"}


@app.get("/route/")
def get_route(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from services.route_builder import build_route
    from services.collect_places import collect_places
    try:
        waypoints = collect_places(user_id=current_user)
        result = build_route(current_user, waypoints)
    except Exception as e:
        print("Error in get_route:", e)
        return {"status": "error", "detail": e}
    return result