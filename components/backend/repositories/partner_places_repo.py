from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy import case, distinct, func
from sqlalchemy.orm import Session, joinedload

from models import EventLog, PartnerPlace


def get_partner_place_by_id(db: Session, pp_id: int) -> Optional[PartnerPlace]:
    return (
        db.query(PartnerPlace)
        .options(joinedload(PartnerPlace.place))
        .filter(PartnerPlace.id == pp_id)
        .first()
    )


def get_partner_places(
    db: Session,
    partner_id: Optional[int] = None,
    place_id: Optional[str] = None,
    status: Optional[str] = None,
) -> List[PartnerPlace]:
    q = db.query(PartnerPlace).options(joinedload(PartnerPlace.place))
    if partner_id:
        q = q.filter(PartnerPlace.partner_id == partner_id)
    if place_id:
        q = q.filter(PartnerPlace.place_id == place_id)
    if status:
        q = q.filter(PartnerPlace.status == status)
    return q.order_by(PartnerPlace.id.desc()).all()


def create_partner_place(db: Session, data: dict) -> PartnerPlace:
    pp = PartnerPlace(**data)
    db.add(pp)
    try:
        db.commit()
        db.refresh(pp)
    except Exception:
        db.rollback()
        raise
    return pp


def update_partner_place(db: Session, pp: PartnerPlace, data: dict) -> PartnerPlace:
    for key, value in data.items():
        if value is not None:
            setattr(pp, key, value)
    try:
        db.commit()
        db.refresh(pp)
    except Exception:
        db.rollback()
        raise
    return pp


def get_partner_place_stats_map(
    db: Session,
    partner_id: int,
) -> Dict[int, Dict[str, Any]]:
    rows = (
        db.query(
            EventLog.partner_place_id.label("partner_place_id"),
            func.sum(case((EventLog.event_type == "impression", 1), else_=0)).label(
                "impressions_count"
            ),
            func.sum(case((EventLog.event_type == "click", 1), else_=0)).label(
                "clicks_count"
            ),
            func.sum(case((EventLog.event_type == "lead", 1), else_=0)).label(
                "leads_count"
            ),
            func.sum(case((EventLog.event_type == "booking", 1), else_=0)).label(
                "bookings_count"
            ),
            func.count(distinct(EventLog.user_id)).label("unique_users_count"),
            func.count(distinct(EventLog.trip_id)).label("unique_trips_count"),
            func.max(EventLog.event_ts).label("last_event_at"),
        )
        .filter(
            EventLog.partner_id == partner_id,
            EventLog.partner_place_id.isnot(None),
        )
        .group_by(EventLog.partner_place_id)
        .all()
    )

    daily_series_by_partner_place_id = get_partner_daily_event_series_map(
        db,
        partner_id=partner_id,
    )

    stats_by_partner_place_id: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        daily_series = daily_series_by_partner_place_id.get(int(row.partner_place_id), {})
        stats_by_partner_place_id[int(row.partner_place_id)] = build_partner_place_stats_payload(
            impressions_count=row.impressions_count,
            clicks_count=row.clicks_count,
            leads_count=row.leads_count,
            bookings_count=row.bookings_count,
            unique_users_count=row.unique_users_count,
            unique_trips_count=row.unique_trips_count,
            last_event_at=row.last_event_at,
            impressions_daily=daily_series.get("impression"),
            clicks_daily=daily_series.get("click"),
        )

    return stats_by_partner_place_id


