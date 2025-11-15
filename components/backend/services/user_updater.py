from requests import Session
from shapely import Point
from geoalchemy2.shape import from_shape
from models import Preferences, StartingPoint, User
from schemas import Availability


def update_user_data(db: Session, user: User, processed_message: dict) -> None:

    if not user.preferences:
        user.preferences = Preferences(user_id=user.id)

    prefs_fields = [
        "max_walking_distance_meters",
        "budget_level",
        "rating_threshold",
        "likes_breakfast_outside",
        "transport_mode",
    ]

    for field in prefs_fields:
        if field in processed_message["user"].get("preferences", {}):
            value = processed_message["user"]["preferences"][field]
            if value is not None:
                setattr(user.preferences, field, value)

    if "starting_points" in processed_message["user"]:
        sp = processed_message["user"]["starting_points"]

        if not user.starting_point:
            user.starting_point = StartingPoint(user_id=user.id)

        if "name" in sp and sp["name"] is not None:
            user.starting_point.name = sp["name"]

        if "location" in sp:
            lat = sp["location"].get("latitude")
            lon = sp["location"].get("longitude")

            if lat is not None and lon is not None:
                location_new = from_shape(Point(lat, lon), srid=4326)
                user.starting_point.location = location_new

    if "availability" in processed_message["user"]:
        av = processed_message["user"]["availability"]

        if not user.availability:
            user.availability = Availability(user_id=user.id)

        if av.get("start_time") is not None:
            user.availability.start_time = av["start_time"]
        if av.get("end_time") is not None:
            user.availability.end_time = av["end_time"]

    db.commit()