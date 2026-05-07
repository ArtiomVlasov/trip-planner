from __future__ import annotations

import re
from typing import Iterable, Sequence

from sqlalchemy.orm import Session

from models import Place

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


def normalize_query(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" \n\t,.;:!?").lower()


def add_unique_query(target: list[str], value: str, seen: set[str]) -> None:
    normalized = normalize_query(value)

    if not normalized or normalized in seen:
        return

    seen.add(normalized)
    target.append(value.strip())


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


def generate_route_queries_from_candidates(
    *,
    route_description: str = "",
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
    candidate_places: Sequence[object] | None = None,
    minimum_points: int = 3,
    maximum_points: int = 5,
) -> list[str]:
    current_queries: list[str] = []
    seen_queries: set[str] = set()

    explicit_queries = list(route_queries or [])

    if explicit_queries:
        for query in explicit_queries:
            add_unique_query(current_queries, query, seen_queries)
    else:
        add_unique_query(current_queries, starting_point_address, seen_queries)
        for required_place in required_places or []:
            add_unique_query(current_queries, required_place, seen_queries)

    if len(current_queries) >= 2:
        return current_queries[:maximum_points]

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
    target_count = min(maximum_points, max(minimum_points, len(current_queries) + 2))

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


def generate_route_queries_for_request(
    db: Session,
    *,
    route_description: str = "",
    starting_point_address: str = "",
    required_places: Sequence[str] | None = None,
    route_queries: Sequence[str] | None = None,
    accommodation_preference: str | None = None,
    context_messages: Sequence[str] | None = None,
) -> list[str]:
    candidate_places = db.query(Place).all()

    return generate_route_queries_from_candidates(
        route_description=route_description,
        starting_point_address=starting_point_address,
        required_places=required_places,
        route_queries=route_queries,
        accommodation_preference=accommodation_preference,
        context_messages=context_messages,
        candidate_places=candidate_places,
    )
