from __future__ import annotations

import logging
import os
from typing import Any

import requests
from fastapi import HTTPException

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
GEOCODING_ADDRESS_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GEOCODING_REVERSE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
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


def _json_for_log(payload: Any) -> str:
    try:
        import json

        return json.dumps(payload, ensure_ascii=False)
    except Exception:
        return str(payload)


def _response_text_for_log(response: requests.Response) -> str:
    try:
        return response.text
    except Exception:
        return "<unavailable>"


def _extract_google_api_error(payload: dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        return ""

    if isinstance(payload.get("error"), dict):
        error = payload["error"]
        message = str(error.get("message") or "").strip()
        status = str(error.get("status") or "").strip()
        return " | ".join(fragment for fragment in [status, message] if fragment)

    status = str(payload.get("status") or "").strip()
    message = str(payload.get("error_message") or "").strip()
    return " | ".join(fragment for fragment in [status, message] if fragment)


def _looks_like_address_query(query: str) -> bool:
    normalized = " ".join(query.split()).strip().lower()
    if not normalized:
        return False

    street_markers = (
        "ул",
        "улица",
        "просп",
        "пр-т",
        "пер",
        "переулок",
        "наб",
        "набереж",
        "шоссе",
        "ш.",
        "район",
        "микрорайон",
        "мкр",
    )

    return any(marker in normalized for marker in street_markers) or any(char.isdigit() for char in normalized)


def _extract_component(components: list[dict[str, Any]], wanted_type: str) -> str | None:
    for component in components:
        if wanted_type not in component.get("types", []):
            continue

        for key in ("longText", "long_name", "shortText", "short_name"):
            if component.get(key):
                return str(component[key])
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
            "pageSize": max(1, min(results, 20)),
        },
        timeout=15,
    )
    if not response.ok:
        logger.error(
            "Google Places Text Search HTTP %s for query '%s': %s",
            response.status_code,
            query,
            _response_text_for_log(response),
        )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        logger.error(
            "Google Places Text Search API error for query '%s': %s | payload=%s",
            query,
            _extract_google_api_error(payload),
            _json_for_log(payload),
        )
    return payload


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
    if not response.ok:
        logger.error(
            "Google Reverse Geocoding HTTP %s for latlng '%s,%s': %s",
            response.status_code,
            latitude,
            longitude,
            _response_text_for_log(response),
        )
    response.raise_for_status()
    payload = response.json()
    if str(payload.get("status") or "") not in ("OK", "ZERO_RESULTS", ""):
        logger.error(
            "Google Reverse Geocoding API status for latlng '%s,%s': %s | payload=%s",
            latitude,
            longitude,
            _extract_google_api_error(payload),
            _json_for_log(payload),
        )
    return payload


def _request_address_geocoder(address: str, *, language: str = "ru") -> dict[str, Any]:
    response = requests.get(
        GEOCODING_ADDRESS_URL,
        params={
            "address": address,
            "language": language,
            "region": "ru",
            "key": get_google_places_key(),
        },
        timeout=15,
    )
    if not response.ok:
        logger.error(
            "Google Address Geocoding HTTP %s for address '%s': %s",
            response.status_code,
            address,
            _response_text_for_log(response),
        )
    response.raise_for_status()
    payload = response.json()
    if str(payload.get("status") or "") not in ("OK", "ZERO_RESULTS", ""):
        logger.error(
            "Google Address Geocoding API status for address '%s': %s | payload=%s",
            address,
            _extract_google_api_error(payload),
            _json_for_log(payload),
        )
    return payload


def _extract_suggestions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []

    for place in payload.get("places", []):
        normalized = _normalize_place(place)
        if normalized is not None:
            suggestions.append(normalized)

    return suggestions


def _extract_geocoding_suggestions(payload: dict[str, Any]) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []

    for item in payload.get("results", []):
        geometry = item.get("geometry") or {}
        location = geometry.get("location") or {}

        try:
            lat = float(location["lat"])
            lng = float(location["lng"])
        except (KeyError, TypeError, ValueError):
            continue

        address_components = item.get("address_components") or []
        suggestions.append(
            {
                "address": str(item.get("formatted_address") or "").strip(),
                "lat": lat,
                "lng": lng,
                "city": _extract_component(address_components, "locality")
                or _extract_component(address_components, "postal_town")
                or _extract_component(address_components, "administrative_area_level_2")
                or _extract_component(address_components, "administrative_area_level_1"),
                "country": _extract_component(address_components, "country"),
            }
        )

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
        suggestions: list[dict[str, Any]] = []
        logger.warning(
            "Geocoder resolving query='%s' attempt='%s' prefer_sochi_context=%s address_like=%s",
            query,
            attempt,
            prefer_sochi_context,
            _looks_like_address_query(attempt),
        )

        if _looks_like_address_query(attempt):
            try:
                geocoding_payload = _request_address_geocoder(attempt)
                logger.warning(
                    "Google Geocoding raw payload for '%s' (attempt '%s'): %s",
                    query,
                    attempt,
                    _json_for_log(geocoding_payload),
                )
                suggestions = _extract_geocoding_suggestions(geocoding_payload)
                logger.warning(
                    "Google Geocoding suggestions for '%s' (attempt '%s'): %s",
                    query,
                    attempt,
                    suggestions,
                )
            except requests.RequestException as exc:
                logger.warning(
                    "Google Geocoding request failed for '%s' (attempt '%s'): %s",
                    query,
                    attempt,
                    exc,
                )

        if not suggestions:
            logger.warning(
                "Falling back to Google Places Text Search for '%s' (attempt '%s')",
                query,
                attempt,
            )
            try:
                places_payload = _request_places_text_search(attempt, results=results)
                logger.warning(
                    "Google Places raw payload for '%s' (attempt '%s'): %s",
                    query,
                    attempt,
                    _json_for_log(places_payload),
                )
                suggestions = _extract_suggestions(places_payload)
            except requests.RequestException as exc:
                logger.error(
                    "Google Places Text Search request failed for '%s' (attempt '%s'): %s",
                    query,
                    attempt,
                    exc,
                )
                suggestions = []
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
    suggestions = _extract_geocoding_suggestions(payload)
    return suggestions[0] if suggestions else None
