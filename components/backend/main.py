from fastapi import FastAPI, Body
from services.route_builder import build_route
from services.gemini_handler import handle_prompt

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello, FastAPI backend is working!"}


@app.post("/prompt/")
def process_prompt(prompt: str = Body(...), user_id: str = Body(...)):
    updated_user = handle_prompt(prompt, user_id)
    return {"status": "ok", "user": updated_user}


@app.get("/route/")
def get_route():
    result = build_route()
    return result
