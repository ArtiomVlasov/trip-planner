from __future__ import annotations

import logging
import re
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from services.gemini_route_planner import RouteGenerationResult, generate_route_queries_with_gemini

SOCHI_MARKERS = (
    "сочи",
    "sochi",
    "адлер",
    "adler",
    "красная поляна",
    "krasnaya polyana",
    "курортный",
    "имерет",
    "hosta",
    "хоста",
)

CATEGORY_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        "food",
        (
            "кафе",
            "ресторан",
            "еда",
            "обед",
            "ужин",
            "завтрак",
            "кофе",
            "coffee",
            "cafe",
            "restaurant",
            "food",
            "breakfast",
            "dinner",
            "lunch",
        ),
    ),
    (
        "parks",
        (
            "парк",
            "прогул",
            "сад",
            "дендрар",
            "алле",
            "walk",
            "park",
            "garden",
            "green",
        ),
    ),
    (
        "attractions",
        (
            "море",
            "море",
            "пляж",
            "набереж",
            "достопр",
            "смотров",
            "вид",
            "музей",
            "театр",
            "культур",
            "sea",
            "beach",
            "view",
            "museum",
            "theater",
            "theatre",
            "attraction",
        ),
    ),
    (
        "nightlife",
        (
            "вечер",
            "ноч",
            "бар",
            "коктей",
            "музык",
            "night",
            "bar",
            "cocktail",
            "music",
        ),
    ),
    (
        "adventure",
        (
            "актив",
            "экстрим",
            "аквапарк",
            "развлеч",
            "адреналин",
            "skypark",
            "amusement",
            "adventure",
            "waterpark",
            "sport",
        ),
    ),
]

CATEGORY_TYPES: dict[str, set[str]] = {
    "lodging": {"hotel", "lodging"},
    "food": {
        "restaurant",
        "food",
        "cafe",
        "bakery",
        "dessert_shop",
        "bar",
        "seafood_restaurant",
        "italian_restaurant",
        "food_store",
        "confectionery",
        "pastry_shop",
    },
    "parks": {"park", "tourist_attraction", "historical_place"},
    "attractions": {
        "tourist_attraction",
        "museum",
        "art_museum",
        "performing_arts_theater",
        "concert_hall",
        "park",
        "historical_place",
        "amusement_park",
        "activity",
    },
    "nightlife": {"bar", "cocktail_bar", "live_music_venue", "event_venue"},
    "adventure": {"amusement_park", "sports_activity_location", "activity", "tourist_attraction"},
}

DEFAULT_CATEGORY_ORDER = ["attractions", "parks", "food"]
ROUTE_MINIMUM_POINTS = 7
ROUTE_MAXIMUM_POINTS = 10
AI_CHOICE_MARKERS = (
    "на тво",
    "на твое",
    "на ваше",
    "your choice",
    "as you see fit",
    "up to you",
)
POINT_DESCRIPTION_RULES: list[tuple[tuple[str, ...], str]] = [
    (
        ("кафе", "ресторан", "кофе", "бар", "cafe", "coffee", "restaurant", "bar", "food"),
        "Здесь удобно запланировать паузу на еду, кофе и отдых между прогулками.",
    ),
    (
        ("парк", "сад", "дендрар", "сквер", "роща", "park", "garden", "grove", "arboretum"),
        "Это зеленая прогулочная точка, где маршрут получает более спокойный и живой ритм.",
    ),
    (
        ("море", "пляж", "набереж", "морпорт", "порт", "sea", "beach", "embankment", "seaport"),
        "Это остановка у воды для видов, прогулки и короткой паузы на фотографии.",
    ),
    (
        ("музей", "театр", "галере", "истор", "museum", "theater", "theatre", "gallery", "historic"),
        "Это культурная точка, которая добавляет маршруту историю и локальный контекст.",
    ),
    (
        ("ахун", "гора", "смотров", "видов", "водопад", "скал", "mount", "viewpoint", "lookout", "waterfall"),
        "Это видовая остановка с акцентом на панораму города, моря или гор.",
    ),
    (
        ("skypark", "скайпарк", "аквапарк", "развлеч", "экстрим", "adventure", "amusement", "waterpark"),
        "Это активная точка маршрута с развлечениями и более яркими впечатлениями.",
    ),
    (
        ("вокзал", "аэропорт", "станция", "ж/д", "жд", "station", "airport", "railway", "train"),
        "Это практичная транспортная точка, откуда удобно начать или завершить часть пути.",
    ),
]
logger = logging.getLogger(__name__)


