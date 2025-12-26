from services.search_text import search_places
from geoalchemy2.shape import to_shape

def collect_places_guest(db, parsed_prompt: dict):
    start = parsed_prompt["user"]["starting_points"]

    city = start.get("citi")
    country = start.get("country")
    location_text = f"{city}, {country}"

    preferred_subtypes = parsed_prompt["user"]["prefered_type"]["preferred_subtypes"] or []

    waypoints = []

    for subtype in preferred_subtypes:
        q = search_places(
            db=db,
            user_id=None,  # важно!
            text_query=f"Find {subtype} in {location_text}",
            raw_params=None,
            max_pages=1
        )

        link = q.places[0] if q.places else None
        if not link:
            continue

        place = link.place
        gp = to_shape(place.location)

        waypoints.append({
            "location": {
                "latLng": {
                    "latitude": gp.y,
                    "longitude": gp.x
                }
            }
        })

    return waypoints