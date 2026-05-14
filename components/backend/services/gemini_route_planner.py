from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Sequence

import requests


DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
DEFAULT_GEMINI_MODEL_CANDIDATES = (
    DEFAULT_GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
)
logger = logging.getLogger(__name__)


class RouteGenerationResult(list[str]):
    def __init__(self, route_queries: Sequence[str] | None = None, route_description: str = ""):
        super().__init__(str(query).strip() for query in (route_queries or []) if str(query).strip())
        self.route_description = str(route_description or "").strip()

    def get(self, key: str, default: Any = None) -> Any:
        if key == "routeQueries":
            return list(self)
        if key == "routeDescription":
            return self.route_description
        return default


def get_gemini_api_key() -> str | None:
    for env_name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = str(os.getenv(env_name, "") or "").strip()
        if value:
            return value
    return None


def _extract_text_from_response(payload: dict[str, Any]) -> str:
    texts: list[str] = []

    for candidate in payload.get("candidates", []):
        content = candidate.get("content") or {}
        for part in content.get("parts", []):
            text = str(part.get("text") or "").strip()
            if text:
                texts.append(text)

    return "\n".join(texts).strip()


def _extract_error_text(payload: dict[str, Any]) -> str:
    error = payload.get("error")
    if not isinstance(error, dict):
        return ""

    message = str(error.get("message") or "").strip()
    status = str(error.get("status") or "").strip()
    details = error.get("details")

    fragments = [fragment for fragment in [status, message] if fragment]
    if isinstance(details, list) and details:
        fragments.append(json.dumps(details, ensure_ascii=False))

    return " | ".join(fragments)


def _json_for_log(payload: Any) -> str:
    try:
        return json.dumps(payload, ensure_ascii=False)
    except TypeError:
        return str(payload)


def _debug_log(message: str, *args: Any) -> None:
    logger.warning(message, *args)


def _parse_json_payload(text: str) -> dict[str, Any]:
    candidate = text.strip()

    if candidate.startswith("```"):
        parts = candidate.split("```")
        if len(parts) >= 3:
            candidate = parts[1]
        else:
            candidate = candidate.strip("`")

        if candidate.lstrip().startswith("json"):
            candidate = candidate.lstrip()[4:].strip()

    return json.loads(candidate)


def _parse_route_payload_from_text(text: str) -> RouteGenerationResult:
    try:
        parsed = _parse_json_payload(text)
    except json.JSONDecodeError:
        parsed = {}

    route_queries_payload = parsed.get("routeQueries") if isinstance(parsed, dict) else None
    route_description_payload = parsed.get("routeDescription") if isinstance(parsed, dict) else None
    route_description = (
        str(route_description_payload).strip()
        if route_description_payload is not None
        else ""
    )

    if isinstance(route_queries_payload, list):
        return RouteGenerationResult(
            [
                str(query).strip()
                for query in route_queries_payload
                if str(query or "").strip()
            ],
            route_description,
        )

    match = re.search(r'"routeQueries"\s*:\s*\[(.*)\]', text, flags=re.DOTALL)
    if not match:
        return RouteGenerationResult([], route_description)

    inner = match.group(1).strip()
    if not inner:
        return RouteGenerationResult([], route_description)

    if inner.startswith('"'):
        inner = inner[1:]
    if inner.endswith('"'):
        inner = inner[:-1]

    return RouteGenerationResult(
        [
            item.strip().strip('"').strip()
            for item in inner.split('","')
            if item.strip().strip('"').strip()
        ],
        route_description,
    )


def _parse_route_queries_from_text(text: str) -> list[str]:
    return list(_parse_route_payload_from_text(text))


def _candidate_models() -> list[str]:
    raw_models = str(os.getenv("GEMINI_MODELS", "") or "").strip()
    configured_models = [
        model.strip()
        for model in raw_models.split(",")
        if model.strip()
    ]

    seen: set[str] = set()
    ordered_models: list[str] = []

    for model in [*configured_models, *DEFAULT_GEMINI_MODEL_CANDIDATES]:
        if model in seen:
            continue
        seen.add(model)
        ordered_models.append(model)

    return ordered_models


