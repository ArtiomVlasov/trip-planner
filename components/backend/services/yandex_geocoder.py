from __future__ import annotations

import logging
import os
from typing import Any

import requests
from fastapi import HTTPException

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
GEOCODING_REVERSE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
SOCHI_CENTER = {"latitude": 43.5855, "longitude": 39.7231}
SOCHI_RADIUS_METERS = 60000.0
SOCHI_MARKERS = (
    "сочи",
    "sochi",
    "адлер",
    "adler",
    "красная поляна",
    "krasnaya polyana",
    "сириус",
    "sirius",
    "хоста",
    "hosta",
    "мацеста",
    "matzesta",
    "лазаревское",
    "lazarevskoye",
)
GREATER_SOCHI_LAT_RANGE = (43.35, 44.15)
GREATER_SOCHI_LNG_RANGE = (39.15, 40.45)
logger = logging.getLogger(__name__)


def get_google_places_key() -> str:
    key = str(os.getenv("GOOGLE_API_PLACES", "") or "").strip()
    if key:
        return key

    raise HTTPException(status_code=500, detail="Google Places API key not set")


def with_sochi_context(query: str) -> str:
    normalized = " ".join(query.split()).strip()
    lower_cased = normalized.lower()

    if not normalized:
        return normalized

    if any(marker in lower_cased for marker in SOCHI_MARKERS):
        return normalized

    return f"{normalized}, Сочи"


def _extract_component(components: list[dict[str, Any]], wanted_type: str) -> str | None:
    for component in components:
        if wanted_type in component.get("types", []) and component.get("longText"):
            return str(component["longText"])
    return None


def _normalize_place(place: dict[str, Any]) -> dict[str, Any] | None:
    location = place.get("location") or {}

    try:
        lat = float(location["latitude"])
        lng = float(location["longitude"])
    except (KeyError, TypeError, ValueError):
        return None

    address_components = place.get("addressComponents") or []
    address = (
        str(place.get("formattedAddress") or "").strip()
        or str((place.get("displayName") or {}).get("text") or "").strip()
    )

    return {
        "address": address,
        "lat": lat,
        "lng": lng,
        "city": _extract_component(address_components, "locality")
        or _extract_component(address_components, "postal_town")
        or _extract_component(address_components, "administrative_area_level_2")
        or _extract_component(address_components, "administrative_area_level_1"),
        "country": _extract_component(address_components, "country"),
    }


def _is_in_greater_sochi_bbox(lat: float, lng: float) -> bool:
    return (
        GREATER_SOCHI_LAT_RANGE[0] <= lat <= GREATER_SOCHI_LAT_RANGE[1]
        and GREATER_SOCHI_LNG_RANGE[0] <= lng <= GREATER_SOCHI_LNG_RANGE[1]
    )


def _looks_like_greater_sochi_suggestion(suggestion: dict[str, Any]) -> bool:
    address = str(suggestion.get("address") or "").lower()
    city = str(suggestion.get("city") or "").lower()

    if any(marker in address or marker in city for marker in SOCHI_MARKERS):
        return True

    try:
        lat = float(suggestion["lat"])
        lng = float(suggestion["lng"])
    except (KeyError, TypeError, ValueError):
        return False

    return _is_in_greater_sochi_bbox(lat, lng)


def _request_places_text_search(query: str, *, results: int = 5, language_code: str = "ru") -> dict[str, Any]:
    response = requests.post(
        PLACES_TEXT_SEARCH_URL,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": get_google_places_key(),
            "X-Goog-FieldMask": ",".join(
                [
                    "places.displayName",
                    "places.formattedAddress",
                    "places.location",
                    "places.addressComponents",
                    "places.googleMapsUri",
                    "places.id",
                ]
            ),
        },
        json={
            "textQuery": query,
            "languageCode": language_code,
            "regionCode": "RU",
            "pageSize": max(1, min(results, 10)),
            "locationBias": {
                "circle": {
                    "center": SOCHI_CENTER,
                    "radius": SOCHI_RADIUS_METERS,
                }
            },
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _request_reverse_geocoder(latitude: float, longitude: float, *, language: str = "ru") -> dict[str, Any]:
    response = requests.get(
        GEOCODING_REVERSE_URL,
        params={
            "latlng": f"{latitude},{longitude}",
            "language": language,
            "key": get_google_places_key(),
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _extract_suggestions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []

    for place in payload.get("places", []):
        normalized = _normalize_place(place)
        if normalized is not None:
            suggestions.append(normalized)

    return suggestions


def geocode_address_suggestions(
    query: str,
    *,
    results: int = 5,
    prefer_sochi_context: bool = False,
) -> list[dict[str, Any]]:
    normalized = " ".join(query.split()).strip()
    if not normalized:
        return []

    attempts: list[str] = []
    if prefer_sochi_context:
        attempts.append(with_sochi_context(normalized))
    attempts.append(normalized)

    seen: set[str] = set()

    for attempt in attempts:
        if not attempt or attempt.lower() in seen:
            continue

        seen.add(attempt.lower())
        suggestions = _extract_suggestions(_request_places_text_search(attempt, results=results))
        if prefer_sochi_context:
            suggestions = [
                suggestion
                for suggestion in suggestions
                if _looks_like_greater_sochi_suggestion(suggestion)
            ]
        logger.warning(
            "Google Places suggestions for '%s' (attempt '%s'): %s",
            query,
            attempt,
            suggestions,
        )
        if suggestions:
            return suggestions[:results]

    return []


def geocode_single_address(
    query: str,
    *,
    prefer_sochi_context: bool = False,
) -> dict[str, Any] | None:
    suggestions = geocode_address_suggestions(
        query,
        results=5 if prefer_sochi_context else 1,
        prefer_sochi_context=prefer_sochi_context,
    )
    return suggestions[0] if suggestions else None


def reverse_geocode(latitude: float, longitude: float) -> dict[str, Any] | None:
    payload = _request_reverse_geocoder(latitude, longitude)
    results = payload.get("results", [])

    for item in results:
        geometry = item.get("geometry") or {}
        location = geometry.get("location") or {}
        try:
            lat = float(location["lat"])
            lng = float(location["lng"])
        except (KeyError, TypeError, ValueError):
            continue

        address_components = item.get("address_components") or []
        return {
            "address": str(item.get("formatted_address") or "").strip(),
            "lat": lat,
            "lng": lng,
            "city": _extract_component(address_components, "locality")
            or _extract_component(address_components, "postal_town")
            or _extract_component(address_components, "administrative_area_level_2")
            or _extract_component(address_components, "administrative_area_level_1"),
            "country": _extract_component(address_components, "country"),
        }

    return None
