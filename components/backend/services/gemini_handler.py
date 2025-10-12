import os
import json
import google.generativeai as genai
from requests import Session
import requests
from models import  User
from .user_updater import update_user_data
from .parse_user_prompt import send_context, send_user_prompt
from dotenv import load_dotenv
from db import SessionLocal


load_dotenv()
API_KEY_GEMENI = os.getenv("GOOGLE_GEMINI_API_KEY")
API_KEY_PLACES = os.getenv("GOOGLE_PLACES_API_KEY")
if not API_KEY_PLACES:
    raise ValueError("Missing GOOGLE_MAPS_API_KEY")

genai.configure(api_key=API_KEY_GEMENI)

system_prompt: str = """
You are a travel planner AI.

1) If the user query is not in English, translate it into English.
2) Parse the translated query and extract the following parameters exactly as a JSON object.
3) Use these keys and data types exactly as specified.
4) If you have hotel name find latitude and longitude yourself
5) If any other value is missing or unclear, set it to null.
6) Do not output anything besides the JSON.
7) Use these exact keys and structure:

{
  user{
      "preferences": {
        "max_walking_distance_meters": int | null,
        "preferred_types": [string] | null,
        "budget_level": int (1 to 4) | null,
        "rating_threshold": float (1.0 to 5.0) | null,
        "likes_breakfast_outside": bool | null,
        "transport_mode": "WALK" | "DRIVE" | "BICYCLE" | "TRANSIT" | "TWO_WHEELER" | null
      },
      "starting_points": {
        "name": string | null,
        "location": {
          "latitude": float | null,
          "longitude": float | null
        }
      },
      "availability": {
        "start_time": int (e.g. 900 for 9:00) | null,
        "end_time": int | null
      }
    }
}
User query:
"""

def geocode_place(place_name: str):
    response = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": place_name, "key": API_KEY_PLACES}
    )

    data = response.json()
    if data["status"] != "OK":
        return None, None

    location = data["results"][0]["geometry"]["location"]
    return location["lat"], location["lng"]


def handle_prompt(user_input: str, user_id: str) -> None:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise ValueError("User not found")

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            chat = model.start_chat()
            send_context(chat=chat, system_prompt=system_prompt)
            processed_message = send_user_prompt(chat=chat, user_input=user_input)
            start = processed_message["user"]["starting_points"]
            if start and start["name"] != None:
                lat, lng = geocode_place(start["name"])
                start["location"]["latitude"] = lat
                start["location"]["longitude"] = lng
        except Exception:
            raise RuntimeError("Processing error on the AI side")

        update_user_data(db, user, processed_message)

    except Exception as e:
        db.rollback()
        print("Can't update user data", e)
    finally:
        db.close()