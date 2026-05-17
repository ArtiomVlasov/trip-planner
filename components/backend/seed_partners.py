"""
Seed script for partner-related CRM tables.

Creates sample data for:
  - places (partner-owned locations)
  - partners
  - partner_places (links)
  - route_insertion_rules
  - event_logs
  - settlements

Usage:
    cd components/backend
    python seed_partners.py
"""

import sys
import os
from decimal import Decimal
from datetime import datetime, timedelta

# Ensure the backend package is on the path
sys.path.insert(0, os.path.dirname(__file__))

from db import SessionLocal, engine, Base
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from models import (
    EventLog,
    Place,
    Partner,
    PartnerPlace,
    RouteInsertionRule,
)
from services.partner_auth import hash_password

# ──────────────────────────────────────────────
#  Raw seed data
# ──────────────────────────────────────────────

PLACES = [
    {
        "place_id": "partner_hotel_marins_park",
        "name": "Marins Park Hotel Sochi",
        "formatted_address": "ул. Морская, 1, Сочи",
        "lat": 43.5855,
        "lng": 39.7203,
        "types": ["hotel", "lodging"],
        "rating": 4.3,
        "user_ratings_total": 1200,
    },
    {
        "place_id": "partner_hotel_pullman",
        "name": "Pullman Sochi Centre",
        "formatted_address": "ул. Орджоникидзе, 11А, Сочи",
        "lat": 43.5900,
        "lng": 39.7260,
        "types": ["hotel", "lodging"],
        "rating": 4.5,
        "user_ratings_total": 980,
    },
    {
        "place_id": "partner_rest_white_rabbit",
        "name": "White Rabbit Sochi",
        "formatted_address": "Курортный пр., 18, Сочи",
        "lat": 43.5720,
        "lng": 39.7280,
        "types": ["restaurant", "food"],
        "rating": 4.7,
        "user_ratings_total": 540,
    },
    {
        "place_id": "partner_rest_syr",
        "name": "Сыроварня",
        "formatted_address": "ул. Навагинская, 12, Сочи",
        "lat": 43.5870,
        "lng": 39.7195,
        "types": ["restaurant", "food", "cafe"],
        "rating": 4.4,
        "user_ratings_total": 870,
    },
    {
        "place_id": "partner_rest_barashki",
        "name": "Барашки",
        "formatted_address": "ул. Войкова, 1, Сочи",
        "lat": 43.5830,
        "lng": 39.7170,
        "types": ["restaurant", "food"],
        "rating": 4.6,
        "user_ratings_total": 620,
    },
    {
        "place_id": "partner_activity_skypark",
        "name": "Skypark AJ Hackett Sochi",
        "formatted_address": "Краснополянское шоссе, Сочи",
        "lat": 43.5270,
        "lng": 40.0050,
        "types": ["activity", "tourist_attraction", "amusement_park"],
        "rating": 4.8,
        "user_ratings_total": 3200,
    },
    {
        "place_id": "partner_activity_aquapark",
        "name": "Аквапарк «Маяк»",
        "formatted_address": "ул. Приморская, 3/7, Сочи",
        "lat": 43.5780,
        "lng": 39.7220,
        "types": ["activity", "amusement_park"],
        "rating": 4.1,
        "user_ratings_total": 1500,
    },
    {
        "place_id": "partner_activity_dendrary",
        "name": "Дендрарий",
        "formatted_address": "Курортный пр., 74, Сочи",
        "lat": 43.5680,
        "lng": 39.7410,
        "types": ["activity", "park", "tourist_attraction"],
        "rating": 4.6,
        "user_ratings_total": 4100,
    },
    {
        "place_id": "partner_transfer_sochi_taxi",
        "name": "Sochi VIP Transfer",
        "formatted_address": "Аэропорт Сочи, Адлер",
        "lat": 43.4500,
        "lng": 39.9570,
        "types": ["transfer", "taxi"],
        "rating": 4.2,
        "user_ratings_total": 310,
    },
    {
        "place_id": "partner_transfer_mountain",
        "name": "Mountain Shuttle",
        "formatted_address": "Красная Поляна, Сочи",
        "lat": 43.6810,
        "lng": 40.2040,
        "types": ["transfer", "bus_station"],
        "rating": 4.0,
        "user_ratings_total": 180,
    },
]


