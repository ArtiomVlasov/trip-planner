from models import SearchQueryPlace
from services.search_text import search_places
from geoalchemy2.shape import to_shape
from services.route_builder import build_photo_url

def collect_places_guest(db, parsed_prompt: dict):
    start = parsed_prompt["user"]["starting_points"]

    city = start.get("citi") or start.get("city")
    country = start.get("country")
    location_text = f"{city}, {country}"

    preferred_subtypes = parsed_prompt["user"].get("prefered_type", {}).get("preferred_subtypes") or []
    if not preferred_subtypes:
        print("No preferred subtypes found in prompt")
        
    hotel_query_text = f"Find hotel in {location_text}"
    
    hotel_query = search_places(
        db=db,
        user_id=None,
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
    
    parsed_prompt["user"]["starting_points"]["location"]["latitude"] = hotel_lat
    parsed_prompt["user"]["starting_points"]["location"]["longitude"] = hotel_lng
    
    waypoints = []

    for subtype in preferred_subtypes:
        print("Searching for subtype:", subtype, "in", location_text)
        q = search_places(
            db=db,
            user_id=None,
            text_query=f"Find {subtype} in {location_text}",
            raw_params=None,
            max_pages=1
        )

        places_links = db.query(SearchQueryPlace).filter(SearchQueryPlace.query_id == q.id).all()
        place = places_links[0].place if places_links[0].place else None
        if not place:
            continue
        

        gp = to_shape(place.location)

        waypoints.append({
            "lat": gp.y,
            "lng": gp.x,
            "name": place.name,
            "formatted_address": place.formatted_address,
            "rating": place.rating,
            "price_level": place.price_level,
            "photo_url": build_photo_url(place.photo_refs),
        })

    return waypoints