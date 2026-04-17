from sqlalchemy.orm import Session
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from models import User, Preferences, StartingPoint, Availability
from schemas import UserRegistration
import os
import base64
import hashlib
from types import SimpleNamespace
from models import (
    MainType,
    Subtype,
    UserMainTypeWeight,
    UserSubtypeWeight
)

SCRYPT_PARAMS = {"n": 2**14, "r": 8, "p": 1}
SALT_LEN = 16
KEY_LEN = 64

DEFAULT_PREFERENCES = {
    "maxWalkingDistanceMeters": 1000,
    "budgetLevel": 3,
    "ratingThreshold": 4.0,
    "likesBreakfastOutside": False,
    "transportMode": "DRIVE",
}

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
    "startTime": 900,
    "endTime": 1800,
}


def assign_user_type_weights(db: Session, user_id: int, selected_main_type_names: list[str]):
    main_types = db.query(MainType).all()
    name_to_id = {t.name: t.id for t in main_types}

    selected_main_type_ids = {name_to_id[name] for name in selected_main_type_names if name in name_to_id}

    main_type_weights = compute_normalized_weights(main_types, selected_main_type_ids)

    for mt_id, weight in main_type_weights.items():
        db.add(UserMainTypeWeight(
            user_id=user_id,
            main_type_id=mt_id,
            weight=weight
        ))


    subtypes = db.query(Subtype).all()

    selected_subtype_ids = {
        st.id for st in subtypes if st.main_type_id in selected_main_type_ids
    }

    subtype_weights = compute_normalized_weights(subtypes, selected_subtype_ids)

    for st_id, weight in subtype_weights.items():
        db.add(UserSubtypeWeight(
            user_id=user_id,
            subtype_id=st_id,
            weight=weight
        ))

def compute_normalized_weights(items, selected_ids, boost_selected=5.0, boost_unselected=1.0):
    raw = {}
    for item in items:
        if item.id in selected_ids:
            raw[item.id] = boost_selected
        else:
            raw[item.id] = boost_unselected

    total = sum(raw.values())
    return {k: v / total for k, v in raw.items()}


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

    preferences_data = user_data.preferences or SimpleNamespace(**DEFAULT_PREFERENCES)
    starting_point_data = user_data.startingPoint or SimpleNamespace(
        name=DEFAULT_STARTING_POINT["name"],
        city=DEFAULT_STARTING_POINT["city"],
        country=DEFAULT_STARTING_POINT["country"],
        location=SimpleNamespace(**DEFAULT_STARTING_POINT["location"]),
    )
    availability_data = user_data.availability or SimpleNamespace(**DEFAULT_AVAILABILITY)

    preferences = Preferences(
        user_id=user.id,
        max_walking_distance_meters=preferences_data.maxWalkingDistanceMeters,
        budget_level=preferences_data.budgetLevel,
        rating_threshold=preferences_data.ratingThreshold,
        likes_breakfast_outside=preferences_data.likesBreakfastOutside,
        transport_mode=preferences_data.transportMode
    )
    db.add(preferences)
    starting_point = StartingPoint(
        user_id=user.id,
        name=starting_point_data.name,
        location=from_shape(Point(
            starting_point_data.location.longitude,
            starting_point_data.location.latitude
        ), srid=4326),
        city=starting_point_data.city,
        country=starting_point_data.country
    )
    db.add(starting_point)

    availability = Availability(
        user_id=user.id,
        start_time=availability_data.startTime,
        end_time=availability_data.endTime
    )
    db.add(availability)
    
    preferred_types = user_data.preferredTypes or []
    assign_user_type_weights(db, user.id, preferred_types)

    db.commit()
    db.refresh(user)

    if user_data.accountType == "partner" and user_data.partner:
        try:
            from services.partner_api import notify_partner_registration

            notify_partner_registration(
                user_id=user.id,
                city=starting_point_data.city,
                username=user.username,
                partner_data=user_data.partner,
            )
        except Exception:
            pass

    return user
