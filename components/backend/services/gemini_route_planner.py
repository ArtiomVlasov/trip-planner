from __future__ import annotations

import json
import os
from typing import Any, Sequence

import requests


DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


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
            "Ты помощник по построению маршрутов по Сочи и окрестностям.",
            "Собери ПОЛНОСТЬЮ обновлённый маршрут и верни только JSON без пояснений.",
            'Формат ответа: {"routeQueries":["точка 1","точка 2"]}',
            "Требования:",
            "- В маршруте должно быть от 7 до 10 уникальных точек.",
            "- Каждая точка должна быть реальным местом, адресом или конкретной локацией.",
            "- Если пользователь просит заменить точки, нужно действительно заменить их в полном маршруте.",
            "- Если пользователь пишет 'на твоё усмотрение', 'на твое усмотрение', 'на ваше усмотрение' или похожую фразу, нельзя возвращать эту фразу как точку. Нужно самостоятельно выбрать подходящее реальное место.",
            "- Если пользователь добавляет пожелание или новую точку в чат, нужно включить это в обновлённый маршрут.",
            "- Если задана стартовая точка, поставь её первой.",
            "- Обязательные места нужно включить в маршрут.",
            "- Удалённые точки нельзя возвращать обратно, если пользователь не попросил этого явно.",
            "",
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

    response = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{DEFAULT_GEMINI_MODEL}:generateContent",
        params={"key": api_key},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.5,
                "responseMimeType": "application/json",
            },
        },
        timeout=30,
    )
    response.raise_for_status()

    payload = response.json()
    raw_text = _extract_text_from_response(payload)
    if not raw_text:
        return []

    try:
        parsed = _parse_json_payload(raw_text)
    except json.JSONDecodeError:
        return []

    route_queries_payload = parsed.get("routeQueries")
    if not isinstance(route_queries_payload, list):
        return []

    return [
        str(query).strip()
        for query in route_queries_payload
        if str(query or "").strip()
    ]
