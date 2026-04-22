import importlib
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep imports deterministic in local test runs: these modules read env vars at
# import time, but the tests below do not need a real database or real API keys.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("YANDEX_MAPS_API_KEY", "test-yandex-key")
os.environ.setdefault("GIGACHAT_AUTH_KEY", "test-gigachat-auth-key")


def test_partner_password_hash_roundtrip_and_bad_values():
    """Tests partner password hashing - expects valid passwords to pass and bad hashes to fail."""
    from services.partner_auth import hash_password, verify_password

    stored_hash = hash_password("correct horse battery staple")

    assert stored_hash.startswith("scrypt$")
    assert verify_password("correct horse battery staple", stored_hash) is True
    assert verify_password("wrong password", stored_hash) is False
    assert verify_password("anything", "not-a-valid-hash") is False


def test_partner_external_id_generation_transliterates_and_adds_suffixes():
    """Tests partner external id generation - expects readable slugs and unique suffixes per partner."""
    from services.place_external_ids import (
        build_partner_external_id_base,
        pick_unique_external_id,
    )

    base_id = build_partner_external_id_base(7, "Кафе у моря!")

    assert base_id == "partner-7-kafe-u-morya"
    assert pick_unique_external_id(base_id, []) == "partner-7-kafe-u-morya"
    assert pick_unique_external_id(base_id, [base_id]) == "partner-7-kafe-u-morya-2"
    assert pick_unique_external_id(base_id, [base_id, f"{base_id}-2"]) == "partner-7-kafe-u-morya-3"


def test_partner_access_extracts_partner_id_and_rejects_non_partner_tokens():
    """Tests partner token access - expects partner ids parsed and non-partner tokens rejected."""
    from fastapi import HTTPException

    from services.auth_utils import create_access_token
    from services.partner_access import extract_partner_id_from_token

    partner_token = create_access_token({"sub": "partner:test", "partner_id": 15, "role": "partner"})
    user_token = create_access_token({"sub": "user:test", "role": "user"})

    assert extract_partner_id_from_token(partner_token) == 15

    with pytest.raises(HTTPException) as exc_info:
        extract_partner_id_from_token(user_token)

    assert exc_info.value.status_code == 403


def test_user_registration_hash_is_compatible_with_login_verifier():
    """Tests user registration hash format - expects login verifier to accept the same password."""
    from services.user_login import verify_password
    from services.user_resgister import hash_password

    stored_hash = hash_password("user-password")

    assert verify_password("user-password", stored_hash) is True
    assert verify_password("another-password", stored_hash) is False


def test_login_user_uses_email_and_returns_user_object():
    """Tests user login lookup - expects email-based lookup and the matching user object returned."""
    from services.user_login import login_user

    stored_user = SimpleNamespace(
        email="user@example.com",
        username="Same Nick",
        password="$invalid-hash$",
    )

    class FakeQuery:
        def filter(self, *_args, **_kwargs):
            return self

        def first(self):
            return stored_user

    class FakeSession:
        def query(self, _model):
            return FakeQuery()

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(
            "services.user_login.verify_password",
            lambda plain_password, stored_hash: (
                plain_password == "correct-password" and stored_hash == stored_user.password
            ),
        )

        user = login_user(
            FakeSession(),
            SimpleNamespace(email="user@example.com", password="correct-password"),
        )

    assert user is stored_user


def test_duplicate_user_registration_detail_maps_known_unique_constraints():
    """Tests duplicate registration parsing - expects email and username duplicates mapped cleanly."""
    from services.db_errors import get_duplicate_user_registration_detail

    class FakeUniqueViolation(Exception):
        def __init__(self, message: str, constraint_name: str):
            super().__init__(message)
            self.diag = SimpleNamespace(constraint_name=constraint_name)

    email_error = IntegrityError(
        "INSERT INTO users ...",
        {},
        FakeUniqueViolation(
            'duplicate key value violates unique constraint "ix_users_email"',
            "ix_users_email",
        ),
    )
    username_error = IntegrityError(
        "INSERT INTO users ...",
        {},
        FakeUniqueViolation(
            'duplicate key value violates unique constraint "ix_users_username"',
            "ix_users_username",
        ),
    )

    assert get_duplicate_user_registration_detail(email_error) == (
        "An account with this email already exists."
    )
    assert get_duplicate_user_registration_detail(username_error) == (
        "This username is already taken."
    )


