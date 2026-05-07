from __future__ import annotations

import re
from typing import Any, Sequence

import requests
from sqlalchemy.orm import Session

from services.yandex_geocoder import geocode_single_address, reverse_geocode

COORDINATE_PATTERN = re.compile(
    r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$"
)


def parse_coordinate_query(query: str) -> tuple[float, float] | None:
    match = COORDINATE_PATTERN.match(query)
    if not match:
        return None

    latitude = float(match.group(1))
    longitude = float(match.group(2))
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None

    return latitude, longitude

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
        geocoded = geocode_single_address(normalized_query, prefer_sochi_context=True)
    except requests.RequestException:
        geocoded = None

    if geocoded is None:
        return None

    return {
        "query": normalized_query,
        "address": str(geocoded.get("address") or normalized_query),
        "coordinates": {
            "latitude": float(geocoded["lat"]),
            "longitude": float(geocoded["lng"]),
        },
        "source": "yandex_geocoder",
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
