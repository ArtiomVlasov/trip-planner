import math
import json
from typing import Any

EARTH_RADIUS = 6371000 


WEIGHTS = {
    "distance": 0.1,
    "rating": 0.15,
    "user_rating": 0.05,
    "price": 0.05,
    "opening_status": 0.25,
    "type_match": 0.4,
}

#Calculate the distance between two points on a sphere in meters.
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * EARTH_RADIUS * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_scores(places: dict[str, Any], user: dict[str, Any]) -> list[dict[str, Any]]:
    max_distance = user["preferences"]["maxWalkingDistanceMeters"] #TODO: figure out how to properly use
    preferred_types = set(user["preferences"]["preferredTypes"])
    user_location = user["startingPoint"]["location"]
    
    max_user_rating_count = max(place.get("userRatingCount", 0) for place in places)
    
    results = []
    for place in places:
        distance = haversine(
            user_location["latitude"], user_location["longitude"],
            place["location"]["latitude"], place["location"]["longitude"]
        )
        distance_score = max(0, 1 - distance / max_distance)

        rating_score = place.get("rating", 0) / 5.0

        user_rating_score = (place.get("userRatingCount", 0) / max_user_rating_count) if max_user_rating_count > 0 else 0

        price_score = 1 if place.get("priceLevel", -1) == user["preferences"]["budgetLevel"] else 0

        opening_status_score = 1 if place.get("regularOpeningHours", {}).get("openNow", False) else 0

        type_score = 1 if preferred_types.intersection(place.get("types", [])) else 0

        score = (
            WEIGHTS["distance"] * distance_score +
            WEIGHTS["rating"] * rating_score +
            WEIGHTS["user_rating"] * user_rating_score +
            WEIGHTS["price"] * price_score +
            WEIGHTS["opening_status"] * opening_status_score +
            WEIGHTS["type_match"] * type_score
        )

        results.append({
            "place": place,
            "score": score,
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)

def main():
    PLACES_FILE = "../../data-sources/google-places/data.json"
    USER_FILE = "user_dataset.json"

    with open(PLACES_FILE, "r", encoding="utf-8") as f:
        places_data = json.load(f)

    with open(USER_FILE, "r", encoding="utf-8") as f:
        user_data = json.load(f)["user"]

    ranked_places = calculate_scores(places_data, user_data)

    k = 5
    print("Top 5:")
    for idx, entry in enumerate(ranked_places[:k], 1):
        place = entry["place"]
        print(f"{idx}. {place['displayName']['text']} - Score: {entry['score']:.2f}")
        print(f"   Address: {place['formattedAddress']}")
        print(f"   Rating: {place.get('rating', 'N/A')} | Distance: ~{haversine(user_data['startingPoint']['location']['latitude'], user_data['startingPoint']['location']['longitude'], place['location']['latitude'], place['location']['longitude']):.0f} м\n")

if __name__ == "__main__":
    main()
