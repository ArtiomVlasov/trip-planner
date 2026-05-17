from sqlalchemy.orm import Session


def parse_price_level(value) -> int:
    return -1


def search_places(db: Session, user_id: int, text_query: str, raw_params: dict, max_pages: int):
    return None
