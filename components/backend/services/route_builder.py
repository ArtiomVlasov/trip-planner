from datetime import date
import os
import traceback
import requests
from sqlalchemy.orm import Session
from db import SessionLocal
from models import User, Route, Preferences, StartingPoint, Availability
from geoalchemy2.shape import to_shape
import re

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

FSQ_URL = "https://places-api.foursquare.com/places/search"
RTS_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def parse_duration(duration: str) -> dict:
    if duration.endswith("s"):
        return int(duration.rstrip("s"))
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not match:
        return 0
    hours, minutes, seconds = [int(x) if x else 0 for x in match.groups()]
    return hours * 3600 + minutes * 60 + seconds

def build_route(user_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise ValueError("User not found")

        if not (user.starting_point and user.preferences and user.availability):
            raise ValueError("Incomplete user data")

        shape = to_shape(user.starting_point.location)
        start_lat = shape.x
        start_lng = shape.y
        max_distance = user.preferences.max_walking_distance_meters
        budget_level = user.preferences.budget_level
        end_time = user.availability.end_time
        

        # --- Foursquare request ---
        fsq_headers = {
            "authorization": f"Bearer {FOURSQUARE_API_KEY}",
            "accept": "application/json",
            "X-Places-Api-Version": "2025-06-17"
        }
        fsq_params = {
            "ll": f"{start_lat},{start_lng}",
            "radius": max_distance,
            "max_price": budget_level,
            "open_now": False,
            "close_at": f"{date.today().weekday() + 1}T{end_time // 100}{end_time % 100}",
            "sort": "rating",
            "limit": 10
        }
        fsq_response = requests.get(FSQ_URL, headers=fsq_headers, params=fsq_params)
        if fsq_response.status_code != 200:
            raise RuntimeError("Foursquare API error")
        fsq_data = fsq_response.json()
        if not fsq_data.get("results"):
            raise ValueError("Foursquare did not return any results")

        best_place = fsq_data["results"][0]
        dest_lat = best_place["latitude"]
        dest_lng = best_place["longitude"]

        # --- Google Routes request ---
        rts_headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
        }
        rts_body = {
            "origin": {"location": {"latLng": {"latitude": start_lat, "longitude": start_lng}}},
            "destination": {"location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}},
            "travelMode": "DRIVE"
        }
        rts_response = requests.post(RTS_URL, headers=rts_headers, json=rts_body)
        if rts_response.status_code != 200:
            raise RuntimeError("Google Routes API error")
        rts_data = rts_response.json()
        
        new_route = Route(
            user_id=user.id,
            distance_meters=rts_data["routes"][0]["distanceMeters"],
            duration_seconds=parse_duration(rts_data["routes"][0]["duration"]),
            geom=f"LINESTRING({start_lng} {start_lat}, {dest_lng} {dest_lat})"
        )
        db.add(new_route)
        db.commit()
        db.refresh(new_route)

        return rts_data

    except Exception as e:
        db.rollback()
        print("ERROR TYPE:", type(e).__name__)
        print("ERROR MSG:", e)
        print("TRACEBACK:")
        traceback.print_exc()
        return {"status": "error", "detail": str(e)}
    finally:
        db.close()