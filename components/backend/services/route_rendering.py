from __future__ import annotations

import logging
import re
from typing import Any, Sequence

import requests
from sqlalchemy.orm import Session

from services.route_generation import normalize_query
from services.yandex_geocoder import geocode_address_suggestions, reverse_geocode

COORDINATE_PATTERN = re.compile(
    r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$"
)
logger = logging.getLogger(__name__)


def parse_coordinate_query(query: str) -> tuple[float, float] | None:
    match = COORDINATE_PATTERN.match(query)
    if not match:
        return None

    latitude = float(match.group(1))
    longitude = float(match.group(2))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None

    return latitude, longitude


def _score_geocoder_suggestion(query: str, suggestion: dict[str, Any]) -> float:
    normalized_query = normalize_query(query)
    address = normalize_query(str(suggestion.get("address") or ""))
    city = normalize_query(str(suggestion.get("city") or ""))

    score = 0.0

    if normalized_query and normalized_query in address:
        score += 5.0
    if address and address in normalized_query:
        score += 2.0
    if city in ("сочи", "sochi"):
        score += 1.5
    if city in ("адлер", "adler", "сириус", "sirius", "хоста", "hosta", "мацеста", "matzesta"):
        score += 1.3

    return score


def _pick_best_geocoder_suggestion(query: str, suggestions: Sequence[dict[str, Any]]) -> dict[str, Any] | None:
    if not suggestions:
        return None

    ranked_suggestions = sorted(
        suggestions,
        key=lambda suggestion: _score_geocoder_suggestion(query, suggestion),
        reverse=True,
    )
    best_suggestion = ranked_suggestions[0]
    logger.warning(
        "Route rendering chose geocoder suggestion for '%s': %s",
        query,
        {
            "address": best_suggestion.get("address"),
            "city": best_suggestion.get("city"),
            "lat": best_suggestion.get("lat"),
            "lng": best_suggestion.get("lng"),
        },
    )
    return best_suggestion

def resolve_route_point(query: str) -> dict[str, Any] | None:
    normalized_query = query.strip()
    if not normalized_query:
        return None

    coordinate_match = parse_coordinate_query(normalized_query)
    if coordinate_match:
        latitude, longitude = coordinate_match
        try:
            reverse_geocoded = reverse_geocode(latitude, longitude)
        except requests.RequestException:
            reverse_geocoded = None
        return {
            "query": normalized_query,
            "address": (reverse_geocoded or {}).get("address") or normalized_query,
            "coordinates": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "source": "coordinates",
        }

    try:
        suggestions = geocode_address_suggestions(
            normalized_query,
            results=5,
            prefer_sochi_context=True,
        )
    except requests.RequestException:
        suggestions = []

    geocoded = _pick_best_geocoder_suggestion(normalized_query, suggestions)
    if geocoded is None:
        logger.warning("Route rendering could not resolve route point in Greater Sochi: %s", normalized_query)
        return None

    return {
        "query": normalized_query,
        "address": str(geocoded.get("address") or normalized_query),
        "coordinates": {
            "latitude": float(geocoded["lat"]),
            "longitude": float(geocoded["lng"]),
        },
        "source": "google_places",
    }


def _build_straight_segment(
    start: dict[str, float],
    end: dict[str, float],
) -> dict[str, Any]:
    return {
        "coordinates": [start, end],
        "source": "straight",
    }


def build_segment_route(
    start: dict[str, float],
    end: dict[str, float],
) -> dict[str, Any]:
    try:
        response = requests.get(
            "https://router.project-osrm.org/route/v1/driving/"
            f"{start['longitude']},{start['latitude']};"
            f"{end['longitude']},{end['latitude']}",
            params={
                "overview": "full",
                "geometries": "geojson",
            },
            timeout=5,
        )
        response.raise_for_status()
        geometry = (
            response.json()
            .get("routes", [{}])[0]
            .get("geometry", {})
            .get("coordinates", [])
        )
        coordinates = [
            {
                "latitude": float(lat),
                "longitude": float(lng),
            }
            for lng, lat in geometry
            if isinstance(lng, (float, int)) and isinstance(lat, (float, int))
        ]

        if len(coordinates) >= 2:
            return {
                "coordinates": coordinates,
                "source": "osrm",
            }
    except requests.RequestException:
        pass

    return _build_straight_segment(start, end)


def build_route_render_data(db: Session, route_queries: Sequence[str] | None) -> dict[str, Any]:
    del db

    normalized_queries = [str(query).strip() for query in (route_queries or []) if str(query).strip()]

    route_points = [
        point
        for point in (
            resolve_route_point(query)
            for query in normalized_queries
        )
        if point is not None
    ]

    route_segments = [
        build_segment_route(
            current_point["coordinates"],
            next_point["coordinates"],
        )
        for current_point, next_point in zip(route_points, route_points[1:])
    ]

    return {
        "routePoints": route_points,
        "routeSegments": route_segments,
    }