def test_register_user_uses_defaults_when_optional_profile_fields_are_missing():
    """Tests user registration defaults - expects registration to succeed without travel profile fields."""
    from schemas import UserRegistration
    from services import user_resgister

    created = {}

    class FakeUser:
        def __init__(self, username, email, password):
            self.id = None
            self.username = username
            self.email = email
            self.password = password

    class FakePreferences:
        def __init__(self, **kwargs):
            created["preferences"] = kwargs

    class FakeStartingPoint:
        def __init__(self, **kwargs):
            created["starting_point"] = kwargs

    class FakeAvailability:
        def __init__(self, **kwargs):
            created["availability"] = kwargs

    class FakePreferredPlaceType:
        def __init__(self, **kwargs):
            created.setdefault("preferred_place_types", []).append(kwargs)

    class FakeSession:
        def __init__(self):
            self.user = None

        def add(self, obj):
            if isinstance(obj, FakeUser):
                self.user = obj
            return None

        def flush(self):
            self.user.id = 101

        def commit(self):
            return None

        def refresh(self, _obj):
            return None

    user_payload = UserRegistration(
        username="Tester",
        email="tester@example.com",
        password="Password1!",
    )
    db = FakeSession()

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(user_resgister, "User", FakeUser)
        monkeypatch.setattr(user_resgister, "Preferences", FakePreferences)
        monkeypatch.setattr(user_resgister, "StartingPoint", FakeStartingPoint)
        monkeypatch.setattr(user_resgister, "Availability", FakeAvailability)
        monkeypatch.setattr(user_resgister, "UserPreferredPlaceType", FakePreferredPlaceType)
        monkeypatch.setattr(user_resgister, "hash_password", lambda _password: "hashed")
        monkeypatch.setattr(user_resgister, "from_shape", lambda point, srid: (point.x, point.y, srid))
        monkeypatch.setattr(
            user_resgister,
            "assign_user_type_weights",
            lambda _db, _user_id, preferred_types: created.setdefault(
                "preferred_types",
                list(preferred_types),
            ),
        )

        registered_user = user_resgister.register_user(db, user_payload)

    assert registered_user.id == 101
    assert created["preferences"] == {
        "user_id": 101,
        "max_walking_distance_meters": 1000,
        "budget_level": 3,
        "rating_threshold": 4.0,
        "likes_breakfast_outside": False,
        "transport_mode": "DRIVE",
    }
    assert created["starting_point"]["name"] == "Случайная точка в Сочи"
    assert created["starting_point"]["city"] == "Sochi"
    assert created["starting_point"]["country"] == "Russia"
    assert created["availability"] == {
        "user_id": 101,
        "start_time": 900,
        "end_time": 1800,
    }
    assert created.get("preferred_place_types", []) == []
    assert created["preferred_types"] == []


def test_compute_normalized_weights_boosts_selected_items():
    """Tests initial preference weights - expects selected items boosted and all weights normalized."""
    from services.user_resgister import compute_normalized_weights

    items = [
        SimpleNamespace(id=1),
        SimpleNamespace(id=2),
        SimpleNamespace(id=3),
    ]

    weights = compute_normalized_weights(items, selected_ids={2})

    assert sum(weights.values()) == pytest.approx(1.0)
    assert weights[2] > weights[1]
    assert weights[2] > weights[3]
    assert weights[1] == pytest.approx(weights[3])


def test_extract_route_points_reads_json_and_deduplicates_addresses():
    """Tests GigaChat response parsing - expects route points extracted from structured JSON."""
    from services.gigachat_route_planner import extract_route_points

    content = """
    ```json
    {
      "route_points": [
        {"address": "Сочи, Морской вокзал"},
        {"address": "Сочи, Дендрарий"},
        {"address": "Сочи, Морской вокзал"}
      ]
    }
    ```
    """

    assert extract_route_points(content) == [
        "Сочи, Морской вокзал",
        "Сочи, Дендрарий",
    ]


def test_extract_route_points_falls_back_to_plain_lines():
    """Tests GigaChat response parsing fallback - expects numbered lines handled as route points."""
    from services.gigachat_route_planner import extract_route_points

    content = """
    1. Сочи, Навагинская улица
    2. Сочи, Зимний театр
    3. Сочи, Имеретинская набережная
    """

    assert extract_route_points(content) == [
        "Сочи, Навагинская улица",
        "Сочи, Зимний театр",
        "Сочи, Имеретинская набережная",
    ]


def test_build_route_messages_uses_form_payload_even_with_empty_prompt_template():
    """Tests GigaChat request assembly - expects prompt and user parameters included in messages."""
    from schemas import RoutePlanningRequest
    from services.gigachat_route_planner import build_route_messages

    request = RoutePlanningRequest(
        route_request="Маршрут по Сочи на один день",
        accommodation_required=False,
        meal_required=True,
        meal_preferences="Кофейня у моря",
        starting_point_address="Сочи, вокзал",
        required_places=["Дендрарий", "Морпорт"],
    )

    messages = build_route_messages(request)

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "Составь реалистичный маршрут ровно на 1 день" in messages[0]["content"]
    assert messages[1]["role"] == "user"
    assert "Маршрут по Сочи на один день" in messages[1]["content"]
    assert "Стартовая точка: Сочи, вокзал" in messages[1]["content"]
    assert "Дендрарий" in messages[1]["content"]


