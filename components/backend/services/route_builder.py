from datetime import date
import json
import os
import requests
from sqlalchemy.orm import Session
from models import User
from services.search_text import search_places
from db import SessionLocal
from geoalchemy2.shape import to_shape
import re
from core.request_context import current_client_ip

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

FSQ_URL = "https://places-api.foursquare.com/places/search"
RTS_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"

def build_photo_url(photo_refs: list | None) -> str | None:
    if not photo_refs:
        return None

    photo_name = photo_refs[0].get("name")
    if not photo_name:
        return None

    return (
        f"https://places.googleapis.com/v1/"
        f"{photo_name}/media"
        f"?key={GOOGLE_PLACES_API_KEY}&maxWidthPx=400"
    )


def build_route(user_id: str, waypoints: list[dict]) -> dict:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise ValueError("User not found")

        geom = to_shape(user.starting_point.location)
        start_lat = geom.y
        start_lng = geom.x

        origin = {
            "location": {
                "latLng": {
                    "latitude": start_lat,
                    "longitude": start_lng
                }
            }
        }

        # ✅ 1. Waypoints ТОЛЬКО для Google
        google_intermediates = [
            {
                "location": {
                    "latLng": {
                        "latitude": wp["lat"],
                        "longitude": wp["lng"]
                    }
                }
            }
            for wp in waypoints
        ]

        rts_headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": (
                "routes.polyline.encodedPolyline,"
                "routes.legs.startLocation,"
                "routes.legs.endLocation,"
                "routes.optimized_intermediate_waypoint_index"
            )
        }

        rts_body = {
            "origin": origin,
            "destination": origin,
            "intermediates": google_intermediates,  # ✅ ТОЛЬКО latLng
            "travelMode": "WALK",
            "optimizeWaypointOrder": False
        }

        rts_resp = requests.post(RTS_URL, headers=rts_headers, json=rts_body)
        if rts_resp.status_code != 200:
            raise RuntimeError("Google Routes API error", rts_resp.json())

        route = rts_resp.json()["routes"][0]

        # ✅ 2. Возвращаем фронту расширенные данные
        return {
            "routes": {
                "origin": {
                    "lat": start_lat,
                    "lng": start_lng
                },
                "destination": {
                    "lat": start_lat,
                    "lng": start_lng
                },
                "intermediates": waypoints,  # ← placeInfo сохраняется
                "polyline": route["polyline"]["encodedPolyline"],
                "optimizedOrder": route.get(
                    "optimizedIntermediateWaypointIndex", []
                )
            }
        }

    finally:
        db.close()

def build_route_guest(waypoints: list[dict]) -> dict:
    ip = current_client_ip.get()
    if not ip:
        raise ValueError("No client IP found")

    from services.guest_context import load_guest
    guest_data = load_guest(ip)

    start = guest_data["user"]["starting_points"]["location"]
    lat, lng = start["latitude"], start["longitude"]

    origin = {
        "location": {
            "latLng": {
                "latitude": lat,
                "longitude": lng
            }
        }
    }

    google_intermediates = [
        {
            "location": {
                "latLng": {
                    "latitude": wp["lat"],
                    "longitude": wp["lng"]
                }
            }
        }
        for wp in waypoints
    ]

    rts_body = {
        "origin": origin,
        "destination": origin,
        "intermediates": google_intermediates,
        "travelMode": "WALK",
        "optimizeWaypointOrder": False
    }

    rts_headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "routes.polyline.encodedPolyline,"
            "routes.legs.startLocation,"
            "routes.legs.endLocation,"
            "routes.optimized_intermediate_waypoint_index"
        )
    }

    rts_resp = requests.post(RTS_URL, headers=rts_headers, json=rts_body)
    if rts_resp.status_code != 200:
        raise RuntimeError("Google Routes API error", rts_resp.json())

    route = rts_resp.json()["routes"][0]

    return {
        "routes": {
            "origin": {"lat": lat, "lng": lng},
            "destination": {"lat": lat, "lng": lng},
            "intermediates": waypoints,
            "polyline": route["polyline"]["encodedPolyline"],
            "optimizedOrder": route.get(
                "optimizedIntermediateWaypointIndex", []
            )
        }
    }
