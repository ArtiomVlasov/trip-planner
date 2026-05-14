from __future__ import annotations

import os


def should_seed_partner_mocks() -> bool:
    return str(os.getenv("SEED_PARTNER_MOCKS", "") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def seed_partner_mocks_if_enabled() -> None:
    if not should_seed_partner_mocks():
        return

    try:
        from seed_partners import seed

        seed()
    except Exception as exc:
        print(f"Partner mock seed failed: {exc}")