def build_route_description_fallback(
    *,
    route_queries: Sequence[str] | None,
    route_description: str = "",
    starting_point_address: str = "",
    accommodation_preference: str | None = None,
) -> str:
    cleaned_description = route_description.strip()
    cleaned_queries = [str(query).strip() for query in (route_queries or []) if str(query).strip()]

    if cleaned_description and cleaned_queries:
        return (
            f"{cleaned_description} В маршрут включены {len(cleaned_queries)} точек"
            f"{f', старт из {starting_point_address.strip()}' if starting_point_address.strip() else ''}."
        )

    if cleaned_description:
        return cleaned_description

    if not cleaned_queries:
        return ""

    lodging_hint = " с ночлегом" if accommodation_preference == "yes" else ""
    preview_points = ", ".join(cleaned_queries[:3])
    extra_count = len(cleaned_queries) - min(len(cleaned_queries), 3)
    extra_text = f" и ещё {extra_count}" if extra_count > 0 else ""

    return (
        f"Маршрут{lodging_hint} включает {len(cleaned_queries)} точек."
        f" Основные остановки: {preview_points}{extra_text}."
    )


def build_route_point_description_fallback(
    *,
    query: str,
    index: int,
    total: int,
    route_description: str = "",
    starting_point_address: str = "",
) -> str:
    normalized_query = normalize_query(query)
    title = str(query or "").split(",")[0].strip() or str(query or "").strip()
    route_context = route_description.strip()

    if starting_point_address.strip() and normalized_query == normalize_query(starting_point_address):
        return (
            f"{title} - стартовая точка маршрута. Отсюда удобно задать темп поездки "
            "и выстроить дальнейшие остановки."
        )

    for markers, description in POINT_DESCRIPTION_RULES:
        if any(marker in normalized_query for marker in markers):
            return f"{title} - {description}"

    if index == 0 and total > 1:
        return (
            f"{title} - первая остановка маршрута. Она задает направление дня "
            "и помогает логично перейти к следующим местам."
        )

    if index == total - 1 and total > 1:
        return (
            f"{title} - финальная остановка маршрута. Ее удобно оставить как спокойную "
            "точку завершения пути."
        )

    if route_context:
        return (
            f"{title} добавлена в маршрут с учетом запроса: {route_context}. "
            "Здесь стоит заложить время на осмотр и короткую паузу."
        )

    return (
        f"{title} - конкретная остановка маршрута. Здесь стоит заложить время "
        "на осмотр, отдых и проверку деталей на карте."
    )


def normalize_route_point_descriptions(
    route_point_descriptions: object,
) -> dict[str, str]:
    if not isinstance(route_point_descriptions, dict):
        return {}

    return {
        str(query).strip(): str(description).strip()
        for query, description in route_point_descriptions.items()
        if str(query).strip() and str(description).strip()
    }


def build_route_point_descriptions(
    *,
    route_queries: Sequence[str],
    generated_descriptions: dict[str, str] | None = None,
    route_description: str = "",
    starting_point_address: str = "",
) -> dict[str, str]:
    generated_by_normalized = {
        normalize_query(query): description
        for query, description in (generated_descriptions or {}).items()
        if normalize_query(query) and str(description).strip()
    }
    cleaned_queries = [str(query).strip() for query in route_queries if str(query).strip()]
    total = len(cleaned_queries)

    return {
        query: generated_by_normalized.get(normalize_query(query))
        or build_route_point_description_fallback(
            query=query,
            index=index,
            total=total,
            route_description=route_description,
            starting_point_address=starting_point_address,
        )
        for index, query in enumerate(cleaned_queries)
    }


def normalize_query(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" \n\t,.;:!?").lower()


def add_unique_query(target: list[str], value: str, seen: set[str]) -> None:
    normalized = normalize_query(value)

    if not normalized or normalized in seen:
        return

    seen.add(normalized)
    target.append(value.strip())