def test_extract_structured_route_items_reads_function_call_arguments():
    """Tests GigaChat function-call parsing - expects structured route items extracted from arguments."""
    from services.gigachat_route_planner import extract_structured_route_items

    message_payload = {
        "function_call": {
            "name": "build_sochi_one_day_route",
            "arguments": {
                "route_points": [
                    {
                        "order": 2,
                        "place_name": "Морпорт",
                        "address": "Сочи, ул. Войкова, 1",
                        "category": "sight",
                        "visit_reason": "Прогулка у моря",
                    },
                    {
                        "order": 1,
                        "place_name": "Ж/д вокзал Сочи",
                        "address": "Сочи, ул. Горького, 56",
                        "category": "start",
                    },
                ]
            },
        }
    }

    assert extract_structured_route_items(message_payload) == [
        {
            "order": 1,
            "place_name": "Ж/д вокзал Сочи",
            "address": "Сочи, ул. Горького, 56",
            "category": "start",
            "visit_reason": None,
        },
        {
            "order": 2,
            "place_name": "Морпорт",
            "address": "Сочи, ул. Войкова, 1",
            "category": "sight",
            "visit_reason": "Прогулка у моря",
        },
    ]


def test_guest_context_saves_loads_and_expires(monkeypatch):
    """Tests guest prompt cache TTL - expects saved data to load first and expire after TTL."""
    from services import guest_context

    guest_context._GUEST_CACHE.clear()
    clock = {"now": 1_000.0}
    monkeypatch.setattr(guest_context.time, "time", lambda: clock["now"])

    guest_context.save_guest("203.0.113.10", {"city": "Sochi"})
    assert guest_context.load_guest("203.0.113.10") == {"city": "Sochi"}

    clock["now"] += guest_context.TTL + 1

    assert guest_context.load_guest("203.0.113.10") is None
    assert "203.0.113.10" not in guest_context._GUEST_CACHE


def test_parse_price_level_maps_known_unknown_and_empty_values():
    """Tests stub price parsing - expects all values normalized to the stub fallback."""
    from services.search_text import parse_price_level

    assert parse_price_level("PRICE_LEVEL_FREE") == -1
    assert parse_price_level("PRICE_LEVEL_EXPENSIVE") == -1
    assert parse_price_level("PRICE_LEVEL_DOES_NOT_EXIST") == -1
    assert parse_price_level(None) == -1
    assert parse_price_level("") == -1


def test_send_user_prompt_parses_plain_and_fenced_json():
    """Tests prompt parsing helper - expects plain/fenced JSON parsed and invalid text ignored."""
    from services.parse_user_prompt import send_user_prompt

    class FakeChat:
        def __init__(self, text):
            self.text = text

        def send_message(self, user_input):
            return SimpleNamespace(text=self.text)

    assert send_user_prompt(FakeChat('{"city": "Sochi"}'), "plan") == {
        "city": "Sochi"
    }
    assert send_user_prompt(
        FakeChat('```json\n{"days": 2, "interests": ["parks"]}\n```'),
        "plan",
    ) == {"days": 2, "interests": ["parks"]}
    assert send_user_prompt(FakeChat("not json"), "plan") == {}


def test_build_photo_url_returns_stub_none():
    """Tests photo helper stub - expects no URL returned for any input."""
    import services.route_builder as route_builder

    route_builder = importlib.reload(route_builder)

    assert route_builder.build_photo_url(None) is None
    assert route_builder.build_photo_url([]) is None
    assert route_builder.build_photo_url([{}]) is None
    assert route_builder.build_photo_url([{"name": "places/abc/photos/def"}]) is None


def test_safe_normalize_handles_positive_zero_and_empty_weights():
    """Tests weight normalization helper - expects positive, zero, and empty inputs handled safely."""
    from services.picking_types.sampling_helper import safe_normalize

    assert safe_normalize({1: 2.0, 2: 2.0}) == {1: 0.5, 2: 0.5}
    assert safe_normalize({1: 0.0, 2: 0.0}) == {1: 0.5, 2: 0.5}
    assert safe_normalize({}) == {}


def test_weighted_sampling_is_deterministic_and_without_replacement():
    """Tests weighted sampling helper - expects deterministic unique picks without replacement."""
    from services.picking_types.sampling_helper import weighted_sample_no_replacement

    sample = weighted_sample_no_replacement(
        population=[10, 20, 30],
        weights=[0.0, 1.0, 0.0],
        k=2,
        seed=7,
    )

    assert len(sample) == 2
    assert len(set(sample)) == 2
    assert sample[0] == 20
    assert set(sample).issubset({10, 20, 30})


def test_distribute_quotas_among_mains_respects_min_max_and_weighted_remainder():
    """Tests subtype quota distribution - expects weighted quotas within configured min/max limits."""
    from services.picking_types.config import Config
    from services.picking_types.distribution import distribute_quotas_among_mains

    cfg = Config(
        min_subtypes_per_main=1,
        max_subtypes_per_main=3,
        target_subtypes_total=5,
        max_subtypes_total=6,
    )

    quotas = distribute_quotas_among_mains(
        final_main_weights={1: 0.8, 2: 0.2},
        chosen_mains=[1, 2],
        total_subtypes_target=5,
        cfg=cfg,
    )

    assert quotas == {1: 3, 2: 2}
    assert all(cfg.min_subtypes_per_main <= q <= cfg.max_subtypes_per_main for q in quotas.values())
    assert sum(quotas.values()) == 5
