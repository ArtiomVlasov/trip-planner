import os

import requests


GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


class GeocodingError(Exception):
    pass


def geocode_address(
    address: str,
    city: str | None = None,
    country: str | None = None,
) -> dict:
    if not GOOGLE_PLACES_API_KEY:
        raise GeocodingError("Google geocoding is not configured")

    query = ", ".join(part for part in [address.strip(), city, country] if part)
    response = requests.get(
        GEOCODE_URL,
        params={"address": query, "key": GOOGLE_PLACES_API_KEY},
        timeout=10,
    )

    if response.status_code != 200:
        raise GeocodingError("Geocoding request failed")

    data = response.json()
    status = data.get("status")
    if status != "OK" or not data.get("results"):
        raise GeocodingError("Could not determine coordinates from this address")

    best_match = data["results"][0]
    location = best_match["geometry"]["location"]
    return {
        "formatted_address": best_match.get("formatted_address") or address.strip(),
        "lat": location["lat"],
        "lng": location["lng"],
    }
