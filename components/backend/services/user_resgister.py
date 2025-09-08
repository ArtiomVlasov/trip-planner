from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from models import User, Preferences, StartingPoint, Availability
from schemas import UserRegistration
from passlib.hash import bcrypt


def register_user(db: Session, user_data: UserRegistration):
    user = User(
        username=user_data.username,
        email=user_data.email,
        password=bcrypt.hash(user_data.password)  
    )

    db.add(user)
    db.flush() 

    preferences = Preferences(
        user_id=user.id,
        max_walking_distance_meters=user_data.preferences.maxWalkingDistanceMeters,
        preferred_types=",".join(user_data.preferences.preferredTypes),
        budget_level=user_data.preferences.budgetLevel,
        rating_threshold=user_data.preferences.ratingThreshold,
        likes_breakfast_outside=user_data.preferences.likesBreakfastOutside,
        transport_mode=user_data.preferences.transportMode
    )
    db.add(preferences)

    starting_point = StartingPoint(
        user_id=user.id,
        name=user_data.startingPoint.name,
        location=from_shape(Point(
            user_data.startingPoint.location.longitude,
            user_data.startingPoint.location.latitude
        ), srid=4326)
    )
    db.add(starting_point)

    availability = Availability(
        user_id=user.id,
        start_time=user_data.availability.startTime,
        end_time=user_data.availability.endTime
    )
    db.add(availability)

    db.commit()
    db.refresh(user)
    return user