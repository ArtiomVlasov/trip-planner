export const BUDGET_LEVELS = [
  { value: "low", label: "Budget-friendly" },
  { value: "medium", label: "Moderate" },
  { value: "high", label: "Luxury" },
];

export const RATING_THRESHOLDS = [
  { value: "3", label: "3+ stars" },
  { value: "4", label: "4+ stars" },
  { value: "5", label: "5 stars only" },
];

export const TRANSPORT_MODES = [
  { value: "walking", label: "Walking" },
  { value: "driving", label: "Driving" },
  { value: "public_transport", label: "Public Transport" },
];

export const PREFERRED_PLACE_TYPES = [
  "restaurant",
  "cafe",
  "museum",
  "park",
  "beach",
  "shopping",
  "nightlife",
  "historical",
  "sports",
  "entertainment",
];

export function getBudgetLevelLabel(value: string | undefined): string {
  const level = BUDGET_LEVELS.find((l) => l.value === value);
  return level ? level.label : "Unknown";
}

export function getTransportModeLabel(value: string | undefined): string {
  const mode = TRANSPORT_MODES.find((m) => m.value === value);
  return mode ? mode.label : "Unknown";
}