def remove_query(target: list[str], value: str) -> None:
    normalized = normalize_query(value)
    if not normalized:
        return

    target[:] = [
        query
        for query in target
        if normalize_query(query) != normalized
    ]


def is_placeholder_query(value: str) -> bool:
    normalized = normalize_query(value)
    return any(marker in normalized for marker in AI_CHOICE_MARKERS)


def build_place_query(place: object) -> str:
    name = str(getattr(place, "name", "") or "").strip()
    address = str(getattr(place, "formatted_address", "") or "").strip()

    if name and address:
        normalized_name = normalize_query(name)
        normalized_address = normalize_query(address)

        if normalized_address not in normalized_name:
            return f"{name}, {address}"

    return name or address


def place_types(place: object) -> set[str]:
    return {str(place_type).lower() for place_type in (getattr(place, "types", None) or [])}


def place_text(place: object) -> str:
    return " ".join(
        filter(
            None,
            [
                str(getattr(place, "name", "") or ""),
                str(getattr(place, "formatted_address", "") or ""),
                " ".join(str(place_type) for place_type in (getattr(place, "types", None) or [])),
            ],
        )
    ).lower()


def looks_like_sochi_place(place: object) -> bool:
    haystack = place_text(place)
    return any(marker in haystack for marker in SOCHI_MARKERS)


def infer_categories(
    route_description: str,
    context_messages: Sequence[str] | None,
    accommodation_preference: str | None,
) -> list[str]:
    combined_text = " ".join(
        item.strip()
        for item in [route_description, *(context_messages or [])]
        if item and item.strip()
    ).lower()

    categories: list[str] = []

    if accommodation_preference == "yes":
        categories.append("lodging")

    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in combined_text for keyword in keywords):
            categories.append(category)

    for category in DEFAULT_CATEGORY_ORDER:
        if category not in categories:
            categories.append(category)

    return categories


def place_score(place: object, category: str, combined_text: str) -> float:
    score = float(getattr(place, "rating", 0) or 0)
    current_types = place_types(place)
    current_text = place_text(place)

    if current_types & CATEGORY_TYPES.get(category, set()):
        score += 5.0

    for mapped_category, keywords in CATEGORY_KEYWORDS:
        if mapped_category != category:
            continue

        for keyword in keywords:
            if keyword in combined_text and keyword in current_text:
                score += 1.5

    if "tourist_attraction" in current_types:
        score += 0.6
    if "park" in current_types:
        score += 0.4
    if "restaurant" in current_types or "cafe" in current_types:
        score += 0.3
    if "hotel" in current_types:
        score += 0.2

    return score


def pick_best_place(
    candidates: Sequence[object],
    category: str,
    combined_text: str,
    seen_queries: set[str],
) -> str | None:
    scored_candidates: list[tuple[float, str]] = []

    for candidate in candidates:
        query = build_place_query(candidate)
        normalized_query = normalize_query(query)

        if not normalized_query or normalized_query in seen_queries:
            continue

        scored_candidates.append((place_score(candidate, category, combined_text), query))

    if not scored_candidates:
        return None

    scored_candidates.sort(key=lambda item: item[0], reverse=True)
    return scored_candidates[0][1]


def add_many_queries(target: list[str], values: Iterable[str], seen: set[str]) -> None:
    for value in values:
        if is_placeholder_query(value):
            continue
        add_unique_query(target, value, seen)


def build_seed_queries(
    *,
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    current_route_queries: Sequence[str] | None = None,
    removed_route_queries: Sequence[str] | None = None,
    added_route_queries: Sequence[str] | None = None,
) -> list[str]:
    current_queries: list[str] = []
    seen_queries: set[str] = set()

    add_many_queries(current_queries, current_route_queries or [], seen_queries)

    for removed_query in removed_route_queries or []:
        remove_query(current_queries, removed_query)
        seen_queries.discard(normalize_query(removed_query))

    if starting_point_address.strip():
        remove_query(current_queries, starting_point_address)
        current_queries.insert(0, starting_point_address.strip())
        seen_queries = {normalize_query(query) for query in current_queries}

    add_many_queries(current_queries, required_places or [], seen_queries)
    add_many_queries(current_queries, route_queries or [], seen_queries)
    add_many_queries(current_queries, added_route_queries or [], seen_queries)

    return current_queries