def _build_prompt(
    *,
    route_description: str,
    starting_point_address: str,
    required_places: Sequence[str] | None,
    current_route_queries: Sequence[str] | None,
    route_queries: Sequence[str] | None,
    removed_route_queries: Sequence[str] | None,
    added_route_queries: Sequence[str] | None,
    partner_places: Sequence[object] | None,
    accommodation_preference: str | None,
    context_messages: Sequence[str] | None,
    latest_user_message: str,
) -> str:
    return "\n".join(
        [
            f"Описание маршрута: {route_description.strip() or 'не указано'}",
            f"Стартовая точка: {starting_point_address.strip() or 'не указана'}",
            f"Нужен ночлег: {accommodation_preference or 'не указано'}",
            f"Обязательные места: {json.dumps(list(required_places or []), ensure_ascii=False)}",
            f"Текущий маршрут: {json.dumps(list(current_route_queries or []), ensure_ascii=False)}",
            f"Явно указанные точки: {json.dumps(list(route_queries or []), ensure_ascii=False)}",
            f"Точки для удаления/замены: {json.dumps(list(removed_route_queries or []), ensure_ascii=False)}",
            f"Новые явно добавленные точки: {json.dumps(list(added_route_queries or []), ensure_ascii=False)}",
            f"Партнёрские места, которые можно органично включить при релевантности: {json.dumps(_build_partner_places_payload(partner_places), ensure_ascii=False)}",
            f"Последнее сообщение пользователя: {latest_user_message.strip() or 'не указано'}",
            f"История пользовательских сообщений: {json.dumps(list(context_messages or []), ensure_ascii=False)}",
            'Верни только JSON формата {"routeDescription":"краткое описание маршрута","routeQueries":["точка 1","точка 2"]}. '
            "Поле routeDescription должно кратко описывать идею и атмосферу маршрута в 2-4 предложениях.",
        ]
    )


def _build_partner_places_payload(partner_places: Sequence[object] | None) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []

    for place in partner_places or []:
        name = str(getattr(place, "name", "") or "").strip()
        address = str(getattr(place, "formatted_address", "") or "").strip()
        if not name and not address:
            continue

        payload.append(
            {
                "name": name,
                "address": address,
                "types": list(getattr(place, "types", None) or []),
                "rating": getattr(place, "rating", None),
                "partnerPlaceId": getattr(place, "partner_place_id", None),
                "score": getattr(place, "score", None),
                "reason": getattr(place, "reason", None),
            }
        )

    return payload


def _build_system_instruction() -> str:
    return "\n".join(
        [
            "Ты помощник по построению маршрутов по Сочи и Большому Сочи.",
            "Работай только с локациями Сочи и ближайших подходящих зон маршрута: Адлер, Сириус, Хоста, Мацеста, Красная Поляна и другие точки Большого Сочи.",
            "Не предлагай другие города, регионы или страны.",
            "Собери полностью обновлённый маршрут и верни только JSON без пояснений.",
            'Формат ответа: {"routeDescription":"краткое описание маршрута","routeQueries":["точка 1","точка 2"]}',
            "Требования:",
            "- В routeDescription дай краткое описание маршрута в 2-4 предложениях без markdown и без нумерованного списка.",
            "- В маршруте должно быть от 7 до 10 уникальных точек.",
            "- Каждая точка должна быть реальным местом, адресом или конкретной локацией.",
            "- Если пользователь просит заменить точки, нужно действительно заменить их в полном маршруте.",
            "- Если пользователь пишет 'на твоё усмотрение', 'на твое усмотрение', 'на ваше усмотрение' или похожую фразу, нельзя возвращать эту фразу как точку. Нужно самостоятельно выбрать подходящее реальное место в Сочи или Большом Сочи.",
            "- Если пользователь добавляет пожелание или новую точку в чат, нужно включить это в обновлённый маршрут.",
            "- Если задана стартовая точка, поставь её первой.",
            "- Обязательные места нужно включить в маршрут.",
            "- Удалённые точки нельзя возвращать обратно, если пользователь не попросил этого явно.",
            "- Партнёрские места можно включать только если они реально подходят запросу, району и логике маршрута.",
            "- Не включай больше 2 партнёрских мест, если пользователь явно не просит больше ресторанов/отелей/активностей такого типа.",
            "- Не заменяй качественную точку партнёрской, если партнёрская хуже подходит пожеланию пользователя.",
            "- Возвращай каждую точку в максимально конкретном виде.",
            "- Для каждой точки указывай либо точный адрес, либо название места плюс конкретный район/населённый пункт Большого Сочи.",
            "- Предпочтительный формат точки: 'Название места, улица/адрес, район, Сочи' или 'Название места, Хоста/Адлер/Сириус/Красная Поляна'.",
            "- Не возвращай общие или двусмысленные формулировки без адреса или района, если у места есть тёзки.",
        ]
    )


