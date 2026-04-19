PLACE_CATEGORY_TO_MAIN_TYPE = {
    "restaurant": "Restaurants – Casual dining",
    "cafe": "Restaurants – Casual dining",
    "coffee_shop": "Coffee & Sweets",
    "bakery": "Coffee & Sweets",
    "bar": "Nightlife & Bars",
    "pub": "Nightlife & Bars",
    "beach": "Nature & Outdoors",
    "museum": "Museums & Culture",
    "park": "Nature & Outdoors",
    "viewpoint": "Nature & Outdoors",
    "hotel": "Hotels & Accommodation",
    "guest_house": "Hotels & Accommodation",
    "spa": "Wellness & Relaxation",
    "shopping_center": "Shopping – Lifestyle & Malls",
    "entertainment_center": "Entertainment & Leisure",
    "activity": "Sports & Active leisure",
    "transfer": "transfer",
}


def normalize_preferred_categories(values):
    if not isinstance(values, list):
        return []

    normalized = []
    seen = set()

    for value in values:
        if not isinstance(value, str):
            continue
        trimmed = value.strip()
        if not trimmed or trimmed in seen:
            continue
        normalized.append(trimmed)
        seen.add(trimmed)

    return normalized


def map_categories_to_main_types(categories):
    main_types = []
    seen = set()

    for category in normalize_preferred_categories(categories):
        mapped = PLACE_CATEGORY_TO_MAIN_TYPE.get(category, category)
        if mapped not in seen:
            main_types.append(mapped)
            seen.add(mapped)

    return main_types
