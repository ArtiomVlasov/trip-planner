import os
import google.generativeai as genai
from requests import Session
import requests
from ..models import User
from .user_updater import update_user_data
from .parse_user_prompt import send_context, send_user_prompt
from dotenv import load_dotenv
from ..db import SessionLocal


load_dotenv()
API_KEY_GEMENI = os.getenv("GOOGLE_GEMINI_API_KEY")
API_KEY_PLACES = os.getenv("GOOGLE_PLACES_API_KEY")
if not API_KEY_PLACES:
    raise ValueError("Missing GOOGLE_MAPS_API_KEY")

genai.configure(api_key=API_KEY_GEMENI)

system_prompt: str = """
You are an AI assistant for a travel planning system.

Your task is to extract structured preferences from the user's text query.

IMPORTANT RULES:
1. You MUST select main types ONLY from the list MAIN_TYPES below.
2. You MUST select subtypes ONLY from the list SUBTYPES below.
3. Do NOT invent new categories. If nothing fits — leave arrays empty.
4. If only the main type is described and there is no specification for the subtype, then leave the subtype array empty
5. You may still fill the old fields (max distance, rating threshold, transport mode, etc.)
6. Output ONLY JSON. No explanations, no comments.
7. If the user's query is not in English — translate it internally before processing.
8. If a value cannot be inferred — return null.
9. Если не указан город и указан место старта найди в каком городе данное место находится

MAIN_TYPES (allowed values):
[
  "Museums & Culture",
  "Entertainment & Leisure",
  "Nature & Outdoors",
  "Nightlife & Bars",
  "Restaurants – Fine dining",
  "Restaurants – Casual dining",
  "Coffee & Sweets",
  "Food on the Go",
  "Hotels & Accommodation",
  "Wellness & Relaxation",
  "Sports & Active leisure",
  "Shopping – Essentials",
  "Shopping – Lifestyle & Malls",
  "Events & Venues"
]

SUBTYPES (allowed values):
[
  "art_gallery", "art_studio", "cultural_landmark", "historical_place",
  "monument", "museum", "auditorium", "amphitheatre", "sculpture",
  "performing_arts_theater", "opera_house", "philharmonic_hall",

  "amusement_center", "amusement_park", "aquarium", "bowling_alley",
  "casino", "comedy_club", "concert_hall", "ferris_wheel",
  "movie_theater", "roller_coaster", "video_arcade", "water_park",

  "national_park", "state_park", "hiking_area", "garden",
  "botanical_garden", "wildlife_park", "wildlife_refuge",
  "observation_deck", "plaza", "picnic_ground",

  "bar", "wine_bar", "pub", "night_club", "karaoke",

  "fine_dining_restaurant", "french_restaurant", "italian_restaurant",
  "asian_restaurant", "steak_house", "seafood_restaurant",
  "mexican_restaurant", "korean_restaurant", "japanese_restaurant",
  "greek_restaurant", "thai_restaurant", "american_restaurant",
  "pizza_restaurant", "indian_restaurant",

  "coffee_shop", "cafe", "bakery", "dessert_shop", "ice_cream_shop",
  "donut_shop", "tea_house", "brunch_restaurant",

  "fast_food_restaurant", "sandwich_shop", "juice_shop",
  "meal_takeaway", "meal_delivery", "food_court",

  "hotel", "hostel", "guest_house", "inn", "resort_hotel",
  "bed_and_breakfast", "motel", "campground",

  "spa", "massage", "sauna", "skin_care_clinic",

  "gym", "fitness_center", "sports_complex", "stadium",
  "ice_skating_rink", "swimming_pool", "ski_resort", "golf_course",

  "grocery_store", "supermarket", "liquor_store",
  "convenience_store", "shopping_mall", "clothing_store",
  "electronics_store", "home_goods_store", "sporting_goods_store",
  "bookstore", "pet_store", "department_store",

  "event_venue", "convention_center", "community_center",
  "banquet_hall", "wedding_venue", "visitor_center"
]

OUTPUT FORMAT (strict):
{
  "user": {
    "preferences": {
      "max_walking_distance_meters": int | null,
      "budget_level":  int (1 to 4) | null,
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
      "citi": string | null
      "contry" string | null
    },
    "availability": {
      "start_time": int | null,
      "end_time": int | null
    },
    "prefered_type":{
      "preferred_main_types": [string] | null,
      "preferred_subtypes": [string] | null,
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