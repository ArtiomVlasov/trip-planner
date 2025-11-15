import os
import time
from dotenv import load_dotenv
import requests
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from schemas import PlaceCreate, Location
from repositories.search_queries_repo import get_by_hash as get_query_by_hash, create as create_query
from repositories.query_place_repo import link as link_place
from repositories.places_repo import create_or_update as save_place


API_URL = "https://places.googleapis.com/v1/places:searchText"

load_dotenv()
API_KEY_PLACES = os.getenv("GOOGLE_PLACES_API_KEY")

def search_places(db: Session, user_id: int, text_query: str, raw_params: dict, max_pages: int = 5):

    existing = get_query_by_hash(db=db, raw_params=raw_params)
    if existing:
        age_days = (datetime.now(timezone.utc) - existing.created_at).days
        if age_days < 14:
            return existing

    query_entry = create_query(db, user_id, text_query, raw_params)

    page_token = None
    page = 1

    while page <= max_pages:
        payload = {
            "textQuery": text_query,
            "pageSize": 20
        }
        if page_token:
            payload["pageToken"] = page_token

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY_PLACES,
            "X-Goog-FieldMask": (
                "places.id,"
                "places.displayName,"
                "places.types,"
                "places.priceLevel,"
                "places.formattedAddress,"
                "places.rating,"
                "places.googleMapsUri,"
                "places.websiteUri,"
                "places.photos,"
                "places.regularOpeningHours,"
                "places.userRatingCount,"
                "places.location"
            )
        }

        response = requests.post(API_URL, headers=headers, json=payload)

        if response.status_code != 200:
            print("Google API error:", response.text)
            break

        data = response.json()
        places = data.get("places", [])

        for p in places:
            try:
                place_data = PlaceCreate(
                    placeId=p.get("id"),
                    types=p.get("types", []),
                    price_level=p.get("priceLevel"),
                    rating=p.get("rating"),
                    user_ratings_total=p.get("userRatingCount"),
                    formatted_address=p.get("formattedAddress"),
                    google_maps_uri=p.get("googleMapsUri"),
                    website_uri=p.get("websiteUri"),
                    name=p.get("displayName").get("text"),
                    photo_refs=p.get("photos"),
                    opening_hours=p.get("regularOpeningHours"),
                    location=Location(
                        latitude=p.get("location", {}).get("latitude"),
                        longitude=p.get("location", {}).get("longitude"),
                    ),
                )

                saved_place = save_place(db, place_data)

                link_place(db, query_entry.id, saved_place.place_id)

            except Exception as e:
                print("Error processing place:", e)
                print("Raw Google place response:", json.dumps(p, ensure_ascii=False))
                continue

        page_token = data.get("nextPageToken")
        if not page_token:
            break

        page += 1

    return query_entry

