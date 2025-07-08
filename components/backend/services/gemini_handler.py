import os
import json
import google.generativeai as genai
from .user_updater import update_user_dataset
from .parse_user_prompt import send_context, send_user_prompt
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

system_prompt: str = """
{
    your role is:  You are a travel planner. Parse user queries and populate the following structure. If data is missing, leave the field as 'None'. Output format:",
    "user": {
        "preferences": {
            "maxWalkingDistanceMeters": int | None,
            "preferredTypes": list[str](match them with categories on google maps (e.g user write station where stop trains you need to write like in type on google maps train_station)) | None,
            "budgetLevel": int (1 to 4) | None,
            "ratingThreshold": float (1.0 to 5.0) | None,
            "likesBreakfastOutside": bool | None, 
            "transportMode": enum (WALK | DRIVE | BICYCLE | TRANSIT | TWO_WHEELER)| None
        },
        "startingPoint": {
            "name": str | None,
            "location": {
                "latitude": float | None,
                "longitude": float | None
            }
        },
        "availability": {
            "startTime": int (e.g 9:00 -> 900 12:00 -> 1200) | None,
            "endTime": int (same as start) | None
        }
    }
    and dont add line description
}
"""


def handle_prompt(user_input: str, user_id: str) -> dict:
    path = "./research/data_base/user_dataset.json"
    with open(path, "r", encoding="utf-8") as file:
        user_data = json.load(file)

    if user_data["user"]["id"] != user_id:
        raise ValueError("User ID mismatch. Registration flow not implemented here.")

    model = genai.GenerativeModel("gemini-1.5-pro")
    chat = model.start_chat()

    send_context(chat=chat, system_prompt=system_prompt)

    processed_user_message = send_user_prompt(chat=chat, user_input=user_input)
    updated_user_dataset = update_user_dataset(original=user_data, processed_user_message=processed_user_message)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(updated_user_dataset, file, indent=4, ensure_ascii=False)

    return updated_user_dataset