import time
from typing import Any, Dict

_ROUTE_CONTEXT_CACHE: Dict[str, dict[str, Any]] = {}
TTL = 1800  # 30 minutes


def build_context_key(user_id: int | None = None, client_ip: str | None = None) -> str:
    if user_id is not None:
        return f"user:{user_id}"

    if client_ip:
        return f"guest:{client_ip}"

    raise RuntimeError("Route context key is unavailable")


def save_context(key: str, data: dict) -> None:
    _ROUTE_CONTEXT_CACHE[key] = {
        "ts": time.time(),
        "data": data,
    }


def load_context(key: str) -> dict | None:
    item = _ROUTE_CONTEXT_CACHE.get(key)
    if not item:
        return None

    if time.time() - item["ts"] > TTL:
        del _ROUTE_CONTEXT_CACHE[key]
        return None

    return item["data"]
