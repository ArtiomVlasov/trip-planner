from __future__ import annotations

import re
from typing import Any, Sequence

import requests
from geoalchemy2.shape import to_shape
from sqlalchemy.orm import Session

from models import Place
from services.route_generation import build_place_query, normalize_query
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


def get_place_coordinates(place: Place) -> tuple[float, float] | None:
    if place.location is None:
        return None

    geometry = to_shape(place.location)
    return float(geometry.y), float(geometry.x)


def find_matching_place(query: str, candidate_places: Sequence[Place]) -> Place | None:
    normalized_query = normalize_query(query)
    if not normalized_query:
        return None

    exact_match: Place | None = None
    partial_match: Place | None = None

    for place in candidate_places:
        candidate_values = [
            build_place_query(place),
            str(getattr(place, "name", "") or ""),
            str(getattr(place, "formatted_address", "") or ""),
        ]

        for candidate_value in candidate_values:
            normalized_candidate = normalize_query(candidate_value)
            if not normalized_candidate:
                continue

            if normalized_candidate == normalized_query:
                return place

            if (
                partial_match is None
                and (
                    normalized_query in normalized_candidate
                    or normalized_candidate in normalized_query
                )
            ):
                partial_match = place

            if exact_match is None and normalized_candidate.startswith(normalized_query):
                exact_match = place

    return exact_match or partial_match


def resolve_route_point(query: str, candidate_places: Sequence[Place]) -> dict[str, Any] | None:
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

    matched_place = find_matching_place(normalized_query, candidate_places)
    if matched_place is not None:
        coordinates = get_place_coordinates(matched_place)
        if coordinates is not None:
            latitude, longitude = coordinates
            return {
                "query": normalized_query,
                "address": build_place_query(matched_place) or normalized_query,
                "coordinates": {
                    "latitude": latitude,
                    "longitude": longitude,
                },
                "source": "database",
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
    normalized_queries = [str(query).strip() for query in (route_queries or []) if str(query).strip()]
    candidate_places = db.query(Place).all()

    route_points = [
        point
        for point in (
            resolve_route_point(query, candidate_places)
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
