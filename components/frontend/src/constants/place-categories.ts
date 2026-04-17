import type { Language } from "@/contexts/LanguageContext";

export const PLACE_CATEGORIES = [
  { value: "restaurant", labels: { ru: "Ресторан", en: "Restaurant" } },
  { value: "cafe", labels: { ru: "Кафе", en: "Cafe" } },
  { value: "coffee_shop", labels: { ru: "Кофейня", en: "Coffee Shop" } },
  { value: "bakery", labels: { ru: "Пекарня", en: "Bakery" } },
  { value: "bar", labels: { ru: "Бар", en: "Bar" } },
  { value: "pub", labels: { ru: "Паб", en: "Pub" } },
  { value: "beach", labels: { ru: "Пляж", en: "Beach" } },
  { value: "museum", labels: { ru: "Музей", en: "Museum" } },
  { value: "park", labels: { ru: "Парк", en: "Park" } },
  { value: "viewpoint", labels: { ru: "Смотровая площадка", en: "Viewpoint" } },
  { value: "hotel", labels: { ru: "Отель", en: "Hotel" } },
  { value: "guest_house", labels: { ru: "Гостевой дом", en: "Guest House" } },
  { value: "spa", labels: { ru: "Спа", en: "Spa" } },
  {
    value: "shopping_center",
    labels: { ru: "Торговый центр", en: "Shopping Center" },
  },
  {
    value: "entertainment_center",
    labels: { ru: "Развлекательный центр", en: "Entertainment Center" },
  },
  { value: "activity", labels: { ru: "Активность", en: "Activity" } },
  { value: "transfer", labels: { ru: "Трансфер", en: "Transfer" } },
] as const;

export type PlaceCategoryValue = (typeof PLACE_CATEGORIES)[number]["value"];

const MAIN_TYPE_BY_PLACE_CATEGORY: Partial<Record<PlaceCategoryValue, string>> = {
  restaurant: "Restaurants – Casual dining",
  cafe: "Restaurants – Casual dining",
  coffee_shop: "Coffee & Sweets",
  bakery: "Coffee & Sweets",
  bar: "Nightlife & Bars",
  pub: "Nightlife & Bars",
  beach: "Nature & Outdoors",
  museum: "Museums & Culture",
  park: "Nature & Outdoors",
  viewpoint: "Nature & Outdoors",
  hotel: "Hotels & Accommodation",
  guest_house: "Hotels & Accommodation",
  spa: "Wellness & Relaxation",
  shopping_center: "Shopping – Lifestyle & Malls",
  entertainment_center: "Entertainment & Leisure",
  activity: "Sports & Active leisure",
};

export function getPlaceCategoryOptions(language: Language) {
  return PLACE_CATEGORIES.map((category) => ({
    value: category.value,
    label: category.labels[language],
  }));
}

export function getPlaceCategoryLabel(
  value: string | null | undefined,
  language: Language,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  const match = PLACE_CATEGORIES.find((category) => category.value === value);
  if (match?.labels[language]) {
    return match.labels[language];
  }

  return value.replace(/_/g, " ") || fallback;
}

export function mapPlaceCategoriesToPreferredTypes(categories: string[]) {
  return Array.from(
    new Set(
      categories.map(
        (category) =>
          MAIN_TYPE_BY_PLACE_CATEGORY[category as PlaceCategoryValue] ?? category,
      ),
    ),
  );
}
