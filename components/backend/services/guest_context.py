import time
from typing import Dict

_GUEST_CACHE: Dict[str, dict] = {}
TTL = 300  # 5 минут


def save_guest(ip: str, data: dict):
    _GUEST_CACHE[ip] = {
        "ts": time.time(),
        "data": data
    }


def load_guest(ip: str):
    item = _GUEST_CACHE.get(ip)
    if not item:
        return None

    if time.time() - item["ts"] > TTL:
        del _GUEST_CACHE[ip]
        return None

    return item["data"]