def get_partner_overall_stats(
    db: Session,
    partner_id: int,
) -> Dict[str, Any]:
    row = (
        db.query(
            func.sum(case((EventLog.event_type == "impression", 1), else_=0)).label(
                "impressions_count"
            ),
            func.sum(case((EventLog.event_type == "click", 1), else_=0)).label(
                "clicks_count"
            ),
            func.sum(case((EventLog.event_type == "lead", 1), else_=0)).label(
                "leads_count"
            ),
            func.sum(case((EventLog.event_type == "booking", 1), else_=0)).label(
                "bookings_count"
            ),
            func.count(distinct(EventLog.user_id)).label("unique_users_count"),
            func.count(distinct(EventLog.trip_id)).label("unique_trips_count"),
            func.max(EventLog.event_ts).label("last_event_at"),
        )
        .filter(EventLog.partner_id == partner_id)
        .one()
    )

    daily_series = get_partner_daily_event_series_map(
        db,
        partner_id=partner_id,
        group_by_partner_place=False,
    ).get(0, {})

    return build_partner_place_stats_payload(
        impressions_count=row.impressions_count,
        clicks_count=row.clicks_count,
        leads_count=row.leads_count,
        bookings_count=row.bookings_count,
        unique_users_count=row.unique_users_count,
        unique_trips_count=row.unique_trips_count,
        last_event_at=row.last_event_at,
        impressions_daily=daily_series.get("impression"),
        clicks_daily=daily_series.get("click"),
    )


def get_partner_daily_event_series_map(
    db: Session,
    *,
    partner_id: int,
    days: int = 30,
    group_by_partner_place: bool = True,
) -> Dict[int, Dict[str, List[Dict[str, Any]]]]:
    start_date = date.today() - timedelta(days=max(days - 1, 0))
    day_expr = func.date(EventLog.event_ts)
    group_columns = [EventLog.event_type, day_expr]
    select_columns = [
        EventLog.event_type.label("event_type"),
        day_expr.label("event_date"),
        func.count(EventLog.id).label("count"),
    ]

    if group_by_partner_place:
        select_columns.insert(0, EventLog.partner_place_id.label("partner_place_id"))
        group_columns.insert(0, EventLog.partner_place_id)

    query = db.query(*select_columns).filter(
        EventLog.partner_id == partner_id,
        EventLog.event_type.in_(("impression", "click")),
        EventLog.event_ts >= start_date,
    )

    if group_by_partner_place:
        query = query.filter(EventLog.partner_place_id.isnot(None))

    rows = query.group_by(*group_columns).all()

    series_map: Dict[int, Dict[str, List[Dict[str, Any]]]] = {}
    for row in rows:
        key = int(row.partner_place_id) if group_by_partner_place else 0
        event_date = row.event_date.isoformat() if hasattr(row.event_date, "isoformat") else str(row.event_date)
        series_map.setdefault(key, {}).setdefault(str(row.event_type), []).append(
            {
                "date": event_date,
                "count": int(row.count or 0),
            }
        )

    return series_map


def build_partner_place_stats_payload(
    impressions_count: Optional[int] = 0,
    clicks_count: Optional[int] = 0,
    leads_count: Optional[int] = 0,
    bookings_count: Optional[int] = 0,
    unique_users_count: Optional[int] = 0,
    unique_trips_count: Optional[int] = 0,
    last_event_at: Optional[datetime] = None,
    impressions_daily: Optional[List[Dict[str, Any]]] = None,
    clicks_daily: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    impressions = int(impressions_count or 0)
    clicks = int(clicks_count or 0)
    leads = int(leads_count or 0)
    bookings = int(bookings_count or 0)

    return {
        "impressions_count": impressions,
        "clicks_count": clicks,
        "leads_count": leads,
        "bookings_count": bookings,
        "unique_users_count": int(unique_users_count or 0),
        "unique_trips_count": int(unique_trips_count or 0),
        "click_through_rate": _calculate_rate(clicks, impressions),
        "lead_conversion_rate": _calculate_rate(leads, impressions),
        "booking_conversion_rate": _calculate_rate(bookings, impressions),
        "last_event_at": last_event_at,
        "impressions_daily": impressions_daily or [],
        "clicks_daily": clicks_daily or [],
    }


def _calculate_rate(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round((part / whole) * 100, 1)
