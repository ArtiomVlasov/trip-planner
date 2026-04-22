import json
import logging
import os
import re
import time
from threading import Lock
from typing import Any
from uuid import uuid4

import requests
from fastapi import HTTPException

from schemas import RoutePlanningRequest

logger = logging.getLogger(__name__)


GIGACHAT_TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_BASE_URL = os.getenv("GIGACHAT_BASE_URL", "https://gigachat.devices.sberbank.ru/api/v1")
GIGACHAT_SCOPE = os.getenv("GIGACHAT_SCOPE", "GIGACHAT_API_PERS")
GIGACHAT_MODEL = os.getenv("GIGACHAT_MODEL", "GigaChat")
GIGACHAT_TIMEOUT_SECONDS = float(os.getenv("GIGACHAT_TIMEOUT_SECONDS", "30"))
ROUTE_FUNCTION_NAME = "build_sochi_one_day_route"

_TOKEN_LOCK = Lock()
_ACCESS_TOKEN: str | None = None
_ACCESS_TOKEN_EXPIRES_AT = 0.0

_ROUTE_POINT_KEYS = (
    "route_points",
    "points",
    "addresses",
    "locations",
    "items",
    "stops",
)
_ADDRESS_KEYS = (
    "address",
    "formatted_address",
    "location",
    "place",
    "name",
    "title",
)


def _normalize_route_point(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().strip('"').strip("'")


def _deduplicate_route_points(values: list[str]) -> list[str]:
    unique_values: list[str] = []
    seen: set[str] = set()

    for raw_value in values:
        normalized = _normalize_route_point(raw_value)
        if not normalized:
            continue

        normalized_key = normalized.casefold()
        if normalized_key in seen:
            continue

        seen.add(normalized_key)
        unique_values.append(normalized)

    return unique_values


def _format_bool(value: bool | None) -> str:
    if value is True:
        return "да"
    if value is False:
        return "нет"
    return "не указано"


def _format_optional_text(value: str | None) -> str:
    normalized = (value or "").strip()
    return normalized or "не указано"


def build_route_points_prompt(_request: RoutePlanningRequest) -> str:
    return (
        "Ты — опытный локальный travel-планировщик по Большому Сочи. "
        "Составь реалистичный маршрут ровно на 1 день и верни только аргументы вызова функции "
        f"`{ROUTE_FUNCTION_NAME}`.\n\n"
        "Требования к маршруту:\n"
        "- Маршрут должен быть пригоден для последовательного проезда или прохода по точкам на карте.\n"
        "- Работай только с местами в Сочи, Адлере, Сириусе, Хосте, Мацесте, Красной Поляне или рядом, если это прямо следует из запроса.\n"
        "- Если запрос широкий или неоднозначный, предпочитай центральный Сочи.\n"
        "- Верни от 4 до 7 точек на день в логичном порядке посещения.\n"
        "- Для каждой точки обязательно укажи точный адрес в формате, который можно передать в Яндекс Карты для геокодирования.\n"
        "- Если пользователь указал стартовую точку, поставь ее первой точкой маршрута или начни маршрут максимально близко к ней.\n"
        "- Если пользователь указал обязательные места, включи каждое из них в маршрут.\n"
        "- Если прием пищи обязателен, включи подходящее кафе или ресторан примерно в середину маршрута.\n"
        "- Если нужен ночлег, добавь уместный отель или апартаменты ближе к концу маршрута.\n"
        "- Не добавляй пояснения вне структуры функции, markdown, вводный текст и комментарии.\n"
        "- Если каких-то данных не хватает, предложи разумный маршрут, не задавая уточняющих вопросов."
    )


def build_route_request_payload(request: RoutePlanningRequest) -> dict[str, Any]:
    return {
        "route_request": request.route_request.strip(),
        "accommodation_required": request.accommodation_required,
        "meal_required": request.meal_required,
        "meal_preferences": (request.meal_preferences or "").strip() or None,
        "starting_point_address": (request.starting_point_address or "").strip() or None,
        "required_places": [
            place.strip()
            for place in request.required_places
            if place and place.strip()
        ],
    }


def build_route_user_prompt(request: RoutePlanningRequest) -> str:
    payload = build_route_request_payload(request)
    required_places = payload["required_places"]

    return (
        "Построй маршрут на 1 день по Сочи по этим параметрам пользователя.\n"
        f"- Описание пожеланий: {_format_optional_text(payload['route_request'])}\n"
        f"- Нужен ночлег: {_format_bool(payload['accommodation_required'])}\n"
        f"- Обязателен прием пищи: {_format_bool(payload['meal_required'])}\n"
        f"- Предпочтения по еде: {_format_optional_text(payload['meal_preferences'])}\n"
        f"- Стартовая точка: {_format_optional_text(payload['starting_point_address'])}\n"
        "- Обязательные места: "
        f"{', '.join(required_places) if required_places else 'не указано'}\n\n"
        "Верни структуру функции так, чтобы в каждом элементе `route_points` был порядок посещения, "
        "название места, точный адрес, категория и краткая причина включения точки в маршрут."
    )


def build_route_messages(request: RoutePlanningRequest) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": build_route_points_prompt(request)},
        {"role": "user", "content": build_route_user_prompt(request)},
    ]


