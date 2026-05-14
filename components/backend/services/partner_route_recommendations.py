from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Sequence

from sqlalchemy.orm import Session, joinedload

from models import EventLog, Partner, PartnerPlace, Place, RouteInsertionRule
from services.route_generation import (
    CATEGORY_KEYWORDS,
    CATEGORY_TYPES,
    build_place_query,
    infer_categories,
    normalize_query,
    place_text,
    place_types,
)


@dataclass(frozen=True)
class PartnerRouteCandidate:
    partner_place_id: int
    partner_id: int
    place_id: str
    partner_name: str
    name: str
    formatted_address: str
    types: tuple[str, ...]
    rating: float | None
    priority_weight: float
    commission_type: str | None
    score: float
    reason: str


def _is_currently_promotable(partner_place: PartnerPlace, today: date) -> bool:
    if partner_place.status != "active" or not partner_place.is_promotable:
        return False
    if partner_place.start_date and partner_place.start_date > today:
        return False
    if partner_place.end_date and partner_place.end_date < today:
        return False
    return True


def _partner_place_rules(partner_place: PartnerPlace) -> list[RouteInsertionRule]:
    rules = getattr(partner_place, "route_rules", None)
    if rules is None:
        return []
    return [
        rule
        for rule in rules
        if getattr(rule, "status", None) == "active"
    ]


def _matches_category(place: Place, category: str) -> bool:
    return bool(place_types(place) & CATEGORY_TYPES.get(category, set()))


def _score_partner_place(
    partner_place: PartnerPlace,
    *,
    categories: Sequence[str],
    combined_text: str,
) -> tuple[float, str]:
    place = partner_place.place
    if place is None:
        return 0.0, "missing place"

    score = float(partner_place.priority_weight or 0.0) * 3.0
    if getattr(place, "rating", None):
        score += min(float(place.rating), 5.0)

    matched_categories = [
        category
        for category in categories
        if _matches_category(place, category)
    ]
    score += len(matched_categories) * 4.0

    current_text = place_text(place)
    for category, keywords in CATEGORY_KEYWORDS:
        if category not in categories:
            continue
        for keyword in keywords:
            if keyword in combined_text and keyword in current_text:
                score += 1.5

    rule_reasons: list[str] = []
    for rule in _partner_place_rules(partner_place):
        score += float(rule.priority_boost or 0.0) * 2.0
        if rule.trigger_type == "after_poi_type" and rule.trigger_value in combined_text:
            score += 2.0
            rule_reasons.append(f"matches {rule.trigger_value}")
        elif rule.trigger_type == "time_slot":
            rule_reasons.append(f"time slot {rule.trigger_value}")
        elif rule.trigger_type == "nearby":
            rule_reasons.append("nearby")

    reason_parts = []
    if matched_categories:
        reason_parts.append(f"category: {', '.join(matched_categories)}")
    reason_parts.extend(rule_reasons)

    return score, "; ".join(reason_parts) or "partner priority"


