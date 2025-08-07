import os
from fastapi import FastAPI, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db import Base, engine, SessionLocal
from models import User, Route
from schemas import UserRegistration

Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
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

@app.post("/register")
def register(user: UserRegistration, db: Session = Depends(get_db)):
    from services.user_resgister import register_user
    new_user = register_user(db, user)
    return {"status": "registered", "user_id": new_user.id}

@app.get("/")
async def root():
    return {"message": "Hello, FastAPI backend is working!"}

@app.get("/api/maps-key")
def get_maps_key():
    return {"apiKey": os.environ.get("GOOGLE_PLACES_API_KEY")}

@app.post("/prompt/")
def process_prompt(prompt: str = Body(...), user_id: str = Body(...)):
    from services.gemini_handler import handle_prompt
    updated_user = handle_prompt(prompt, user_id)
    return {"status": "ok", "user": updated_user}

@app.get("/route/")
def get_route():
    from services.route_builder import build_route
    result = build_route()
    return result