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
from typing import Optional
from fastapi import Header
from core.request_context import current_client_ip
import traceback


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
error1 = 2

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def raise_500(e: Exception):
    traceback.print_exc()
    raise HTTPException(status_code=500, detail="Internal server error")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
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

        user = db.query(User).filter(User.username == username).first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise_500(e)

def get_current_user_optional(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None

    try:
        from services.auth_utils import SECRET_KEY
        token = authorization.replace("Bearer ", "")
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")

        if username.startswith("{'") and username.endswith("'}"):
            username = username[2:-2]
        elif username.startswith("'") and username.endswith("'"):
            username = username[1:-1]

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.username == username).first()
            return user.id if user else None
        finally:
            db.close()

    except Exception:
        return None

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
    current_client_ip.set(client_ip)
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



@app.put("/users/me")
def update_my_profile(
    updated_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # updated_data ожидает формат:
        # { "user": { "preferences": {...}, "starting_points": {...}, "availability": {...} } }
        user_payload = updated_data.get("user")
        if not user_payload:
            raise HTTPException(status_code=400, detail="No user data provided")
        from services.user_updater import update_user_data
        update_user_data(db, current_user, updated_data)
        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)

@app.get("/users/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    try:
        user = current_user

        return {
            "username": user.username,
            "email": user.email,

            "preferences": {
                "max_walking_distance_meters": user.preferences.max_walking_distance_meters
                if user.preferences else None,
                "budget_level": user.preferences.budget_level
                if user.preferences else None,
                "rating_threshold": user.preferences.rating_threshold
                if user.preferences else None,
                "likes_breakfast_outside": user.preferences.likes_breakfast_outside
                if user.preferences else None,
                "transport_mode": user.preferences.transport_mode
                if user.preferences else None,
            } if user.preferences else None,

            "starting_point": {
                "name": user.starting_point.name,
                "city": user.starting_point.city,
                "country": user.starting_point.country,
            } if user.starting_point else None,

            "availability": {
                "start_time": user.availability.start_time,
                "end_time": user.availability.end_time,
            } if user.availability else None,
        }

    except Exception as e:
        raise_500(e)

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
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    try:
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(400, "'prompt' is required")

        if user_id is None:
            from services.gemini_handler_guest import handle_prompt_guest
            from services.guest_context import save_guest
            from core.request_context import current_client_ip

            parsed = handle_prompt_guest(prompt)
            ip = current_client_ip.get()

            if ip:
                save_guest(ip, parsed)

            return {"status": "ok", "mode": "guest"}

        from services.gemini_handler import handle_prompt
        handle_prompt(prompt, user_id)
        return {"status": "ok"}

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise_500(e)


@app.get("/route/")
def get_route(
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    try:
        from services.route_builder import build_route

        if user_id is None:
            from services.guest_context import load_guest
            from services.collect_places_guest import collect_places_guest
            from services.route_builder import build_route_guest
            from core.request_context import current_client_ip

            ip = current_client_ip.get()
            parsed = load_guest(ip) if ip else None

            if not parsed:
                raise HTTPException(
                    status_code=400,
                    detail="Guest prompt context not found"
                )

            db = SessionLocal()
            try:
                waypoints = collect_places_guest(db, parsed)
                print("\n\n\n\n")
                print(waypoints)
                print("\n\n\n\n")

                if (error1 != 2):
                    from services.POIInfoService import get_poi_card
                    get_poi_card(waypoints)

                if not waypoints:
                    raise HTTPException(status_code=400, detail="No valid points for guest route")
                return build_route_guest(waypoints)
            finally:
                db.close()

        from services.collect_places import collect_places
        waypoints = collect_places(user_id)
        return build_route(user_id, waypoints)

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)