def fill_route_queries_from_candidates(
    *,
    current_queries: list[str],
    route_description: str,
    context_messages: Sequence[str] | None,
    accommodation_preference: str | None,
    candidate_places: Sequence[object] | None,
    minimum_points: int,
    maximum_points: int,
) -> list[str]:
    seen_queries = {normalize_query(query) for query in current_queries}
    places = list(candidate_places or [])
    sochi_places = [place for place in places if looks_like_sochi_place(place)]
    if sochi_places:
        places = sochi_places

    combined_text = " ".join(
        item.strip()
        for item in [route_description, *(context_messages or [])]
        if item and item.strip()
    ).lower()
    categories = infer_categories(route_description, context_messages, accommodation_preference)
    target_count = min(maximum_points, max(minimum_points, len(current_queries)))

    for category in categories:
        if len(current_queries) >= target_count:
            break

        next_query = pick_best_place(places, category, combined_text, seen_queries)
        if next_query:
            add_unique_query(current_queries, next_query, seen_queries)

    if len(current_queries) < target_count:
        generic_candidates = sorted(
            (
                (place_score(place, "attractions", combined_text), build_place_query(place))
                for place in places
            ),
            key=lambda item: item[0],
            reverse=True,
        )

        for _score, query in generic_candidates:
            if len(current_queries) >= target_count:
                break
            add_unique_query(current_queries, query, seen_queries)

    return current_queries[:maximum_points]


def merge_generated_route(
    *,
    generated_route_queries: Sequence[str] | None,
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    removed_route_queries: Sequence[str] | None = None,
    added_route_queries: Sequence[str] | None = None,
) -> list[str]:
    current_queries: list[str] = []
    seen_queries: set[str] = set()

    add_many_queries(
        current_queries,
        [starting_point_address] if starting_point_address.strip() else [],
        seen_queries,
    )
    add_many_queries(current_queries, required_places or [], seen_queries)
    add_many_queries(current_queries, route_queries or [], seen_queries)
    add_many_queries(current_queries, added_route_queries or [], seen_queries)
    add_many_queries(current_queries, generated_route_queries or [], seen_queries)

    for removed_query in removed_route_queries or []:
        remove_query(current_queries, removed_query)

    return current_queries


def generate_route_queries_from_candidates(
    *,
    route_description: str = "",
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    current_route_queries: Sequence[str] | None = None,
    removed_route_queries: Sequence[str] | None = None,
    added_route_queries: Sequence[str] | None = None,
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
    candidate_places: Sequence[object] | None = None,
    latest_user_message: str = "",
    minimum_points: int = ROUTE_MINIMUM_POINTS,
    maximum_points: int = ROUTE_MAXIMUM_POINTS,
) -> list[str]:
    current_queries = build_seed_queries(
        starting_point_address=starting_point_address,
        required_places=required_places,
        route_queries=route_queries,
        current_route_queries=current_route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
    )

    if (
        len(current_queries) >= minimum_points
        and not latest_user_message.strip()
        and not list(removed_route_queries or [])
        and not list(added_route_queries or [])
    ):
        return current_queries[:maximum_points]

    return fill_route_queries_from_candidates(
        current_queries=current_queries,
        route_description=route_description,
        context_messages=context_messages,
        accommodation_preference=accommodation_preference,
        candidate_places=candidate_places,
        minimum_points=minimum_points,
        maximum_points=maximum_points,
    )


