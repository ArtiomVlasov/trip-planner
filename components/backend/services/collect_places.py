from sqlalchemy.orm import Session
from services.picking_types.config import DEFAULT_CONFIG
from services.picking_types.distribution import pick_subtypes_for_user
from services.search_text import search_places
from db import SessionLocal
from models import MainType, SearchQueryPlace, Subtype, User, UserMainTypeWeight, UserSubtypeWeight
from geoalchemy2.shape import to_shape

def collect_places(user_id: str):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        city = user.starting_point.city
        country = user.starting_point.country
        location_text = f"{city}, {country}"

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

            link = (
                db.query(SearchQueryPlace)
                .filter(SearchQueryPlace.query_id == q.id)
                .first()
            )
            if not link:
                continue

            p = link.place
            gp = to_shape(p.location)
            waypoints.append({"location" : {"latLng": {"latitude": gp.y, "longitude": gp.x}}})

        if not waypoints:
            raise ValueError("No intermediate points found")
        return waypoints
    except Exception as e:
        db.rollback()
        print("Error in collect place:", e)
        raise e
