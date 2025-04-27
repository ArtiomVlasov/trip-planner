import json
import os
from typing import Any

import requests

API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
assert API_KEY, "GOOGLE_PLACES_API_KEY env var is not set"

YEREVAN_CENTER = (40.177585, 44.512534)
RADIUS = 500  # meters
URL = f"https://places.googleapis.com/v1/places:searchNearby"

DEFAULT_MIN_RATING = 4.0
DEFAULT_MAX_RESULT_COUNT = 10


def fetch_places(
    center: tuple[float, float],
    radius: float,
    field_mask: list[str],
    min_rating: float = DEFAULT_MIN_RATING,
    max_result_count: int = DEFAULT_MAX_RESULT_COUNT,
    included_types: list[str] | None = None,
    excluded_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    if included_types and excluded_types:
        msg = "Either `included_types` or `excluded_types` must be specified, not both"
        raise ValueError(msg)

    field_mask_str = ",".join(field_mask)
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": field_mask_str,
    }

    request_body = {
        "maxResultCount": max_result_count,
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": center[0],
                    "longitude": center[1],
                },
                "radius": radius
            }
        }
    }

    if included_types:
        request_body["includedTypes"] = included_types
    if excluded_types:
        request_body["excludeTypes"] = excluded_types

    resp = requests.post(URL, headers=headers, json=request_body)
    resp.raise_for_status()

    places = resp.json()['places']
    places = list(filter(lambda p: p["rating"] > min_rating, places))

    return places


def main():
    # TODO: Figure out the required mask
    field_mask = [
        "places.id",
        "places.displayName",
        "places.location",
        "places.rating",
        "places.formattedAddress",
    ]
    places = fetch_places(center=YEREVAN_CENTER, radius=RADIUS, field_mask=field_mask)

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(places, f, ensure_ascii=False, indent=4)


if __name__ == '__main__':
    main()
