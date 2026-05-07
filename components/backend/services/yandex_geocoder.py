from __future__ import annotations

import logging
from typing import Any

import requests

from services.yandex_maps_key import get_yandex_maps_key

GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"
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
    "мацест",
    "лазаревское",
    "lazarevskoye",
)
GREATER_SOCHI_LAT_RANGE = (43.35, 44.15)
GREATER_SOCHI_LNG_RANGE = (39.15, 40.45)
logger = logging.getLogger(__name__)


def with_sochi_context(query: str) -> str:
    normalized = " ".join(query.split()).strip()
    lower_cased = normalized.lower()

    if not normalized:
        return normalized

    if any(marker in lower_cased for marker in SOCHI_MARKERS):
        return normalized

    return f"{normalized}, Сочи"


def _request_geocoder(query: str, *, results: int = 5, lang: str = "ru_RU") -> dict[str, Any]:
    response = requests.get(
        GEOCODER_URL,
        params={
            "apikey": get_yandex_maps_key(),
            "geocode": query,
            "format": "json",
            "results": max(1, results),
            "lang": lang,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def _get_components(meta: dict[str, Any]) -> list[dict[str, str]]:
    address = meta.get("Address", {})
    components = address.get("Components")
    return components if isinstance(components, list) else []


def _get_component_name(components: list[dict[str, str]], kind: str) -> str | None:
    for component in components:
        if component.get("kind") == kind and component.get("name"):
            return str(component["name"])
    return None


def _extract_suggestions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    feature_members = (
        payload.get("response", {})
        .get("GeoObjectCollection", {})
        .get("featureMember", [])
    )
    suggestions: list[dict[str, Any]] = []

    for feature_member in feature_members:
        geo_object = feature_member.get("GeoObject", {})
        meta = geo_object.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        point = geo_object.get("Point", {})
        raw_position = str(point.get("pos", "")).strip()
        parts = raw_position.split()

        if len(parts) != 2:
            continue

        try:
            lng = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue

        components = _get_components(meta)
        address = (
            meta.get("Address", {}).get("formatted")
            or meta.get("text")
            or raw_position
        )

        suggestions.append(
            {
                "address": str(address),
                "lat": lat,
                "lng": lng,
                "city": _get_component_name(components, "locality")
                or _get_component_name(components, "province")
                or _get_component_name(components, "area"),
                "country": _get_component_name(components, "country"),
            }
        )

    return suggestions


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
        suggestions = _extract_suggestions(_request_geocoder(attempt, results=results))
        if prefer_sochi_context:
            suggestions = [
                suggestion
                for suggestion in suggestions
                if _looks_like_greater_sochi_suggestion(suggestion)
            ]
        logger.info(
            "Yandex geocoder suggestions for '%s' (attempt '%s'): %s",
            query,
            attempt,
            [
                {
                    "address": suggestion.get("address"),
                    "city": suggestion.get("city"),
                    "lat": suggestion.get("lat"),
                    "lng": suggestion.get("lng"),
                }
                for suggestion in suggestions
            ],
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
        results=1,
        prefer_sochi_context=prefer_sochi_context,
    )
    return suggestions[0] if suggestions else None


def reverse_geocode(latitude: float, longitude: float) -> dict[str, Any] | None:
    suggestions = _extract_suggestions(
        _request_geocoder(f"{longitude},{latitude}", results=1),
    )
    return suggestions[0] if suggestions else None
