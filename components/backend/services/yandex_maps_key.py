import os

from fastapi import HTTPException


def get_yandex_maps_key() -> str:
    for env_name in ("YANDEX_MAPS_API_KEY", "VITE_YANDEX_MAPS_API_KEY"):
        key = os.environ.get(env_name)
        if key:
            return key

    raise HTTPException(status_code=500, detail="Yandex Maps key not set")
