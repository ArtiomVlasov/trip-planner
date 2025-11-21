from datetime import date
import os
import requests
from sqlalchemy.orm import Session
from models import User
from services.search_text import search_places
from db import SessionLocal
from geoalchemy2.shape import to_shape
import re

FOURSQUARE_API_KEY = os.getenv("FOURSQUARE_API_KEY")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

FSQ_URL = "https://places-api.foursquare.com/places/search"
RTS_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def build_route(user_id: str, waypoints: dict) -> dict:
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise ValueError("User not found")


        rts_headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": (
                "routes.polyline.encodedPolyline,"
                "routes.legs.startLocation,"
                "routes.legs.endLocation,"
                "routes.optimized_intermediate_waypoint_index")
        }
        geom = to_shape(user.starting_point.location)
        start_lat = geom.y
        start_lng = geom.x
        
        origin = {"location": {"latLng": {"latitude": start_lat, "longitude": start_lng}}}

        rts_body = {
            "origin": origin,
            "destination": origin,
            "intermediates": waypoints,
            "travelMode": "WALK",
            "optimizeWaypointOrder": "true"
        }

        rts_resp = requests.post(
            RTS_URL,
            headers=rts_headers,
            json=rts_body
        )
        if rts_resp.status_code != 200:
            raise RuntimeError("Google Routes API error", rts_resp.json())

        rts_data = rts_resp.json()
        route = rts_data["routes"][0]

        optimized_order = route.get("optimizedIntermediateWaypointIndex", [])

        points = {
            "routes":{
                "origin": {
                    "lat": route["legs"][0]["startLocation"]["latLng"]["latitude"],
                    "lng": route["legs"][0]["startLocation"]["latLng"]["longitude"]
                },
                "destination": {
                    "lat": route["legs"][-1]["endLocation"]["latLng"]["latitude"],
                    "lng": route["legs"][-1]["endLocation"]["latLng"]["longitude"]
                },
                "intermediates": [
                    {
                        "lat": waypoints[i]["location"]["latLng"]["latitude"],
                        "lng": waypoints[i]["location"]["latLng"]["longitude"],
                    }
                    for i in optimized_order
                ],
                "polyline": route["polyline"]["encodedPolyline"],
                "optimizedOrder": optimized_order
            }
        }

        return points

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()