def build_route_function_definition() -> dict[str, Any]:
    return {
        "name": ROUTE_FUNCTION_NAME,
        "description": (
            "Возвращает однодневный маршрут по Сочи в виде упорядоченного списка точек, "
            "готовых для построения маршрута на карте."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "route_summary": {
                    "type": "string",
                    "description": "Краткое описание маршрута на 1 день.",
                },
                "route_points": {
                    "type": "array",
                    "description": "Упорядоченный список точек маршрута на 1 день.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "order": {
                                "type": "integer",
                                "description": "Порядок посещения, начиная с 1.",
                            },
                            "place_name": {
                                "type": "string",
                                "description": "Короткое название места.",
                            },
                            "address": {
                                "type": "string",
                                "description": "Точный адрес места для геокодирования в Яндекс Картах.",
                            },
                            "category": {
                                "type": "string",
                                "description": "Тип точки маршрута.",
                                "enum": [
                                    "start",
                                    "walk",
                                    "sight",
                                    "park",
                                    "museum",
                                    "beach",
                                    "food",
                                    "viewpoint",
                                    "shopping",
                                    "hotel",
                                    "finish",
                                ],
                            },
                            "visit_reason": {
                                "type": "string",
                                "description": "Краткое объяснение, зачем точка включена в маршрут.",
                            },
                        },
                        "required": ["order", "place_name", "address", "category"],
                    },
                },
            },
            "required": ["route_points"],
        },
    }


def _extract_error_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        detail = payload.get("detail") or payload.get("message") or payload.get("error")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()

    body = response.text.strip()
    return body or f"HTTP {response.status_code}"


def _request_access_token() -> tuple[str, float]:
    auth_key = os.getenv("GIGACHAT_AUTH_KEY")
    if not auth_key:
        raise HTTPException(status_code=500, detail="GigaChat authorization key is not configured.")

    try:
        response = requests.post(
            GIGACHAT_TOKEN_URL,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "RqUID": str(uuid4()),
                "Authorization": f"Basic {auth_key}",
            },
            data={"scope": GIGACHAT_SCOPE},
            timeout=GIGACHAT_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the GigaChat token endpoint.",
        ) from exc

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"GigaChat token request failed: {_extract_error_detail(response)}",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="GigaChat token response was not valid JSON.",
        ) from exc

    access_token = payload.get("access_token")
    expires_at = payload.get("expires_at")

    if not access_token or not expires_at:
        raise HTTPException(
            status_code=502,
            detail="GigaChat token response did not include access_token or expires_at.",
        )

    return str(access_token), float(expires_at)


def get_access_token() -> str:
    global _ACCESS_TOKEN, _ACCESS_TOKEN_EXPIRES_AT

    now = time.time()
    with _TOKEN_LOCK:
        if _ACCESS_TOKEN and now < (_ACCESS_TOKEN_EXPIRES_AT - 60):
            return _ACCESS_TOKEN

        _ACCESS_TOKEN, _ACCESS_TOKEN_EXPIRES_AT = _request_access_token()
        return _ACCESS_TOKEN


def _extract_route_points_from_payload(payload: Any) -> list[str]:
    if isinstance(payload, str):
        normalized = _normalize_route_point(payload)
        return [normalized] if normalized else []

    if isinstance(payload, list):
        values: list[str] = []
        for item in payload:
            values.extend(_extract_route_points_from_payload(item))
        return values

    if isinstance(payload, dict):
        values: list[str] = []

        for key in _ROUTE_POINT_KEYS:
            if key in payload:
                values.extend(_extract_route_points_from_payload(payload[key]))

        if values:
            return values

        for key in _ADDRESS_KEYS:
            if key in payload and isinstance(payload[key], str):
                normalized = _normalize_route_point(payload[key])
                if normalized:
                    values.append(normalized)

        if values:
            return values

        for value in payload.values():
            if isinstance(value, (list, dict)):
                values.extend(_extract_route_points_from_payload(value))

        return values

    return []


def _extract_json_like_payloads(content: str) -> list[Any]:
    payloads: list[Any] = []
    candidates = [content.strip()]

    fenced_match = re.search(r"```(?:json)?\s*(.*?)```", content, re.DOTALL | re.IGNORECASE)
    if fenced_match:
        candidates.append(fenced_match.group(1).strip())

    for candidate in candidates:
        if not candidate:
            continue
        try:
            payloads.append(json.loads(candidate))
        except ValueError:
            continue

    return payloads