def collect_partner_route_candidates(
    db: Session,
    *,
    route_description: str = "",
    context_messages: Sequence[str] | None = None,
    accommodation_preference: str | None = None,
    limit: int = 8,
) -> list[PartnerRouteCandidate]:
    today = date.today()
    combined_text = " ".join(
        item.strip()
        for item in [route_description, *(context_messages or [])]
        if item and item.strip()
    ).lower()
    categories = infer_categories(route_description, context_messages, accommodation_preference)

    partner_places = (
        db.query(PartnerPlace)
        .join(Partner, Partner.id == PartnerPlace.partner_id)
        .options(
            joinedload(PartnerPlace.place),
            joinedload(PartnerPlace.partner),
            joinedload(PartnerPlace.route_rules),
        )
        .filter(
            PartnerPlace.status == "active",
            PartnerPlace.is_promotable == True,
            Partner.status == "active",
            Partner.city == "sochi",
        )
        .all()
    )

    candidates: list[PartnerRouteCandidate] = []
    for partner_place in partner_places:
        if not _is_currently_promotable(partner_place, today) or partner_place.place is None:
            continue

        place = partner_place.place
        score, reason = _score_partner_place(
            partner_place,
            categories=categories,
            combined_text=combined_text,
        )
        if score <= 0:
            continue

        candidates.append(
            PartnerRouteCandidate(
                partner_place_id=int(partner_place.id),
                partner_id=int(partner_place.partner_id),
                place_id=str(partner_place.place_id),
                partner_name=str(getattr(partner_place.partner, "name", "") or ""),
                name=str(place.name or ""),
                formatted_address=str(place.formatted_address or ""),
                types=tuple(str(place_type) for place_type in (place.types or [])),
                rating=float(place.rating) if place.rating is not None else None,
                priority_weight=float(partner_place.priority_weight or 0.0),
                commission_type=str(partner_place.commission_type) if partner_place.commission_type else None,
                score=round(score, 3),
                reason=reason,
            )
        )

    candidates.sort(key=lambda candidate: candidate.score, reverse=True)
    return candidates[: max(0, limit)]


def blend_partner_places_into_route(
    route_queries: Sequence[str],
    partner_candidates: Sequence[PartnerRouteCandidate],
    *,
    removed_route_queries: Sequence[str] | None = None,
    maximum_points: int = 10,
    max_partner_places: int = 2,
) -> list[str]:
    result = [str(query).strip() for query in route_queries if str(query).strip()]
    seen = {normalize_query(query) for query in result}
    removed = {normalize_query(query) for query in (removed_route_queries or [])}

    inserted = 0
    for candidate in partner_candidates:
        if inserted >= max_partner_places or len(result) >= maximum_points:
            break

        query = build_place_query(candidate)
        normalized_query = normalize_query(query)
        normalized_name = normalize_query(candidate.name)

        if not normalized_query or normalized_query in removed or normalized_name in removed:
            continue
        if normalized_query in seen or normalized_name in seen:
            continue
        if any(normalized_name and normalized_name in normalize_query(existing) for existing in result):
            continue

        insert_at = min(len(result), max(1, len(result) - 1))
        result.insert(insert_at, query)
        seen.add(normalized_query)
        inserted += 1

    return result[:maximum_points]


def _route_contains_partner_candidate(
    route_queries: Sequence[str],
    candidate: PartnerRouteCandidate,
) -> bool:
    candidate_query = normalize_query(build_place_query(candidate))
    candidate_name = normalize_query(candidate.name)
    candidate_address = normalize_query(candidate.formatted_address)

    for route_query in route_queries:
        normalized_route_query = normalize_query(route_query)
        if not normalized_route_query:
            continue
        if candidate_query and normalized_route_query == candidate_query:
            return True
        if candidate_name and candidate_name in normalized_route_query:
            return True
        if candidate_address and candidate_address in normalized_route_query:
            return True

    return False


def persist_partner_route_generation_events(
    db: Session,
    *,
    partner_candidates: Sequence[PartnerRouteCandidate],
    final_route_queries: Sequence[str],
    user_id: int | None = None,
    source: str = "route_generation",
) -> None:
    if not partner_candidates:
        return

    events: list[EventLog] = []
    for candidate in partner_candidates:
        common_payload = {
            "user_id": user_id,
            "partner_id": candidate.partner_id,
            "place_id": candidate.place_id,
            "partner_place_id": candidate.partner_place_id,
        }
        events.append(
            EventLog(
                **common_payload,
                event_type="impression",
                metadata_json={
                    "source": source,
                    "reason": candidate.reason,
                    "score": candidate.score,
                },
            )
        )

        if _route_contains_partner_candidate(final_route_queries, candidate):
            events.append(
                EventLog(
                    **common_payload,
                    event_type="click",
                    metadata_json={
                        "source": source,
                        "reason": candidate.reason,
                        "score": candidate.score,
                        "action": "included_in_generated_route",
                    },
                )
            )

    db.add_all(events)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