PARTNERS = [
    {
        "name": "Marins Park Hotel",
        "login": "marins_partner",
            "password": "Marins123!",
        "category": "hotel",
        "city": "sochi",
        "contact_name": "Иван Петров",
        "contact_email": "partners@marinspark.ru",
    },
    {
        "name": "Pullman Sochi Centre",
        "login": "pullman_partner",
        "password": "Pullman123!",
        "category": "hotel",
        "city": "sochi",
        "contact_name": "Анна Смирнова",
        "contact_email": "sales@pullman-sochi.com",
    },
    {
        "name": "White Rabbit Group",
        "login": "white_rabbit_partner",
        "password": "WhiteRabbit123!",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Дмитрий Козлов",
        "contact_email": "sochi@whiterabbit.ru",
    },
    {
        "name": "Сыроварня Сочи",
        "login": "syrovarnya_partner",
        "password": "Syrovarnya123!",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Елена Волкова",
        "contact_email": "info@syrovarnya-sochi.ru",
    },
    {
        "name": "Барашки Ресторан",
        "login": "barashki_partner",
        "password": "Barashki123!",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Олег Баранов",
        "contact_email": "barashki@mail.ru",
    },
    {
        "name": "Skypark AJ Hackett",
        "login": "skypark_partner",
        "password": "Skypark123!",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Сергей Орлов",
        "contact_email": "b2b@skypark.ru",
    },
    {
        "name": "Аквапарк Маяк",
        "login": "mayak_partner",
        "password": "Mayak123!",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Мария Лебедева",
        "contact_email": "partners@mayak-aqua.ru",
    },
    {
        "name": "Дендрарий Сочи",
        "login": "dendrary_partner",
        "password": "Dendrary123!",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Наталья Зелёная",
        "contact_email": "admin@dendrary-sochi.ru",
    },
    {
        "name": "Sochi VIP Transfer",
        "login": "vip_transfer_partner",
        "password": "VipTransfer123!",
        "category": "transfer",
        "city": "sochi",
        "contact_name": "Алексей Водитель",
        "contact_email": "vip@sochi-transfer.ru",
    },
    {
        "name": "Mountain Shuttle",
        "login": "mountain_shuttle_partner",
        "password": "Mountain123!",
        "category": "transfer",
        "city": "sochi",
        "contact_name": "Павел Горный",
        "contact_email": "info@mountain-shuttle.ru",
    },
]

# partner index -> place index (1-to-1 for simplicity)
PARTNER_PLACE_MAP = [
    # (partner_idx, place_idx, relationship_type, commission_type, commission_value, priority_weight)
    (0, 0, "owner", "cpa", Decimal("500.00"), 1.2),
    (1, 1, "owner", "cpa", Decimal("700.00"), 1.5),
    (2, 2, "owner", "cpl", Decimal("150.00"), 1.3),
    (3, 3, "owner", "cpl", Decimal("100.00"), 1.0),
    (4, 4, "owner", "cpl", Decimal("120.00"), 1.1),
    (5, 5, "owner", "cpa", Decimal("300.00"), 1.8),
    (6, 6, "sponsor", "cpa", Decimal("200.00"), 1.0),
    (7, 7, "owner", "fixed", Decimal("5000.00"), 1.4),
    (8, 8, "owner", "cpl", Decimal("80.00"), 1.0),
    (9, 9, "reseller", "cpl", Decimal("60.00"), 0.9),
]

ROUTE_RULES = [
    # (partner_place_idx, trigger_type, trigger_value, max_detour_min, max_detour_km, daily_cap, trip_cap, priority_boost)
    (0, "nearby", "2000", 15, 3.0, 2, 1, 0.3),       # hotel nearby within 2km
    (1, "nearby", "2500", 15, 4.0, 2, 1, 0.4),       # hotel nearby within 2.5km
    (2, "time_slot", "12:00-14:00", 10, 2.0, 3, 2, 0.5),  # restaurant at lunch
    (3, "time_slot", "12:00-14:00", 10, 1.5, 3, 2, 0.3),  # restaurant at lunch
    (4, "time_slot", "18:00-21:00", 10, 2.0, 2, 1, 0.4),  # restaurant at dinner
    (5, "after_poi_type", "beach", 20, 5.0, 1, 1, 0.8),   # skypark after beach
    (6, "time_slot", "10:00-16:00", 15, 2.0, 2, 1, 0.2),  # aquapark daytime
    (7, "after_poi_type", "park", 10, 1.0, 3, 2, 0.6),    # dendrary after park
    (8, "time_slot", "06:00-10:00", 30, None, 5, 3, 0.1),  # transfer morning
    (9, "time_slot", "08:00-12:00", 40, None, 3, 2, 0.1),  # mountain shuttle morning
]

MOCK_STATS_SOURCE = "mock_partner_stats"


