import os
import json
import google.generativeai as genai
from .user_updater import update_user_dataset
from .parse_user_prompt import send_context, send_user_promt
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
genai.configure(api_key=API_KEY)

system_prompt = """
{
    "description": "You are a travel planner. Parse user queries and populate the following structure. If data is missing, leave the field as 'null'. Output format:",
    "structure": {
        "user": {
            "lastConversationId": "last conv id | null",
            "preferences": {
                "maxWalkingDistanceMeters": int | null,
                "preferredTypes": list[str] | null,
                "budgetLevel": int | null,
                "ratingThreshold": float | null,
                "likesBreakfastOutside": bool | null,
                "transportMode": str | null
            },
            "startingPoint": {
                "name": str | null,
                "location": {
                    "latitude": float | null,
                    "longitude": float | null
                }
            },
            "availability": {
                "startTime": str | null,
                "endTime": str | null
            }
        }
    }
}
"""

def handle_prompt(user_input: str, user_id: str) -> dict:
    path = "/Users/andrewf1amex/Programming/trip-planner/components/backend/research/data_base/user_dataset.json"

    with open(path, "r", encoding="utf-8") as f:
        user_data = json.load(f)

    if user_data["user"]["id"] != user_id:
        raise ValueError("User ID mismatch. Registration flow not implemented here.")

    model = genai.GenerativeModel("gemini-1.5-pro")
    chat = model.start_chat()

    send_context(chat=chat, system_prompt=system_prompt)

    processed_user_message = send_user_promt(chat=chat, user_input=user_input)
    updated_user_dataset = update_user_dataset(original=user_data, processed_user_message=processed_user_message)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(updated_user_dataset, f, indent=2, ensure_ascii=False)

    return updated_user_dataset