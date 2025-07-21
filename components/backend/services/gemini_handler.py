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
        "maxWalkingDistanceMeters": int | null,
        "preferredTypes": [string] | null,
        "budgetLevel": int (1 to 4) | null,
        "ratingThreshold": float (1.0 to 5.0) | null,
        "likesBreakfastOutside": bool | null,
        "transportMode": "WALK" | "DRIVE" | "BICYCLE" | "TRANSIT" | "TWO_WHEELER" | null
      },
      "startingPoint": {
        "name": string | null,
        "location": {
          "latitude": float | null,
          "longitude": float | null
        }
      },
      "availability": {
        "startTime": int (e.g. 900 for 9:00) | null,
        "endTime": int | null
      }
    }
}
User query:
"""


def handle_prompt(user_input: str, user_id: str) -> dict:
    path = "./research/data_base/user_dataset.json"
    with open(path, "r", encoding="utf-8") as file:
        user_data = json.load(file)

    if user_data["user"]["id"] != user_id:
        raise ValueError("User ID mismatch. Registration flow not implemented here.")

    model = genai.GenerativeModel("gemini-2.0-flash")
    chat = model.start_chat()

    send_context(chat=chat, system_prompt=system_prompt)
    processed_user_message = send_user_prompt(chat=chat, user_input=user_input)    
    updated_user_dataset = update_user_dataset(original=user_data, processed_user_message=processed_user_message)

    with open(path, "w", encoding="utf-8") as file:
        json.dump(updated_user_dataset, file, indent=4, ensure_ascii=False)

    return updated_user_dataset