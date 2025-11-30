import os
from fastapi import FastAPI, Body, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
import jwt as pyjwt
from fastapi import Request
from db import Base, engine, SessionLocal
from models import User
from schemas import *
from fastapi.responses import JSONResponse


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def raise_500(e: Exception):
    print("Internal error:", e)
    raise HTTPException(status_code=500, detail="Internal server error")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        from services.auth_utils import SECRET_KEY

        payload = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username: str = payload.get("sub")

        if not username:
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

    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise_500(e)


Base.metadata.create_all(bind=engine)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


ALLOWED_IPS = {
    "43.245.224.126",
    "195.246.230.182",
    "37.194.188.227"
}

@app.middleware("http")
async def ip_filter(request: Request, call_next):
    client_ip = request.client.host

    if client_ip not in ALLOWED_IPS:
        return JSONResponse(
            status_code=403,
            content={"detail": "Forbidden: IP not allowed"}
        )

    return await call_next(request)

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
    try:
        from services.user_login import login_user
        from services.auth_utils import create_access_token

        db_user = login_user(db, user)
        if not db_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_access_token({"sub": str(db_user)})
        return {"access_token": token, "token_type": "bearer"}

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)


@app.post("/register")
def register(user: UserRegistration, db: Session = Depends(get_db)):
    try:
        from services.user_resgister import register_user
        from services.auth_utils import create_access_token

        new_user = register_user(db, user)
        if not new_user:
            raise HTTPException(status_code=400, detail="User registration failed")

        token = create_access_token({"sub": new_user.username})
        return {"status": "registered", "token": token, "user_id": new_user.id}

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)

@app.get("/")
def root():
    return {"message": "Hello, FastAPI backend is working!"}


@app.get("/api/maps-key")
def get_maps_key():
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="Google Maps key not set")
    return {"apiKey": key}


@app.post("/prompt/")
def process_prompt(
    data: dict = Body(...),
    current_user_id: int = Depends(get_current_user)
):
    try:
        from services.gemini_handler import handle_prompt
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(status_code=400, detail="'prompt' is required")

        handle_prompt(prompt, current_user_id)
        return {"status": "ok"}

    except HTTPException:
        raise
    except RuntimeError as e: 
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise_500(e)


@app.get("/route/")
def get_route(
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        from services.route_builder import build_route
        from services.collect_places import collect_places

        waypoints = collect_places(user_id=current_user)
        result = build_route(current_user, waypoints)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)