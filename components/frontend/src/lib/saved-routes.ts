export interface RouteRenderCoordinates {
  latitude: number;
  longitude: number;
}

export interface RouteRenderPointSnapshot {
  query: string;
  address: string;
  coordinates: RouteRenderCoordinates;
  source?: string;
  displayName?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  placeId?: string;
}

export interface RouteRenderSegmentSnapshot {
  coordinates: RouteRenderCoordinates[];
  source?: string;
}

export interface RouteRenderDataSnapshot {
  routePoints: RouteRenderPointSnapshot[];
  routeSegments: RouteRenderSegmentSnapshot[];
}

export interface SavedRouteMessageSnapshot {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  isSent?: boolean;
}

export interface SavedRouteMetadataSnapshot {
  accommodationPreference?: "yes" | "no";
  routeDescription?: string;
  requiredPlaces?: string[];
  startingPointAddress?: string;
  renderData?: RouteRenderDataSnapshot;
}

export interface SavedRouteRecord {
  id: number;
  title: string;
  route_queries: string[];
  messages: SavedRouteMessageSnapshot[];
  metadata: SavedRouteMetadataSnapshot;
  created_at?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeCoordinate(value: unknown): RouteRenderCoordinates | null {
  const record = asRecord(value);
  const latitude = typeof record?.latitude === "number" ? record.latitude : NaN;
  const longitude = typeof record?.longitude === "number" ? record.longitude : NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRoutePoint(value: unknown): RouteRenderPointSnapshot | null {
  const record = asRecord(value);
  const coordinates = normalizeCoordinate(record?.coordinates);
  const query = typeof record?.query === "string" ? record.query.trim() : "";
  const address = typeof record?.address === "string" ? record.address.trim() : "";

  if (!coordinates || !query || !address) {
    return null;
  }

  return {
    query,
    address,
    coordinates,
    source: typeof record?.source === "string" ? record.source : undefined,
    displayName: typeof record?.displayName === "string" ? record.displayName : undefined,
    googleMapsUri: typeof record?.googleMapsUri === "string" ? record.googleMapsUri : undefined,
    photoUrl: typeof record?.photoUrl === "string" ? record.photoUrl : undefined,
    placeId: typeof record?.placeId === "string" ? record.placeId : undefined,
  };
}

function normalizeRouteSegment(value: unknown): RouteRenderSegmentSnapshot | null {
  const record = asRecord(value);
  const coordinates = Array.isArray(record?.coordinates)
    ? record.coordinates
        .map((item) => normalizeCoordinate(item))
        .filter((item): item is RouteRenderCoordinates => item !== null)
    : [];

  if (coordinates.length < 2) {
    return null;
  }

  return {
    coordinates,
    source: typeof record?.source === "string" ? record.source : undefined,
  };
}

export function normalizeRouteRenderData(value: unknown): RouteRenderDataSnapshot | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const routePoints = Array.isArray(record.routePoints)
    ? record.routePoints
        .map((item) => normalizeRoutePoint(item))
        .filter((item): item is RouteRenderPointSnapshot => item !== null)
    : [];
  const routeSegments = Array.isArray(record.routeSegments)
    ? record.routeSegments
        .map((item) => normalizeRouteSegment(item))
        .filter((item): item is RouteRenderSegmentSnapshot => item !== null)
    : [];

  if (routePoints.length === 0) {
    return null;
  }

  return {
    routePoints,
    routeSegments,
  };
}

export function normalizeSavedRouteMetadata(value: unknown): SavedRouteMetadataSnapshot {
  const record = asRecord(value);
  const accommodationPreference =
    record?.accommodationPreference === "yes" || record?.accommodationPreference === "no"
      ? record.accommodationPreference
      : undefined;

  return {
    accommodationPreference,
    routeDescription:
      typeof record?.routeDescription === "string" ? record.routeDescription : undefined,
    requiredPlaces: Array.isArray(record?.requiredPlaces)
      ? record.requiredPlaces
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : undefined,
    startingPointAddress:
      typeof record?.startingPointAddress === "string"
        ? record.startingPointAddress
        : undefined,
    renderData: normalizeRouteRenderData(record?.renderData),
  };
}

export function normalizeSavedRouteRecord(value: unknown): SavedRouteRecord | null {
  const record = asRecord(value);
  const id = typeof record?.id === "number" ? record.id : NaN;
  const title = typeof record?.title === "string" ? record.title.trim() : "";

  if (!Number.isInteger(id) || id <= 0 || !title) {
    return null;
  }

  const routeQueries = Array.isArray(record.route_queries)
    ? record.route_queries
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
  const messages = Array.isArray(record.messages)
    ? record.messages
        .map((item) => {
          const message = asRecord(item);
          const messageId = typeof message?.id === "string" ? message.id : "";
          const text = typeof message?.text === "string" ? message.text : "";
          const timestamp = typeof message?.timestamp === "string" ? message.timestamp : "";

          if (!messageId || !text || !timestamp || typeof message?.isUser !== "boolean") {
            return null;
          }

          return {
            id: messageId,
            text,
            isUser: message.isUser,
            timestamp,
            isSent: typeof message.isSent === "boolean" ? message.isSent : undefined,
          };
        })
        .filter((item): item is SavedRouteMessageSnapshot => item !== null)
    : [];

  return {
    id,
    title,
    route_queries: routeQueries,
    messages,
    metadata: normalizeSavedRouteMetadata(record.metadata),
    created_at: typeof record.created_at === "string" ? record.created_at : null,
  };
}
