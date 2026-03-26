# repositories/search_queries_repo.py

from datetime import datetime
from sqlalchemy.orm import Session
from ..models import SearchQuery
import hashlib, json
from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError


def get_by_hash(db: Session, query_text: str, raw_params: dict):
    payload = {
        "query": query_text,
        "params": raw_params
    }
    h = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()
    
    return db.query(SearchQuery).filter_by(hash=h).first()


def create(db: Session, user_id: int, query_text: str, raw_params: dict):
    created_at = datetime.utcnow().isoformat()

    payload = {
        "query": query_text,
        "params": raw_params,
        "created_at": created_at
    }

    h = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode("utf-8")
    ).hexdigest()

    try:
        query = SearchQuery(
            user_id=user_id,
            query_text=query_text,
            raw_params=raw_params,
            hash=h
        )
        db.add(query)
        db.commit()
        db.refresh(query)
        return query

    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Failed to create SearchQuery: {e}")