def _build_contents(
    *,
    context_messages: Sequence[str] | None,
    latest_user_message: str,
    prompt: str,
) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []

    history_messages = [
        str(message).strip()
        for message in (context_messages or [])
        if str(message).strip()
    ]

    for message in history_messages[:-1]:
        contents.append(
            {
                "role": "user",
                "parts": [{"text": message}],
            }
        )

    final_message_parts: list[str] = []
    if history_messages:
        final_message_parts.append(
            "История запроса пользователя уже передана выше. Учти её при полной перегенерации маршрута."
        )
    if latest_user_message.strip():
        final_message_parts.append(f"Последнее сообщение пользователя: {latest_user_message.strip()}")
    final_message_parts.append(prompt)

    contents.append(
        {
            "role": "user",
            "parts": [{"text": "\n\n".join(final_message_parts)}],
        }
    )

    return contents


def generate_route_queries_with_gemini(
    *,
    route_description: str = "",
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    current_route_queries: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    removed_route_queries: Sequence[str] | None = None,
    added_route_queries: Sequence[str] | None = None,
    partner_places: Sequence[object] | None = None,
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
    latest_user_message: str = "",
) -> RouteGenerationResult:
    api_key = get_gemini_api_key()
    if not api_key:
        logger.warning("Gemini route planner skipped: GEMINI_API_KEY/GOOGLE_API_KEY is not configured")
        return RouteGenerationResult([], "")

    prompt = _build_prompt(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        current_route_queries=current_route_queries,
        route_queries=route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
        partner_places=partner_places,
        accommodation_preference=accommodation_preference,
        context_messages=context_messages,
        latest_user_message=latest_user_message,
    )
    system_instruction = _build_system_instruction()
    contents = _build_contents(
        context_messages=context_messages,
        latest_user_message=latest_user_message,
        prompt=prompt,
    )

    last_error_text = ""
    candidate_models = _candidate_models()
    _debug_log("Gemini route planner candidate models: %s", candidate_models)
    _debug_log("Gemini route planner system instruction: %s", system_instruction)
    _debug_log("Gemini route planner contents: %s", _json_for_log(contents))

    for model_name in candidate_models:
        response: requests.Response | None = None
        try:
            _debug_log("Requesting route points from Gemini model %s", model_name)
            response = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model_name}:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                },
                json={
                    "systemInstruction": {
                        "parts": [{"text": system_instruction}],
                    },
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.5,
                        "responseMimeType": "application/json",
                    },
                },
                timeout=30,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            payload: dict[str, Any] = {}
            try:
                payload = response.json() if response is not None else {}
            except ValueError:
                payload = {}

            error_text = _extract_error_text(payload) or str(exc)
            last_error_text = error_text
            logger.warning(
                "Gemini route planner model %s failed with HTTP %s: %s",
                model_name,
                getattr(response, "status_code", "unknown"),
                error_text,
            )
            continue

        try:
            payload = response.json()
        except ValueError:
            logger.warning("Gemini route planner model %s returned non-JSON response", model_name)
            continue

        _debug_log(
            "Gemini route planner raw payload from model %s: %s",
            model_name,
            _json_for_log(payload),
        )

        raw_text = _extract_text_from_response(payload)
        if not raw_text:
            logger.warning("Gemini route planner model %s returned an empty response", model_name)
            continue

        _debug_log("Gemini route planner raw text from model %s: %s", model_name, raw_text)

        route_payload = _parse_route_payload_from_text(raw_text)
        route_queries = route_payload.get("routeQueries", [])
        if not route_queries:
            logger.warning(
                "Gemini route planner model %s returned unusable payload: %s",
                model_name,
                raw_text,
            )
            continue

        _debug_log(
            "Gemini route planner succeeded with model %s and returned %s route points",
            model_name,
            len(route_queries),
        )
        _debug_log(
            "Gemini route planner parsed route queries from model %s: %s",
            model_name,
            _json_for_log(route_queries),
        )
        return RouteGenerationResult(
            route_queries,
            str(route_payload.get("routeDescription") or "").strip(),
        )

    if last_error_text:
        logger.error("Gemini route planner failed for all candidate models: %s", last_error_text)
    else:
        logger.error("Gemini route planner failed for all candidate models without a usable response")

    return RouteGenerationResult([], "")
