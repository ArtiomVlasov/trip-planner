import json
from google import genai
from typing import Optional, Dict
import os

API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
assert API_KEY, "GOOGLE_GEMINI_API_KEY env var is not set"




system_prompt: str = """
{
    your role is:  You are a travel planner. Parse user queries and populate the following structure. If data is missing, leave the field as 'None'. Output format:",
    "user": {
        "preferences": {
            "maxWalkingDistanceMeters": int | None,
            "preferredTypes": list[str] | None,
            "budgetLevel": int | None,
            "ratingThreshold": float | None,
            "likesBreakfastOutside": bool | None,
            "transportMode": str | None
        },
        "startingPoint": {
            "name": str | None,
            "location": {
                "latitude": float | None,
                "longitude": float | None
            }
        },
        "availability": {
            "startTime": str | None,
            "endTime": str | None
        }
    }
    and dont add line description
}
"""

def send_user_promt(chat: genai.Client, user_input: str) -> str:
    response = chat.send_message(user_input).text.strip().splitlines()

    try:
        return json.loads("\n".join(response[1:-1]))
    except json.JSONDecodeError:
        print("Failed to parse response as JSON:")
        print(response.text)
        return None



def send_context(chat: genai.Client):
    chat.send_message(system_prompt)

# def main() -> None:
#     """
#     Main function to demonstrate the use of the Gemini API for parsing user queries.
#     """
#     # User queries
#     user_query_1: str = "I want to visit museums and parks in Paris tomorrow morning. Add some good cafes near those museums"
#     user_query_2: str = "."
    
#     print("Chat initialized...\n")

#     # First query
#     response_1: str = process_user_query(chat, user_query_1)
#     print("Response 1:")
#     print(response_1)

#     # Second query with continued context
#     response_2: str = process_user_query(chat, user_query_2)
#     print("\nResponse 2:")
#     print(response_2)