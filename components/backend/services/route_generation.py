from __future__ import annotations

import logging
import re
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from services.gemini_route_planner import generate_route_queries_with_gemini

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
logger = logging.getLogger(__name__)


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
) -> list[str]:
    del db

    gemini_queries = generate_route_queries_with_gemini(
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

    if gemini_queries:
        merged_gemini_queries = merge_generated_route(
            generated_route_queries=gemini_queries,
            starting_point_address=starting_point_address,
            required_places=required_places,
            route_queries=route_queries,
            removed_route_queries=removed_route_queries,
            added_route_queries=added_route_queries,
        )
        logger.warning("Route generation is using Gemini result: %s", merged_gemini_queries)

        return merged_gemini_queries[:ROUTE_MAXIMUM_POINTS]

    logger.warning("Route generation fell back without Gemini result")
    return generate_route_queries_from_candidates(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        route_queries=route_queries,
        current_route_queries=current_route_queries,
        removed_route_queries=removed_route_queries,
        added_route_queries=added_route_queries,
        accommodation_preference=accommodation_preference,
        context_messages=context_messages,
        candidate_places=[],
        latest_user_message=latest_user_message,
    )
