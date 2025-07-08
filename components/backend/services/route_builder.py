import os
import json
import requests
from datetime import date
from dotenv import load_dotenv

load_dotenv()

foursquare_api_key = os.getenv("FOURSQUARE_API_KEY")
routes_api_key = os.getenv("GOOGLE_PLACES_API_KEY")

fsq_url = "https://places-api.foursquare.com/places/search"
rts_url = "https://routes.googleapis.com/directions/v2:computeRoutes"


def build_route() -> dict:
    with open("./research/data_base/user_dataset.json", "r", encoding="utf-8") as f:
        user_data = json.load(f)
    
    start_lat = user_data["user"]["startingPoint"]["location"]["latitude"]
    start_lng = user_data["user"]["startingPoint"]["location"]["longitude"]
    max_distance = user_data["user"]["preferences"]["maxWalkingDistanceMeters"]
    budget_level = user_data["user"]["preferences"]["budgetLevel"]
    end_time = user_data["user"]["availability"]["endTime"]

    fsq_headers = {
        "authorization": f"Bearer {foursquare_api_key}",
        "accept": "application/json",
        "X-Places-Api-Version": "2025-06-17"
    }

    fsq_params = {
        "ll": f"{start_lat},{start_lng}",
        "radius": max_distance,
        "max_price": budget_level,
        "open_now": True,
        "close_at": f"{date.today().weekday() + 1}T{end_time // 100}{end_time % 100}",
        "sort": "rating",
        "limit": 10
    }

    fsq_response = requests.get(fsq_url, headers=fsq_headers, params=fsq_params)
    fsq_data = fsq_response.json()

    if not fsq_data.get("results"):
        raise ValueError("Foursquare did not return any results.")

    best_place = fsq_data["results"][0]
    dest_lat = best_place["latitude"]
    dest_lng = best_place["longitude"]

    rts_headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": routes_api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
    }

    rts_body = {
        "origin": {
            "location": {"latLng": {"latitude": start_lat, "longitude": start_lng}}
        },

        "destination": {
            "location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}
        },

        "travelMode": "DRIVE"
    }

    rts_response = requests.post(rts_url, headers=rts_headers, json=rts_body)
    rts_data = rts_response.json()

    with open("research/data_base/route_output.json", "w", encoding="utf-8") as f:
        json.dump(rts_data, f, indent=2)

    return rts_data
