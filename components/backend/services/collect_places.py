from sqlalchemy.orm import Session
from services.picking_types.config import DEFAULT_CONFIG
from services.picking_types.distribution import pick_subtypes_for_user
from services.search_text import search_places
from db import SessionLocal
from models import MainType, Place, SearchQueryPlace, Subtype, User, UserMainTypeWeight, UserSubtypeWeight
from geoalchemy2.shape import to_shape
from shapely import wkb
import math
import traceback
from services.route_builder import build_photo_url

PARTNER_BASE_MULTIPLIER = 1.2
PARTNER_TYPE_MATCH_BONUS = 0.15


def partner_match_bonus(place: Place, subtype_name: str) -> float:
    if place.source != "partner":
        return 0.0

    normalized_subtype = subtype_name.lower()
    type_tokens = [t.lower().replace("_", " ") for t in (place.types or [])]
    haystack = " ".join(type_tokens + [place.name or "", place.formatted_address or ""]).lower()
    return PARTNER_TYPE_MATCH_BONUS if normalized_subtype in haystack else 0.0

def is_open_now(place, cur_time_minutes):
    oh = place.opening_hours
    if not oh or "periods" not in oh:
        return True 

    for period in oh["periods"]:
        open_info = period.get("open")
        close_info = period.get("close")

        if not open_info:
            continue

        if open_info["hour"] == 0 and open_info["minute"] == 0 and not close_info:
            return True

        if open_info["day"] != 0:
            continue

        open_min = open_info["hour"] * 60 + open_info["minute"]

        if close_info:
            close_min = close_info["hour"] * 60 + close_info["minute"]
        else:
            close_min = 1440

        if open_min <= cur_time_minutes <= close_min:
            return True

    return False


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000 
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(d_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def get_normalised_weights(top_subtypes : list, user:User, db:Session) -> dict:
    subtype_weights = {}
    for _, subtype_id in top_subtypes:
        w = (
            db.query(UserSubtypeWeight)
            .filter_by(user_id=user.id, subtype_id=subtype_id)
            .first()
        )
        subtype_weights[subtype_id] = w.weight if w else 0.0
    total_weight = sum(subtype_weights.values())
    if total_weight > 0:
        for k in subtype_weights:
            subtype_weights[k] /= total_weight
    else:
        uniform = 1.0 / len(subtype_weights)
        for k in subtype_weights:
            subtype_weights[k] = uniform
    return subtype_weights

def collect_places(user_id: str):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        city = "Sochi"
        country = "Russia"
        location_text = f"{city}, {country}"
        try:
            from services.partner_api import fetch_partner_recommendation_boosts
            api_score_boosts = fetch_partner_recommendation_boosts(user.id, city, country)
        except Exception:
            api_score_boosts = {}

        hotel_query_text = f"Find hotel in {location_text}"

        hotel_query = search_places(
            db=db,
            user_id=user.id,
            text_query=hotel_query_text,
            raw_params = None,
            max_pages=1
        )


        hotel_place_link = (
            db.query(SearchQueryPlace)
            .filter(SearchQueryPlace.query_id == hotel_query.id)
            .first()
        )
        if not hotel_place_link:
            raise ValueError("Hotel search returned no places")

        hotel_place = hotel_place_link.place
        geom = to_shape(hotel_place.location)
        hotel_lat = geom.y
        hotel_lng = geom.x

        user.starting_point.location = f"POINT({hotel_lng} {hotel_lat})"
        db.commit()
 
        top_subtypes = pick_subtypes_for_user(
            session=db,
            user_id=user.id,
            cfg=DEFAULT_CONFIG,
            seed=None 
        )

        
        waypoints = []
        all_places_by_subtype = {}
        
        subtype_weights = get_normalised_weights(top_subtypes=top_subtypes, user=user, db=db)
        
        for w in top_subtypes:
            subtype = db.query(Subtype).filter(Subtype.id == w[1]).first()
            if not subtype:
                continue

            text_query = f"Find {subtype.name} in {location_text}"

            q = search_places(
                db=db,
                user_id=user.id,
                text_query=text_query,
                raw_params = None,
                max_pages=1
            )

            places_links = db.query(SearchQueryPlace).filter(SearchQueryPlace.query_id == q.id).all()
            places_list = []
    
            for link in places_links:
                p = link.place
                if not p:
                    continue
                
                # базовый скор
                # user_sub_weight = subtype_weights[subtype.id]
                weight = subtype_weights[subtype.id]
    
                rating_score = (p.rating or 0) / 5
                reviews_score = min((p.user_ratings_total or 0) / 500, 1.0)
                price_score = 1.0
                if user.preferences and user.preferences.budget_level and p.price_level:
                    price_score = max(0, 1 - abs(int(p.price_level or 2) - user.preferences.budget_level)/4)
    
                base_score = 0.4 * rating_score + 0.2 * reviews_score + 0.2 * price_score + 0.2 * weight

                if p.source == "partner":
                    base_score = base_score * PARTNER_BASE_MULTIPLIER + partner_match_bonus(p, subtype.name)

                base_score += api_score_boosts.get(str(p.place_id), 0.0)
    
                places_list.append({
                    "place": p,
                    "subtype_id": subtype.id,
                    "main_type_id": subtype.main_type_id,
                    "base_score": base_score
                })

            partner_candidates = db.query(Place).filter(Place.source == "partner").all()
            for p in partner_candidates:
                if not p.location:
                    continue

                type_match_bonus = partner_match_bonus(p, subtype.name)
                if type_match_bonus == 0.0:
                    continue

                rating_score = (p.rating or 0) / 5
                reviews_score = min((p.user_ratings_total or 0) / 500, 1.0)
                base_score = (0.55 + 0.25 * rating_score + 0.20 * reviews_score) * PARTNER_BASE_MULTIPLIER + type_match_bonus
                base_score += api_score_boosts.get(str(p.place_id), 0.0)

                places_list.append({
                    "place": p,
                    "subtype_id": subtype.id,
                    "main_type_id": subtype.main_type_id,
                    "base_score": base_score
                })

            if places_list:
                all_places_by_subtype[subtype.id] = places_list

        cur_time = user.availability.start_time
        end_time = user.availability.end_time
        waypoints = []
        last_location = None

        while cur_time < end_time:
            best_score = -1
            best_place = None
            best_subtype = None

            for subtype_id, places_list in all_places_by_subtype.items():
                for item in places_list:
                    p = item["place"]
                    base_score = item["base_score"]

                    # получаем preferred_time_range для main_type
                    main_type = db.query(MainType).filter(MainType.id == item["main_type_id"]).first()
                    if main_type.preferred_time_range:
                        start_min = main_type.preferred_time_range.lower
                        end_min = main_type.preferred_time_range.upper
                    else:
                        start_min, end_min = 0, 1440

                    # time score: если текущий cur_time в preferred_time_range = 1, иначе штраф
                    if start_min <= cur_time <= end_min:
                        time_score = 1.0
                    else:
                        time_score = 0.6 
                    if not is_open_now(p, cur_time):
                        continue
                    # distance score
                    distance_score = 1.0
                    if last_location and p.location:
                        gp = wkb.loads(bytes(p.location.data))
                        dist = haversine_distance(last_location.y, last_location.x, gp.y, gp.x)
                        if user.preferences and user.preferences.max_walking_distance_meters:
                            limit = user.preferences.max_walking_distance_meters
                            if dist > limit:
                                distance_score = max(0.1, 1 - (dist - limit)/limit)  # штраф за превышение

                    total_score = base_score * time_score * distance_score

                    if total_score > best_score:
                        best_score = total_score
                        best_place = p
                        best_subtype = subtype_id
                        best_main_type_id = item["main_type_id"]

            if not best_place:
                break  

            gp = wkb.loads(bytes(best_place.location.data))
            waypoints.append({
                "lat": gp.y,
                "lng": gp.x,
                "name": best_place.name,
                "formatted_address": best_place.formatted_address,
                "rating": best_place.rating,
                "price_level": best_place.price_level,
                "photo_url": build_photo_url(best_place.photo_refs),
            })

            main_type = db.query(MainType).get(best_main_type_id)
            visit_duration = main_type.default_visit_duration_minutes if main_type else 60
            cur_time += visit_duration
            last_location = gp
            all_places_by_subtype[best_subtype] = [
                x for x in all_places_by_subtype[best_subtype] if x["place"].place_id != best_place.place_id
            ]

        if not waypoints:
            raise ValueError("No intermediate points found")
        return waypoints
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        print("Error in collect place:", e)
        raise
