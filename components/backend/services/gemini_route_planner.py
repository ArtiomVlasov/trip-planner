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


def _parse_route_queries_from_text(text: str) -> list[str]:
    try:
        parsed = _parse_json_payload(text)
    except json.JSONDecodeError:
        parsed = {}

    route_queries_payload = parsed.get("routeQueries") if isinstance(parsed, dict) else None
    if isinstance(route_queries_payload, list):
        return [
            str(query).strip()
            for query in route_queries_payload
            if str(query or "").strip()
        ]

    match = re.search(r'"routeQueries"\s*:\s*\[(.*)\]', text, flags=re.DOTALL)
    if not match:
        return []

    inner = match.group(1).strip()
    if not inner:
        return []

    if inner.startswith('"'):
        inner = inner[1:]
    if inner.endswith('"'):
        inner = inner[:-1]

    return [
        item.strip().strip('"').strip()
        for item in inner.split('","')
        if item.strip().strip('"').strip()
    ]


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
            f"Последнее сообщение пользователя: {latest_user_message.strip() or 'не указано'}",
            f"История пользовательских сообщений: {json.dumps(list(context_messages or []), ensure_ascii=False)}",
        ]
    )


def _build_system_instruction() -> str:
    return "\n".join(
        [
            "Ты помощник по построению маршрутов по Сочи и Большому Сочи.",
            "Работай только с локациями Сочи и ближайших подходящих зон маршрута: Адлер, Сириус, Хоста, Мацеста, Красная Поляна и другие точки Большого Сочи.",
            "Не предлагай другие города, регионы или страны.",
            "Собери полностью обновлённый маршрут и верни только JSON без пояснений.",
            'Формат ответа: {"routeQueries":["точка 1","точка 2"]}',
            "Требования:",
            "- В маршруте должно быть от 7 до 10 уникальных точек.",
            "- Каждая точка должна быть реальным местом, адресом или конкретной локацией.",
            "- Если пользователь просит заменить точки, нужно действительно заменить их в полном маршруте.",
            "- Если пользователь пишет 'на твоё усмотрение', 'на твое усмотрение', 'на ваше усмотрение' или похожую фразу, нельзя возвращать эту фразу как точку. Нужно самостоятельно выбрать подходящее реальное место в Сочи или Большом Сочи.",
            "- Если пользователь добавляет пожелание или новую точку в чат, нужно включить это в обновлённый маршрут.",
            "- Если задана стартовая точка, поставь её первой.",
            "- Обязательные места нужно включить в маршрут.",
            "- Удалённые точки нельзя возвращать обратно, если пользователь не попросил этого явно.",
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
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
    latest_user_message: str = "",
) -> list[str]:
    api_key = get_gemini_api_key()
    if not api_key:
        logger.warning("Gemini route planner skipped: GEMINI_API_KEY/GOOGLE_API_KEY is not configured")
        return []

    prompt = _build_prompt(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        current_route_queries=current_route_queries,
        route_queries=route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
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

    for model_name in _candidate_models():
        response: requests.Response | None = None
        try:
            logger.info("Requesting route points from Gemini model %s", model_name)
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

        raw_text = _extract_text_from_response(payload)
        if not raw_text:
            logger.warning("Gemini route planner model %s returned an empty response", model_name)
            continue

        route_queries = _parse_route_queries_from_text(raw_text)
        if not route_queries:
            logger.warning(
                "Gemini route planner model %s returned unusable payload: %s",
                model_name,
                raw_text,
            )
            continue

        logger.info(
            "Gemini route planner succeeded with model %s and returned %s route points",
            model_name,
            len(route_queries),
        )
        return route_queries

    if last_error_text:
        logger.error("Gemini route planner failed for all candidate models: %s", last_error_text)
    else:
        logger.error("Gemini route planner failed for all candidate models without a usable response")

    return []
