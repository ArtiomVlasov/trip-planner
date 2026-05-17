import re
from typing import Iterable


CYRILLIC_TO_LATIN = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "yo",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "y",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "ts",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)


def slugify_place_name(place_name: str) -> str:
    normalized = " ".join(place_name.strip().lower().split())
    transliterated = normalized.translate(CYRILLIC_TO_LATIN)
    slug = re.sub(r"[^a-z0-9]+", "-", transliterated).strip("-")
    return slug or "place"


def build_partner_external_id_base(partner_id: int, place_name: str) -> str:
    return f"partner-{partner_id}-{slugify_place_name(place_name)}"


def pick_unique_external_id(base_id: str, existing_ids: Iterable[str]) -> str:
    taken_ids = set(existing_ids)
    if base_id not in taken_ids:
        return base_id

    suffix = 2
    while True:
        candidate = f"{base_id}-{suffix}"
        if candidate not in taken_ids:
            return candidate
        suffix += 1
