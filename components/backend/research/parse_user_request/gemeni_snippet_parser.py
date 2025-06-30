from google import genai
from typing import Optional, Dict
import os

API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")
assert API_KEY, "GOOGLE_GEMINI_API_KEY env var is not set"

client = genai.Client(api_key=API_KEY)
chat = client.chats.create(model="gemini-2.5-flash")

system_prompt = """
{
    "description": "You are a travel planner. Parse user queries and populate the following structure. If data is missing, leave the field as 'null'. Output format:",
    "structure": {
        "user": {
            "lastConversationId: " last conv id | null
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
                    "latitude": float | null, #if you have town name and hotel name try to find latitude longitude by yourself
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

def main() -> None:
    chat.send_message(system_prompt)

    user_query_1 = "I want to visit museums and parks in London tomorrow morning."
    user_query_2 = "Add some good cafes near those museums. And also I don't have very much money. I prefer walking but not very long walkings and i stay at Leonardo Royal London St Paul's "

    # First query
    response_1 = chat.send_message(user_query_1)
    print("Response 1:")
    print(response_1)

    # Second query with continued context
    response_2 = chat.send_message(user_query_2)
    print("\nResponse 2:")
    print(response_2)

if __name__ == "__main__":
    main()
