import os
import traceback
import requests
from fastapi import FastAPI, Body, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from fastapi import Request
from db import Base, engine, SessionLocal
from models import SavedRoute, User
from schemas import *
from typing import Optional
from fastapi import Header
from core.request_context import current_client_ip
from services.auth_utils import TokenDecodeError, decode_access_token
from services.db_errors import get_duplicate_user_registration_detail
from services.schema_fixes import ensure_users_username_is_non_unique
from services.user_profile_stubs import ensure_user_profile_stubs
from routers.crm.partners import router as crm_partners_router
from routers.crm.places import router as crm_places_router
from routers.crm.partner_places import router as crm_partner_places_router
from routers.crm.route_rules import router as crm_route_rules_router
from routers.crm.events import router as crm_events_router
from routers.crm.settlements import router as crm_settlements_router
from routers.partner_runtime import router as partner_runtime_router
from routers.partner_events import router as partner_events_router

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
        payload = decode_access_token(token)
        subject: str = payload.get("sub")

        if not subject:
            raise HTTPException(status_code=401, detail="Invalid token")

        if subject.startswith("{'") and subject.endswith("'}"):
            subject = subject[2:-2]
        elif subject.startswith("'") and subject.endswith("'"):
            subject = subject[1:-1]

        user = db.query(User).filter(User.email == subject).first()

        if not user and "@" not in subject:
            user = db.query(User).filter(User.username == subject).first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        if ensure_user_profile_stubs(user):
            db.commit()
            db.refresh(user)

        return user

    except TokenDecodeError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)

def get_current_user_optional(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None

    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_access_token(token)
        subject = payload.get("sub")

        if not subject:
            return None

        if subject.startswith("{'") and subject.endswith("'}"):
            subject = subject[2:-2]
        elif subject.startswith("'") and subject.endswith("'"):
            subject = subject[1:-1]

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == subject).first()
            if not user and "@" not in subject:
                user = db.query(User).filter(User.username == subject).first()
            return user.id if user else None
        finally:
            db.close()

    except Exception:
        return None

Base.metadata.create_all(bind=engine)
ensure_users_username_is_non_unique(engine)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def get_cors_origins() -> list[str]:
    raw_origins = os.getenv(
        "BACKEND_CORS_ORIGINS",
        "https://trip.liberty-music.lol,http://localhost:8080,http://localhost:5173",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


def get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    return request.client.host if request.client else None


def serialize_saved_route(route: SavedRoute):
    return {
        "id": route.id,
        "title": route.title,
        "route_queries": route.route_queries or [],
        "messages": route.messages or [],
        "metadata": route.metadata_json or {},
        "created_at": route.created_at,
    }


def get_yandex_maps_key() -> str:
    key = os.environ.get("YANDEX_MAPS_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="Yandex Maps key not set")
    return key

@app.on_event("startup")
def on_startup():
    from seed_partners import seed
    try:
        seed()
    except Exception as e:
        print(f"⚠️  Partner seed skipped or failed: {e}")


@app.middleware("http")
async def ip_filter(request: Request, call_next):
    client_ip = get_client_ip(request)
    current_client_ip.set(client_ip)
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crm_partners_router)
app.include_router(crm_places_router)
app.include_router(crm_partner_places_router)
app.include_router(crm_route_rules_router)
app.include_router(crm_events_router)
app.include_router(crm_settlements_router)
app.include_router(partner_runtime_router)
app.include_router(partner_events_router)



@app.put("/users/me")
def update_my_profile(
    updated_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
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
            "preferred_types": [
                preferred.place_type
                for preferred in sorted(
                    user.preferred_place_types,
                    key=lambda item: item.place_type,
                )
            ],

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


@app.get("/users/me/routes", response_model=list[SavedRouteOut])
def get_my_saved_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        routes = (
            db.query(SavedRoute)
            .filter(SavedRoute.user_id == current_user.id)
            .order_by(SavedRoute.created_at.desc(), SavedRoute.id.desc())
            .all()
        )
        return [serialize_saved_route(route) for route in routes]
    except Exception as e:
        raise_500(e)


@app.post("/users/me/routes", response_model=SavedRouteOut, status_code=201)
def save_my_route(
    payload: SavedRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        normalized_queries = [query.strip() for query in payload.routeQueries if query.strip()]
        if len(normalized_queries) < 2:
            raise HTTPException(
                status_code=422,
                detail="At least two route points are required to save a route",
            )

        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="Route title is required")

        saved_route = SavedRoute(
            user_id=current_user.id,
            title=title,
            route_queries=normalized_queries,
            messages=[
                {
                    "id": message.id,
                    "text": message.text,
                    "isUser": message.isUser,
                    "timestamp": message.timestamp.isoformat(),
                    "isSent": message.isSent,
                }
                for message in payload.messages
            ],
            metadata_json=payload.metadata or {},
        )
        db.add(saved_route)
        db.commit()
        db.refresh(saved_route)
        return serialize_saved_route(saved_route)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise_500(e)

@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        from services.user_login import login_user
        from services.auth_utils import create_access_token

        db_user = login_user(db, user)
        if not db_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = create_access_token({"sub": db_user.email})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": db_user.username,
            "email": db_user.email,
        }

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

        token = create_access_token({"sub": new_user.email})
        return {"status": "registered", "token": token, "user_id": new_user.id}

    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as e:
        db.rollback()
        detail = get_duplicate_user_registration_detail(e)
        if detail:
            raise HTTPException(status_code=409, detail=detail)
        raise_500(e)
    except Exception as e:
        db.rollback()
        raise_500(e)

@app.get("/")
def root():
    return {"message": "Hello, FastAPI backend is working!"}


@app.get("/api/maps/script")
def get_maps_script(
    lang: str = Query(default="ru_RU", max_length=32),
    load: str = Query(default="package.full", max_length=64),
):
    try:
        upstream = requests.get(
            "https://api-maps.yandex.ru/2.1/",
            params={
                "apikey": get_yandex_maps_key(),
                "lang": lang,
                "load": load,
            },
            timeout=15,
        )
        upstream.raise_for_status()
    except HTTPException:
        raise
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Failed to load Yandex Maps script") from exc

    response = Response(content=upstream.content, media_type="application/javascript")
    content_type = upstream.headers.get("content-type")
    if content_type:
        response.headers["content-type"] = content_type
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response


@app.post("/prompt/")
def process_prompt(
    data: dict = Body(...),
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    try:
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(400, "'prompt' is required")
        return {"status": "stub", "message": "затычка", "mode": "guest" if user_id is None else "user"}

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)


@app.get("/route/")
def get_route(
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    try:
        return {"status": "stub", "message": "затычка", "mode": "guest" if user_id is None else "user"}

    except HTTPException:
        raise
    except Exception as e:
        raise_500(e)
