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
from datetime import date, datetime, timedelta
from decimal import Decimal

# Ensure the backend package is on the path
sys.path.insert(0, os.path.dirname(__file__))

from db import SessionLocal, engine, Base
from models import (
    Place,
    Partner,
    PartnerPlace,
    RouteInsertionRule,
    EventLog,
    Settlement,
)

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
        "category": "hotel",
        "city": "sochi",
        "contact_name": "Иван Петров",
        "contact_email": "partners@marinspark.ru",
    },
    {
        "name": "Pullman Sochi Centre",
        "category": "hotel",
        "city": "sochi",
        "contact_name": "Анна Смирнова",
        "contact_email": "sales@pullman-sochi.com",
    },
    {
        "name": "White Rabbit Group",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Дмитрий Козлов",
        "contact_email": "sochi@whiterabbit.ru",
    },
    {
        "name": "Сыроварня Сочи",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Елена Волкова",
        "contact_email": "info@syrovarnya-sochi.ru",
    },
    {
        "name": "Барашки Ресторан",
        "category": "restaurant",
        "city": "sochi",
        "contact_name": "Олег Баранов",
        "contact_email": "barashki@mail.ru",
    },
    {
        "name": "Skypark AJ Hackett",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Сергей Орлов",
        "contact_email": "b2b@skypark.ru",
    },
    {
        "name": "Аквапарк Маяк",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Мария Лебедева",
        "contact_email": "partners@mayak-aqua.ru",
    },
    {
        "name": "Дендрарий Сочи",
        "category": "activity",
        "city": "sochi",
        "contact_name": "Наталья Зелёная",
        "contact_email": "admin@dendrary-sochi.ru",
    },
    {
        "name": "Sochi VIP Transfer",
        "category": "transfer",
        "city": "sochi",
        "contact_name": "Алексей Водитель",
        "contact_email": "vip@sochi-transfer.ru",
    },
    {
        "name": "Mountain Shuttle",
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


def make_point_wkt(lat: float, lng: float) -> str:
    """Return WKT for a POINT geometry."""
    return f"SRID=4326;POINT({lng} {lat})"


def seed():
    db = SessionLocal()
    try:
        # ── 1. Places ──────────────────────────────
        print("Seeding places …")
        place_objects = []
        for p in PLACES:
            existing = db.query(Place).filter(Place.place_id == p["place_id"]).first()
            if existing:
                print(f"  ⏭  Place '{p['place_id']}' already exists, skipping")
                place_objects.append(existing)
                continue

            place = Place(
                place_id=p["place_id"],
                name=p["name"],
                formatted_address=p["formatted_address"],
                location=make_point_wkt(p["lat"], p["lng"]),
                types=p["types"],
                rating=p["rating"],
                user_ratings_total=p["user_ratings_total"],
            )
            db.add(place)
            place_objects.append(place)
            print(f"  ✅ Place '{p['name']}'")

        db.flush()

        # ── 2. Partners ────────────────────────────
        print("\nSeeding partners …")
        partner_objects = []
        for pr in PARTNERS:
            existing = db.query(Partner).filter(Partner.name == pr["name"]).first()
            if existing:
                print(f"  ⏭  Partner '{pr['name']}' already exists, skipping")
                partner_objects.append(existing)
                continue

            partner = Partner(**pr, status="active")
            db.add(partner)
            partner_objects.append(partner)
            print(f"  ✅ Partner '{pr['name']}'")

        db.flush()

        # ── 3. PartnerPlaces ───────────────────────
        print("\nSeeding partner_places …")
        pp_objects = []
        for pi, pli, rel, ct, cv, pw in PARTNER_PLACE_MAP:
            partner = partner_objects[pi]
            place = place_objects[pli]

            existing = (
                db.query(PartnerPlace)
                .filter(
                    PartnerPlace.partner_id == partner.id,
                    PartnerPlace.place_id == place.place_id,
                )
                .first()
            )
            if existing:
                print(f"  ⏭  PartnerPlace ({partner.name} ↔ {place.name}) already exists")
                pp_objects.append(existing)
                continue

            pp = PartnerPlace(
                partner_id=partner.id,
                place_id=place.place_id,
                relationship_type=rel,
                commission_type=ct,
                commission_value=cv,
                priority_weight=pw,
                is_promotable=True,
                start_date=date(2025, 1, 1),
                end_date=date(2025, 12, 31),
                status="active",
            )
            db.add(pp)
            pp_objects.append(pp)
            print(f"  ✅ PartnerPlace ({partner.name} ↔ {place.name})")

        db.flush()

        # ── 4. RouteInsertionRules ─────────────────
        print("\nSeeding route_insertion_rules …")
        for ppi, tt, tv, mdm, mdk, dc, tc, pb in ROUTE_RULES:
            pp = pp_objects[ppi]
            partner = partner_objects[PARTNER_PLACE_MAP[ppi][0]]

            existing = (
                db.query(RouteInsertionRule)
                .filter(
                    RouteInsertionRule.partner_place_id == pp.id,
                    RouteInsertionRule.trigger_type == tt,
                    RouteInsertionRule.trigger_value == tv,
                )
                .first()
            )
            if existing:
                print(f"  ⏭  Rule for PP#{pp.id} ({tt}={tv}) already exists")
                continue

            rule = RouteInsertionRule(
                partner_id=partner.id,
                partner_place_id=pp.id,
                trigger_type=tt,
                trigger_value=tv,
                max_detour_minutes=mdm,
                max_detour_km=mdk,
                daily_cap=dc,
                trip_cap=tc,
                priority_boost=pb,
                status="active",
            )
            db.add(rule)
            print(f"  ✅ Rule PP#{pp.id} trigger={tt} value={tv}")

        db.flush()

        # ── 5. EventLogs ──────────────────────────
        print("\nSeeding event_logs …")
        # Only seed if table is empty to avoid duplicates on re-run
        event_count = db.query(EventLog).count()
        if event_count > 0:
            print(f"  ⏭  event_logs already has {event_count} rows, skipping")
        else:
            base_ts = datetime(2025, 3, 1, 10, 0, 0)
            event_types = ["impression", "click", "lead", "booking"]
            # Generate events for each partner_place
            for idx, pp in enumerate(pp_objects):
                partner = partner_objects[PARTNER_PLACE_MAP[idx][0]]
                place = place_objects[PARTNER_PLACE_MAP[idx][1]]

                # impressions: 20, clicks: 8, leads: 3, bookings: 1
                counts = {"impression": 20, "click": 8, "lead": 3, "booking": 1}
                event_offset = 0
                for etype, cnt in counts.items():
                    for i in range(cnt):
                        event = EventLog(
                            partner_id=partner.id,
                            place_id=place.place_id,
                            partner_place_id=pp.id,
                            event_type=etype,
                            event_ts=base_ts + timedelta(hours=event_offset),
                        )
                        db.add(event)
                        event_offset += 2  # 2-hour intervals

                print(f"  ✅ Events for PP#{pp.id} ({partner.name}): 20 imp, 8 click, 3 lead, 1 booking")

        db.flush()

        # ── 6. Settlements ─────────────────────────
        print("\nSeeding settlements …")
        settlement_count = db.query(Settlement).count()
        if settlement_count > 0:
            print(f"  ⏭  settlements already has {settlement_count} rows, skipping")
        else:
            for idx, partner in enumerate(partner_objects):
                pp_idx = idx  # 1-to-1 mapping
                _, _, _, ct, cv, _ = PARTNER_PLACE_MAP[pp_idx]

                # Calculate payout based on commission model
                if ct == "cpa":
                    payout = cv * 1  # 1 booking per partner_place
                elif ct == "cpl":
                    payout = cv * 3  # 3 leads per partner_place
                else:  # fixed
                    payout = cv

                settlement = Settlement(
                    partner_id=partner.id,
                    period_start=date(2025, 3, 1),
                    period_end=date(2025, 3, 31),
                    leads_count=3,
                    bookings_count=1,
                    gross_amount=payout,
                    payout_amount=payout,
                    currency="RUB",
                    status="draft",
                )
                db.add(settlement)
                print(f"  ✅ Settlement for '{partner.name}': {payout} RUB")

        db.commit()
        print("\n🎉 Seed completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