def seed_mock_partner_stats(db, partner_places_by_index):
    db.query(EventLog).filter(
        EventLog.attribution_key.like(f"{MOCK_STATS_SOURCE}:%")
    ).delete(synchronize_session=False)

    now = datetime.utcnow().replace(hour=12, minute=0, second=0, microsecond=0)
    events = []
    for place_index, partner_place in enumerate(partner_places_by_index):
        base_impressions = 2 + (place_index % 4)
        for day_offset in range(29, -1, -1):
            event_date = now - timedelta(days=day_offset)
            day_index = 29 - day_offset
            wave = (day_index + place_index) % 5
            spike = 6 if day_offset <= 2 and place_index in {2, 5, 7} else 0
            impressions_count = base_impressions + wave + spike
            clicks_count = max(1 if day_index % 4 == 0 else 0, impressions_count // 3)

            for item_index in range(impressions_count):
                events.append(
                    EventLog(
                        partner_id=partner_place.partner_id,
                        place_id=partner_place.place_id,
                        partner_place_id=partner_place.id,
                        event_type="impression",
                        event_ts=event_date + timedelta(minutes=item_index),
                        attribution_key=(
                            f"{MOCK_STATS_SOURCE}:{partner_place.id}:"
                            f"{event_date.date()}:impression:{item_index}"
                        ),
                        metadata_json={"source": MOCK_STATS_SOURCE},
                    )
                )

            for item_index in range(clicks_count):
                events.append(
                    EventLog(
                        partner_id=partner_place.partner_id,
                        place_id=partner_place.place_id,
                        partner_place_id=partner_place.id,
                        event_type="click",
                        event_ts=event_date + timedelta(hours=1, minutes=item_index),
                        attribution_key=(
                            f"{MOCK_STATS_SOURCE}:{partner_place.id}:"
                            f"{event_date.date()}:click:{item_index}"
                        ),
                        metadata_json={"source": MOCK_STATS_SOURCE},
                    )
                )

    db.add_all(events)
    return len(events)


def seed():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        places_by_index = []
        for place_data in PLACES:
            place = db.query(Place).filter(Place.place_id == place_data["place_id"]).first()
            if place is None:
                place = Place(place_id=place_data["place_id"])
                db.add(place)

            place.name = place_data["name"]
            place.formatted_address = place_data["formatted_address"]
            place.location = from_shape(
                Point(place_data["lng"], place_data["lat"]),
                srid=4326,
            )
            place.types = place_data["types"]
            place.rating = place_data["rating"]
            place.user_ratings_total = place_data["user_ratings_total"]
            place.source = "partner"
            places_by_index.append(place)

        db.flush()

        partners_by_index = []
        for partner_data in PARTNERS:
            partner = db.query(Partner).filter(Partner.login == partner_data["login"]).first()
            if partner is None:
                partner = Partner(login=partner_data["login"])
                db.add(partner)

            partner.name = partner_data["name"]
            partner.password = hash_password(partner_data["password"])
            partner.category = partner_data["category"]
            partner.status = "active"
            partner.city = partner_data["city"]
            partner.contact_name = partner_data["contact_name"]
            partner.contact_email = partner_data["contact_email"]
            partners_by_index.append(partner)

        db.flush()

        partner_places_by_index = []
        for (
            partner_idx,
            place_idx,
            relationship_type,
            commission_type,
            commission_value,
            priority_weight,
        ) in PARTNER_PLACE_MAP:
            partner = partners_by_index[partner_idx]
            place = places_by_index[place_idx]
            place.partner_id = partner.id

            partner_place = (
                db.query(PartnerPlace)
                .filter(
                    PartnerPlace.partner_id == partner.id,
                    PartnerPlace.place_id == place.place_id,
                )
                .first()
            )
            if partner_place is None:
                partner_place = PartnerPlace(
                    partner_id=partner.id,
                    place_id=place.place_id,
                )
                db.add(partner_place)

            partner_place.relationship_type = relationship_type
            partner_place.commission_type = commission_type
            partner_place.commission_value = commission_value
            partner_place.priority_weight = priority_weight
            partner_place.is_promotable = True
            partner_place.status = "active"
            partner_places_by_index.append(partner_place)

        db.flush()

        for (
            partner_place_idx,
            trigger_type,
            trigger_value,
            max_detour_min,
            max_detour_km,
            daily_cap,
            trip_cap,
            priority_boost,
        ) in ROUTE_RULES:
            partner_place = partner_places_by_index[partner_place_idx]
            rule = (
                db.query(RouteInsertionRule)
                .filter(
                    RouteInsertionRule.partner_place_id == partner_place.id,
                    RouteInsertionRule.trigger_type == trigger_type,
                    RouteInsertionRule.trigger_value == trigger_value,
                )
                .first()
            )
            if rule is None:
                rule = RouteInsertionRule(
                    partner_id=partner_place.partner_id,
                    partner_place_id=partner_place.id,
                    trigger_type=trigger_type,
                    trigger_value=trigger_value,
                )
                db.add(rule)

            rule.partner_id = partner_place.partner_id
            rule.max_detour_minutes = max_detour_min
            rule.max_detour_km = max_detour_km
            rule.daily_cap = daily_cap
            rule.trip_cap = trip_cap
            rule.priority_boost = priority_boost
            rule.status = "active"

        mock_events_count = seed_mock_partner_stats(db, partner_places_by_index)

        db.commit()
        print(
            f"Seeded {len(PLACES)} places, {len(PARTNERS)} partners, "
            f"{len(PARTNER_PLACE_MAP)} partner places, {len(ROUTE_RULES)} route rules "
            f"and {mock_events_count} mock stats events."
        )
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
