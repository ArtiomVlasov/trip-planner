from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import SavedRoute


def serialize_saved_route(route: SavedRoute) -> dict[str, Any]:
    return {
        "id": route.id,
        "title": route.title,
        "route_queries": route.route_queries or [],
        "messages": route.messages or [],
        "metadata": route.metadata_json or {},
        "created_at": route.created_at,
    }


def get_saved_route_for_user(db: Session, user_id: int, route_id: int) -> SavedRoute:
    route = (
        db.query(SavedRoute)
        .filter(SavedRoute.user_id == user_id, SavedRoute.id == route_id)
        .first()
    )
    if route is None:
        raise HTTPException(status_code=404, detail="Saved route not found")

    return route
