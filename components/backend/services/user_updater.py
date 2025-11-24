from requests import Session
from shapely import Point
from geoalchemy2.shape import from_shape
from ..models import MainType, Preferences, StartingPoint, Subtype, User, UserMainTypeWeight, UserSubtypeWeight
from ..schemas import Availability


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
            citi = sp["citi"]
            country = sp["country"]
            if lat is not None and lon is not None :
                location_new = from_shape(Point(lat, lon), srid=4326)
                user.starting_point.location = location_new
            if citi is not None and country is not None:
                user.starting_point.citi = citi
                user.starting_point.country = country

    if "availability" in processed_message["user"]:
        av = processed_message["user"]["availability"]

        if not user.availability:
            user.availability = Availability(user_id=user.id)

        if av.get("start_time") is not None:
            user.availability.start_time = av["start_time"]
        if av.get("end_time") is not None:
            user.availability.end_time = av["end_time"]
            
    prefs = processed_message["user"].get("prefered_type", {})
    selected_main = prefs.get("preferred_main_types") or []
    selected_sub = prefs.get("preferred_subtypes") or []

    selected_main_set = set(selected_main)
    selected_sub_set = set(selected_sub)

    ALPHA = 0.12
    BETA = 0.06
    DELTA = 0.20
    GAMMA = 0.97

    all_subtypes = db.query(Subtype).all()

    all_main_types = db.query(MainType).all()
    existing_main = {
        w.main_type_id: w for w in db.query(UserMainTypeWeight)
                                    .filter_by(user_id=user.id)
                                    .all()
    }

    subtypes_by_name = {st.name: st for st in all_subtypes}

    selected_sub_main_ids = set()

    for sub_name in selected_sub_set:
        st = subtypes_by_name.get(sub_name)
        if st:
            selected_sub_main_ids.add(st.main_type_id)


    for mt in all_main_types:
        w = existing_main[mt.id]

        if mt.name in selected_main_set:
            w.weight += ALPHA
        else:
            if mt.id in selected_sub_main_ids:
                w.weight += BETA
            else:
                w.weight *= GAMMA

    total = sum(w.weight for w in existing_main.values())
    for w in existing_main.values():
        w.weight /= total

    existing_sub = {
        w.subtype_id: w for w in db.query(UserSubtypeWeight)
                                   .filter_by(user_id=user.id)
                                   .all()
    }

    for st in all_subtypes:
        w = existing_sub[st.id]

        if st.name in selected_sub_set:
            w.weight += DELTA
        else:
            w.weight *= GAMMA

    total = sum(w.weight for w in existing_sub.values())
    for w in existing_sub.values():
        w.weight /= total

    db.commit()

    db.commit()