from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from models import User, Preferences, StartingPoint, Availability
from schemas import UserRegistration
import os
import base64
import hashlib

SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1}
SALT_LEN = 16
KEY_LEN = 64

def hash_password(password: str) -> str:
    salt = os.urandom(SALT_LEN)
    dk = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=SCRYPT_PARAMS["n"],
        r=SCRYPT_PARAMS["r"],
        p=SCRYPT_PARAMS["p"],
        dklen=KEY_LEN
    )
    salt_b64 = base64.b64encode(salt).decode()
    hash_b64 = base64.b64encode(dk).decode()
    return f"scrypt${SCRYPT_PARAMS['n']}${SCRYPT_PARAMS['r']}${SCRYPT_PARAMS['p']}${salt_b64}${hash_b64}"



def register_user(db: Session, user_data: UserRegistration):
    user = User(
        username=user_data.username,
        email=user_data.email,
        password=hash_password(user_data.password)  
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