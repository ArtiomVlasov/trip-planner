from geoalchemy2.shape import from_shape
from shapely.geometry import Point

from models import Availability, StartingPoint, User

DEFAULT_STARTING_POINT = {
    "name": "Случайная точка в Сочи",
    "location": {
        "latitude": 43.585525,
        "longitude": 39.723062,
    },
    "city": "Sochi",
    "country": "Russia",
}

DEFAULT_AVAILABILITY = {
    "start_time": 900,
    "end_time": 1800,
}


def ensure_user_profile_stubs(user: User) -> bool:
    changed = False

    if not user.starting_point:
        user.starting_point = StartingPoint(
            user_id=user.id,
            name=DEFAULT_STARTING_POINT["name"],
            location=from_shape(
                Point(
                    DEFAULT_STARTING_POINT["location"]["longitude"],
                    DEFAULT_STARTING_POINT["location"]["latitude"],
                ),
                srid=4326,
            ),
            city=DEFAULT_STARTING_POINT["city"],
            country=DEFAULT_STARTING_POINT["country"],
        )
        changed = True
    else:
        if not user.starting_point.name:
            user.starting_point.name = DEFAULT_STARTING_POINT["name"]
            changed = True
        if not user.starting_point.location:
            user.starting_point.location = from_shape(
                Point(
                    DEFAULT_STARTING_POINT["location"]["longitude"],
                    DEFAULT_STARTING_POINT["location"]["latitude"],
                ),
                srid=4326,
            )
            changed = True
        if not user.starting_point.city:
            user.starting_point.city = DEFAULT_STARTING_POINT["city"]
            changed = True
        if not user.starting_point.country:
            user.starting_point.country = DEFAULT_STARTING_POINT["country"]
            changed = True

    if not user.availability:
        user.availability = Availability(
            user_id=user.id,
            start_time=DEFAULT_AVAILABILITY["start_time"],
            end_time=DEFAULT_AVAILABILITY["end_time"],
        )
        changed = True
    else:
        if user.availability.start_time is None:
            user.availability.start_time = DEFAULT_AVAILABILITY["start_time"]
            changed = True
        if user.availability.end_time is None:
            user.availability.end_time = DEFAULT_AVAILABILITY["end_time"]
            changed = True

    return changed
