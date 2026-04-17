import type { YandexAddressSuggestion } from "@/yandex-maps";

export interface StartingPointPayload {
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };
  city: string;
  country: string;
}

const SOCHI_STUB_POINTS = [
  { address: "Сочи, Морской вокзал", lat: 43.581969, lng: 39.719268 },
  { address: "Сочи, парк Ривьера", lat: 43.594645, lng: 39.715511 },
  { address: "Сочи, Зимний театр", lat: 43.570111, lng: 39.734763 },
  { address: "Сочи, Имеретинская набережная", lat: 43.402084, lng: 39.955611 },
  { address: "Сочи, Роза Хутор", lat: 43.671604, lng: 40.297138 },
  { address: "Сочи, Дендрарий", lat: 43.568341, lng: 39.742915 },
] as const;

function normalizeLocation(latitude: number, longitude: number) {
  return {
    latitude,
    longitude,
  };
}

export function buildStartingPointFromSuggestion(
  suggestion: Pick<
    YandexAddressSuggestion,
    "address" | "lat" | "lng" | "city" | "country"
  >,
): StartingPointPayload {
  return {
    name: suggestion.address,
    location: normalizeLocation(suggestion.lat, suggestion.lng),
    city: suggestion.city || "Sochi",
    country: suggestion.country || "Russia",
  };
}

export function getRandomSochiStartingPoint(): StartingPointPayload {
  const point =
    SOCHI_STUB_POINTS[Math.floor(Math.random() * SOCHI_STUB_POINTS.length)];

  return {
    name: point.address,
    location: normalizeLocation(point.lat, point.lng),
    city: "Sochi",
    country: "Russia",
  };
}
