from geoalchemy2 import WKTElement
from sqlalchemy.orm import Session
from schemas import Location, PlaceCreate
from models import Place


def get(db: Session, place_id: str):
    return db.query(PlaceCreate).get(place_id)


def create_or_update(db: Session, data: PlaceCreate):
    try:
        place = db.query(Place).filter(Place.place_id == data.placeId).first()


        if not place:
            place = Place(
                place_id=data.placeId,
                name=data.name,
                formatted_address=data.formatted_address,
                types=data.types,
                rating=data.rating,
                user_ratings_total=data.user_ratings_total,
                price_level=data.price_level,
                google_maps_uri=data.google_maps_uri,
                website_uri=data.website_uri,
                photo_refs=data.photo_refs,
                opening_hours=data.opening_hours,
                location=WKTElement(f"POINT({data.location.longitude} {data.location.latitude})", srid=4326)
            )
            db.add(place)

        else:
            place.name = data.name
            place.formatted_address = data.formattedAddress
            place.types = data.types
            place.rating = data.rating
            place.user_ratings_total = data.userRatingsTotal
            place.price_level = data.priceLevel
            place.google_maps_uri = data.googleMapsUri
            place.website_uri = data.websiteUri
            place.photo_refs = data.photoRefs
            place.opening_hours = data.openingHours
            place.location = f"POINT({data.location.longitude} {data.location.latitude})"

        db.commit()
        db.refresh(place)
    except Exception as e:
        print("Error while creating new place:", e)
        raise e
    return place