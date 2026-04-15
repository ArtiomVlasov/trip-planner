import json
from sqlalchemy.orm import Session
from shapely import Point
from geoalchemy2.shape import from_shape
from models import Availability, MainType, Preferences, StartingPoint, Subtype, User, UserMainTypeWeight, UserSubtypeWeight, UserTimeOverrides

def update_user_data(db: Session, user: User, processed_message: dict) -> None:
    try:
        if not isinstance(processed_message, dict):
            raise ValueError("processed_message must be a dict")

        user_payload = processed_message.get("user")
        if not isinstance(user_payload, dict):
            raise ValueError("processed_message.user is required")

        if not user.preferences:
            user.preferences = Preferences(user_id=user.id)

        prefs_fields = [
            "max_walking_distance_meters",
            "budget_level",
            "rating_threshold",
            "likes_breakfast_outside",
            "transport_mode",
        ]

        if "preferences" in user_payload and user_payload["preferences"] is not None:
            for field in prefs_fields:
                if field in user_payload.get("preferences", {}):
                    value = user_payload["preferences"][field]
                    if value is not None:
                        setattr(user.preferences, field, value)

        if "starting_points" in user_payload and user_payload["starting_points"] is not None:
            sp = user_payload["starting_points"]

            if not user.starting_point:
                user.starting_point = StartingPoint(user_id=user.id)

            if "name" in sp and sp["name"] is not None:
                user.starting_point.name = sp["name"]

            if "location" in sp:
                lat = sp["location"].get("latitude")
                lon = sp["location"].get("longitude")
                if lat is not None and lon is not None:
                    location_new = from_shape(Point(lon, lat), srid=4326)
                    user.starting_point.location = location_new
            
            city = sp.get("city")
            country = sp.get("country")
            if city is not None and country is not None:
                user.starting_point.city = city
                user.starting_point.country = country

        if "availability" in user_payload and user_payload["availability"] is not None:
            av = user_payload["availability"]

            if not user.availability:
                user.availability = Availability(user_id=user.id)

            if av.get("start_time") is not None:
                user.availability.start_time = av["start_time"]

            if av.get("end_time") is not None:
                user.availability.end_time = av["end_time"]

        prefs = user_payload.get("prefered_type", {})
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

        selected_sub_main_ids = {
            st.main_type_id for name, st in subtypes_by_name.items()
            if name in selected_sub_set
        }

        for mt in all_main_types:
            w = existing_main.get(mt.id)
            if not w:
                continue

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
            w = existing_sub.get(st.id)
            if not w:
                continue

            if st.name in selected_sub_set:
                w.weight += DELTA
            else:
                w.weight *= GAMMA

        total = sum(w.weight for w in existing_sub.values())
        for w in existing_sub.values():
            w.weight /= total
        if user_payload.get("preferences") is not None:
            overrides = user_payload["preferences"].get("preferred_time_overrides", [])
            if overrides:
                db.query(UserTimeOverrides).filter_by(user_id=user.id).delete()
                for ov in overrides:
                    db.add(UserTimeOverrides(
                        user_id=user.id,
                        main_type_name=ov["main_type"],
                        start_hour=ov["start_hour"],
                        end_hour=ov["end_hour"]
                    ))


        db.commit()

    except Exception as e:
        db.rollback()
        print(f"[update_user_data] ERROR for user {user.id}: {e}")
        raise  