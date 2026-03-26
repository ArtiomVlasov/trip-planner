from sqlalchemy.orm import Session
from ..models import SearchQueryPlace


def link(db: Session, query_id: int, place_id: str):
    try:
        link = SearchQueryPlace(query_id=query_id, place_id=place_id)
        db.add(link)
        db.commit()
        return link
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Failed to link query {query_id} with place {place_id}: {e}")