def generate_route_queries_for_request(
    db: Session,
    *,
    user_id: int | None = None,
    route_description: str = "",
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    current_route_queries: Sequence[str] | None = None,
    removed_route_queries: Sequence[str] | None = None,
    added_route_queries: Sequence[str] | None = None,
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
    latest_user_message: str = "",
) -> RouteGenerationResult:
    from services.partner_route_recommendations import (
        blend_partner_places_into_route,
        collect_partner_route_candidates,
        persist_partner_route_generation_events,
    )

    try:
        partner_candidates = collect_partner_route_candidates(
            db,
            route_description=route_description,
            context_messages=context_messages,
            accommodation_preference=accommodation_preference,
            limit=8,
        )
    except Exception as exc:
        logger.warning("Partner route recommendations skipped: %s", exc)
        partner_candidates = []

    if partner_candidates:
        logger.warning(
            "Partner route recommendations prepared: %s",
            [
                {
                    "name": candidate.name,
                    "address": candidate.formatted_address,
                    "score": candidate.score,
                    "reason": candidate.reason,
                }
                for candidate in partner_candidates
            ],
        )

    gemini_payload = generate_route_queries_with_gemini(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        current_route_queries=current_route_queries,
        route_queries=route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
        partner_places=partner_candidates,
        accommodation_preference=accommodation_preference,
        context_messages=context_messages,
        latest_user_message=latest_user_message,
    )
    if isinstance(gemini_payload, dict):
        raw_gemini_queries = gemini_payload.get("routeQueries") or []
        gemini_description = str(gemini_payload.get("routeDescription") or "").strip()
        gemini_point_descriptions = normalize_route_point_descriptions(
            gemini_payload.get("routePointDescriptions") or {}
        )
    else:
        raw_gemini_queries = gemini_payload or []
        gemini_description = str(getattr(gemini_payload, "route_description", "") or "").strip()
        gemini_point_descriptions = normalize_route_point_descriptions(
            getattr(gemini_payload, "route_point_descriptions", {})
        )

    gemini_queries = [
        str(query).strip()
        for query in raw_gemini_queries
        if str(query).strip()
    ]

    if gemini_queries:
        merged_gemini_queries = merge_generated_route(
            generated_route_queries=gemini_queries,
            starting_point_address=starting_point_address,
            required_places=required_places,
            route_queries=route_queries,
            removed_route_queries=removed_route_queries,
            added_route_queries=added_route_queries,
        )
        merged_gemini_queries = blend_partner_places_into_route(
            merged_gemini_queries,
            partner_candidates,
            removed_route_queries=removed_route_queries,
            maximum_points=ROUTE_MAXIMUM_POINTS,
            max_partner_places=2,
        )
        try:
            persist_partner_route_generation_events(
                db,
                partner_candidates=partner_candidates,
                final_route_queries=merged_gemini_queries,
                user_id=user_id,
                source="gemini_route_generation",
            )
        except Exception as exc:
            logger.warning("Partner route statistics logging skipped: %s", exc)
        logger.warning("Route generation is using Gemini result: %s", merged_gemini_queries)

        final_queries = merged_gemini_queries[:ROUTE_MAXIMUM_POINTS]
        final_description = gemini_description or build_route_description_fallback(
            route_queries=final_queries,
            route_description=route_description,
            starting_point_address=starting_point_address,
            accommodation_preference=accommodation_preference,
        )
        return RouteGenerationResult(
            final_queries,
            final_description,
            build_route_point_descriptions(
                route_queries=final_queries,
                generated_descriptions=gemini_point_descriptions,
                route_description=final_description,
                starting_point_address=starting_point_address,
            ),
        )

    logger.warning("Route generation fell back without Gemini result")
    fallback_queries = generate_route_queries_from_candidates(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        route_queries=route_queries,
        current_route_queries=current_route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
        accommodation_preference=accommodation_preference,
        context_messages=context_messages,
        candidate_places=partner_candidates,
        latest_user_message=latest_user_message,
    )
    try:
        persist_partner_route_generation_events(
            db,
            partner_candidates=partner_candidates,
            final_route_queries=fallback_queries,
            user_id=user_id,
            source="fallback_route_generation",
        )
    except Exception as exc:
        logger.warning("Partner route statistics logging skipped: %s", exc)

    fallback_description = build_route_description_fallback(
        route_queries=fallback_queries,
        route_description=route_description,
        starting_point_address=starting_point_address,
        accommodation_preference=accommodation_preference,
    )
    return RouteGenerationResult(
        fallback_queries,
        fallback_description,
        build_route_point_descriptions(
            route_queries=fallback_queries,
            route_description=fallback_description or route_description,
            starting_point_address=starting_point_address,
        ),
    )
