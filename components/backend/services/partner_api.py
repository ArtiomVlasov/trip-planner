import os
from typing import Any

import requests

PARTNER_API_BASE_URL = os.getenv("PARTNER_API_BASE_URL", "https://trip.liberty-music.lol")


def _safe_post(path: str, payload: dict[str, Any]) -> None:
    url = f"{PARTNER_API_BASE_URL.rstrip('/')}{path}"
    try:
        requests.post(url, json=payload, timeout=2)
    except Exception:
        return


def _safe_get(path: str, params: dict[str, Any]) -> dict[str, float]:
    url = f"{PARTNER_API_BASE_URL.rstrip('/')}{path}"
    try:
        response = requests.get(url, params=params, timeout=2)
        if response.status_code != 200:
            return {}

        payload = response.json()
        if isinstance(payload, list):
            boosts: dict[str, float] = {}
            for item in payload:
                place_id = item.get("place_id")
                score_boost = float(item.get("score_boost", item.get("score", 0.0)) or 0.0)
                if place_id:
                    boosts[str(place_id)] = score_boost
            return boosts

        if isinstance(payload, dict) and isinstance(payload.get("items"), list):
            boosts = {}
            for item in payload["items"]:
                place_id = item.get("place_id")
                score_boost = float(item.get("score_boost", item.get("score", 0.0)) or 0.0)
                if place_id:
                    boosts[str(place_id)] = score_boost
            return boosts

        return {}
    except Exception:
        return {}


def notify_partner_registration(user_id: int, city: str, username: str, partner_data: Any) -> None:
    partner_login = f"partner_{username}".lower().replace(" ", "_")
    payload = {
        "name": partner_data.partnerName,
        "login": getattr(partner_data, "login", None) or partner_login,
        "password": getattr(partner_data, "password", None) or "Partner123!",
        "category": partner_data.partnerCategory,
        "city": city or "Sochi",
        "contact_email": partner_data.contactEmail,
        "meta": {
            "user_id": user_id,
            "username": username,
        },
    }
    _safe_post("/api/v1/crm/partners", payload)


def fetch_partner_recommendation_boosts(user_id: int, city: str, country: str) -> dict[str, float]:
    return _safe_get(
        "/api/v1/partners/recommendations",
        {
            "user_id": user_id,
            "city": city,
            "country": country,
        },
    )
