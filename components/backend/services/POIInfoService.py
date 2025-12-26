from repositories.places_repo import get as get_place_by_id
from db import SessionLocal

def get_poi_card(place_id: list[dict]) -> str | None:
    db: Session = SessionLocal()
    place =  get_place_by_id(db, "0")
    if not place_id:
        return None

    photo_name = place_id[0].get("name")
    if not photo_name:
        return None

    return (
        f"https://places.googleapis.com/v1/"
        f"{photo_name}/media"
    )