def _extract_points_from_lines(content: str) -> list[str]:
    values: list[str] = []

    for line in content.splitlines():
        normalized_line = re.sub(r"^\s*(?:[-*•]+|\d+[.)])\s*", "", line).strip()
        if normalized_line:
            values.append(normalized_line)

    return values


def extract_route_points(content: str) -> list[str]:
    for payload in _extract_json_like_payloads(content):
        extracted = _deduplicate_route_points(_extract_route_points_from_payload(payload))
        if extracted:
            return extracted

    return _deduplicate_route_points(_extract_points_from_lines(content))


def _load_json_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return value


def _normalize_route_item(raw_item: Any, fallback_order: int) -> dict[str, Any] | None:
    if isinstance(raw_item, str):
        address = _normalize_route_point(raw_item)
        if not address:
            return None

        return {
            "order": fallback_order,
            "place_name": address,
            "address": address,
            "category": None,
            "visit_reason": None,
        }

    if not isinstance(raw_item, dict):
        return None

    address = _normalize_route_point(str(raw_item.get("address") or raw_item.get("formatted_address") or ""))
    place_name = _normalize_route_point(
        str(raw_item.get("place_name") or raw_item.get("name") or raw_item.get("title") or address)
    )

    if not address:
        return None

    order = raw_item.get("order")
    if not isinstance(order, int):
        try:
            order = int(order)
        except (TypeError, ValueError):
            order = fallback_order

    category = raw_item.get("category")
    category = str(category).strip() if category is not None else None
    visit_reason = raw_item.get("visit_reason")
    visit_reason = str(visit_reason).strip() if visit_reason is not None else None

    return {
        "order": order,
        "place_name": place_name or address,
        "address": address,
        "category": category or None,
        "visit_reason": visit_reason or None,
    }


def extract_structured_route_items(message_payload: dict[str, Any]) -> list[dict[str, Any]]:
    function_call = message_payload.get("function_call")
    if not isinstance(function_call, dict):
        return []

    arguments = _load_json_value(function_call.get("arguments"))
    if not isinstance(arguments, dict):
        return []

    raw_points = arguments.get("route_points")
    if not isinstance(raw_points, list):
        return []

    route_items: list[dict[str, Any]] = []
    for index, raw_item in enumerate(raw_points, start=1):
        normalized_item = _normalize_route_item(raw_item, index)
        if normalized_item:
            route_items.append(normalized_item)

    route_items.sort(key=lambda item: (item["order"], item["place_name"].casefold()))

    for index, item in enumerate(route_items, start=1):
        item["order"] = index

    return route_items


def request_route_points_from_gigachat(
    request: RoutePlanningRequest,
) -> tuple[list[str], list[dict[str, Any]], str]:
    request_payload = build_route_request_payload(request)
    logger.info(
        "Requesting GigaChat route points with payload: %s",
        json.dumps(request_payload, ensure_ascii=False),
    )

    access_token = get_access_token()

    try:
        response = requests.post(
            f"{GIGACHAT_BASE_URL.rstrip('/')}/chat/completions",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            json={
                "model": GIGACHAT_MODEL,
                "messages": build_route_messages(request),
                "functions": [build_route_function_definition()],
                "function_call": {"name": ROUTE_FUNCTION_NAME},
                "temperature": 0.1,
            },
            timeout=GIGACHAT_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not reach the GigaChat completions endpoint.",
        ) from exc

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"GigaChat request failed: {_extract_error_detail(response)}",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="GigaChat response was not valid JSON.",
        ) from exc

    logger.info(
        "Raw GigaChat response payload: %s",
        json.dumps(payload, ensure_ascii=False),
    )

    message_payload = payload.get("choices", [{}])[0].get("message", {})
    if not isinstance(message_payload, dict):
        raise HTTPException(
            status_code=502,
            detail="GigaChat response did not include a valid message object.",
        )

    route_items = extract_structured_route_items(message_payload)
    if route_items:
        route_points = _deduplicate_route_points([item["address"] for item in route_items])
        raw_response = json.dumps({"route_points": route_items}, ensure_ascii=False)
        logger.info(
            "Parsed GigaChat function_call route items: %s",
            json.dumps(route_items, ensure_ascii=False),
        )
        logger.info(
            "Parsed GigaChat route point addresses: %s",
            json.dumps(route_points, ensure_ascii=False),
        )
        return route_points, route_items, raw_response

    content = message_payload.get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(
            status_code=502,
            detail="GigaChat returned neither function_call arguments nor text content.",
        )

    route_points = extract_route_points(content)
    route_items = [
        {
            "order": index,
            "place_name": point,
            "address": point,
            "category": None,
            "visit_reason": None,
        }
        for index, point in enumerate(route_points, start=1)
    ]
    logger.info("GigaChat text response content: %s", content)
    logger.info(
        "Parsed fallback GigaChat route point addresses: %s",
        json.dumps(route_points, ensure_ascii=False),
    )
    return route_points, route_items, content
