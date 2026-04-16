import importlib
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Keep imports deterministic in local test runs: these modules read env vars at
# import time, but the tests below do not need a real database or real API keys.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("GOOGLE_PLACES_API_KEY", "test-google-key")


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
    """Tests Google price level parsing - expects known values mapped and invalid values set to -1."""
    from services.search_text import parse_price_level

    assert parse_price_level("PRICE_LEVEL_FREE") == 1
    assert parse_price_level("PRICE_LEVEL_EXPENSIVE") == 4
    assert parse_price_level("PRICE_LEVEL_DOES_NOT_EXIST") == -1
    assert parse_price_level(None) == -1
    assert parse_price_level("") == -1


def test_send_user_prompt_parses_plain_and_fenced_json():
    """Tests Gemini response parsing - expects plain/fenced JSON parsed and invalid text ignored."""
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


def test_build_photo_url_handles_missing_photo_and_uses_api_key(monkeypatch):
    """Tests Google photo URL building - expects missing photos as None and valid refs as media URLs."""
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "photo-key")

    import services.route_builder as route_builder

    route_builder = importlib.reload(route_builder)

    assert route_builder.build_photo_url(None) is None
    assert route_builder.build_photo_url([]) is None
    assert route_builder.build_photo_url([{}]) is None
    assert route_builder.build_photo_url([{"name": "places/abc/photos/def"}]) == (
        "https://places.googleapis.com/v1/"
        "places/abc/photos/def/media"
        "?key=photo-key&maxWidthPx=400"
    )


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
