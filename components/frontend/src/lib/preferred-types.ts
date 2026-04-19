import { PLACE_CATEGORIES } from "@/constants/place-categories";

export const PREFERRED_TYPES_STORAGE_KEY = "trip-planner-preferred-types";

const VALID_PREFERRED_TYPES = new Set(PLACE_CATEGORIES.map((category) => category.value));

export function normalizePreferredTypes(types: string[] | null | undefined) {
  if (!Array.isArray(types)) {
    return [];
  }

  return Array.from(
    new Set(
      types.filter((type): type is string => typeof type === "string" && VALID_PREFERRED_TYPES.has(type)),
    ),
  );
}

export function getStoredPreferredTypes() {
  try {
    const raw = localStorage.getItem(PREFERRED_TYPES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return normalizePreferredTypes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function storePreferredTypes(types: string[]) {
  localStorage.setItem(
    PREFERRED_TYPES_STORAGE_KEY,
    JSON.stringify(normalizePreferredTypes(types)),
  );
}
