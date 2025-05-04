import json
from typing import Any
import requests
from itinerary_algorithms.score_info.score_places_snippet import calculate_scores
import os

API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
assert API_KEY, "GOOGLE_PLACES_API_KEY env var is not set"

def build_route(places_database: dict[str, Any], user_dataset: dict[str, Any], transport_mode: str, field_mask: list[str]) -> list[dict[str, Any]]:
    ranked_places = calculate_scores(places_database, user_dataset)

    start_point = user_dataset["startingPoint"]["location"]
    end_point = user_dataset["startingPoint"]["location"]  

    intermediate_points = [
        {"location": {"latLng": {"latitude": place["place"]["location"]["latitude"], 
                                 "longitude": place["place"]["location"]["longitude"]}}}
        for place in ranked_places[:1]
    ]

    field_mask_str = ",".join(field_mask)
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": field_mask_str,
    }

    request_body = {
        "origin": {
            "location": {"latLng": {"latitude": start_point["latitude"], "longitude": start_point["longitude"]}}
        },
        "destination": {
            "location": {"latLng": {"latitude": end_point["latitude"], "longitude": end_point["longitude"]}}
        },
        "intermediates": intermediate_points,
        "travelMode": transport_mode,
    }

    URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

    response = requests.post(URL, headers=headers, json=request_body)

    response.raise_for_status()
    response_data = response.json()
    return response_data


def main():
    PLACES_FILE = "../../data_base/data.json"
    USER_FILE = "../../data_base/user_dataset.json"
    OUTPUT_FILE = "../../data_base/route_output.json"

    with open(PLACES_FILE, "r", encoding="utf-8") as f:
        places_data = json.load(f)

    with open(USER_FILE, "r", encoding="utf-8") as f:
        user_data = json.load(f)["user"]

    field_mask = [
        "routes.duration",
        "routes.distanceMeters",
        "routes.legs.steps"
    ]

    transport_mode = "WALK"
    response_data = build_route(places_database=places_data, user_dataset=user_data, transport_mode=transport_mode, field_mask=field_mask)
    route_steps = []
    for route in response_data.get("routes", []):
        for leg in route.get("legs", []):
            route_steps.extend(leg.get("steps", []))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(route_steps, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    main()
