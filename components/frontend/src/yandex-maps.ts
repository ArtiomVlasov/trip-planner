import { buildApiUrl } from "@/lib/api";

export interface YandexAddressSuggestion {
  address: string;
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export type YandexMapCoordinate = [number, number];

export interface YandexAddressComponent {
  kind?: string;
  name?: string;
}

export interface YandexGeocoderMetaData {
  Address?: {
    Components?: YandexAddressComponent[];
  };
}

export interface YandexObjectProperties {
  get(key: string): unknown;
  set(values: Record<string, unknown>): void;
}

export interface YandexGeometry {
  getCoordinates?: () => YandexMapCoordinate;
  setCoordinates(coordinates: YandexMapCoordinate): void;
}

export interface YandexGeoObjectCollection {
  add(object: YandexGeoObject | YandexRoute): void;
  remove(object: YandexGeoObject | YandexRoute): void;
}

export interface YandexMapInstance {
  destroy(): void;
  events: {
    add(eventName: string, handler: (event: YandexMapClickEvent) => void | Promise<void>): void;
  };
  geoObjects: YandexGeoObjectCollection;
}

export interface YandexGeoObject {
  properties: YandexObjectProperties;
  geometry: YandexGeometry;
  balloon: {
    open(): void;
    close(): void;
  };
  getAddressLine?: () => string;
  getMap?: () => {
    geoObjects: YandexGeoObjectCollection;
  };
}

export interface YandexRoute {
  model: {
    events: {
      add(eventName: string, handler: () => void): void;
      removeAll?: () => void;
    };
  };
}

export interface YandexMapClickEvent {
  get(key: "coords"): YandexMapCoordinate;
  get(key: string): unknown;
}

export interface YandexLayoutClass {
  superclass: {
    build: {
      call(context: unknown): void;
    };
    clear: {
      call(context: unknown): void;
    };
  };
}

export interface YandexGeocodeResult {
  geoObjects?: {
    get(index: number): YandexGeoObject | undefined;
    getLength?: () => number;
  };
}

export interface YandexMapsNamespace {
  ready(onSuccess: () => void, onError?: (error: unknown) => void): void;
  geocode(target: string | YandexMapCoordinate, options?: Record<string, unknown>): Promise<YandexGeocodeResult>;
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YandexMapInstance;
  Placemark: new (
    coordinates: YandexMapCoordinate,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YandexGeoObject;
  multiRouter: {
    MultiRoute: new (
      model: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => YandexRoute;
  };
  templateLayoutFactory: {
    createClass(template: string, overrides?: Record<string, unknown>): YandexLayoutClass;
  };
}

declare global {
  interface Window {
    ymaps?: YandexMapsNamespace;
    __yandexMapsPromise?: Promise<YandexMapsNamespace>;
  }
}

let apiKeyPromise: Promise<string> | null = null;

export async function getYandexMapsApiKey() {
  const envKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "";
  if (envKey) {
    return envKey;
  }

  if (!apiKeyPromise) {
    apiKeyPromise = fetch(buildApiUrl("/api/maps-key"))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Maps key request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data?.apiKey) {
          throw new Error("Maps key is missing in response");
        }

        return data.apiKey as string;
      })
      .catch((error) => {
        apiKeyPromise = null;
        throw error;
      });
  }

  return apiKeyPromise;
}

export function loadYandexMaps(apiKey: string): Promise<YandexMapsNamespace> {
  if (window.ymaps) {
    return new Promise((resolve, reject) => {
      window.ymaps.ready(() => resolve(window.ymaps), reject);
    });
  }

  if (window.__yandexMapsPromise) {
    return window.__yandexMapsPromise;
  }

  window.__yandexMapsPromise = new Promise<YandexMapsNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-yandex-maps-api="true"]',
    );

    const waitForApi = () => {
      if (!window.ymaps) {
        reject(new Error("Yandex Maps namespace is unavailable"));
        return;
      }

      window.ymaps.ready(() => resolve(window.ymaps), reject);
    };

    if (existingScript) {
      existingScript.addEventListener("load", waitForApi, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Yandex Maps script")),
        { once: true },
      );

      if (window.ymaps) {
        waitForApi();
      }

      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU&load=package.full`;
    script.async = true;
    script.defer = true;
    script.dataset.yandexMapsApi = "true";
    script.addEventListener("load", waitForApi, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load Yandex Maps script")),
      { once: true },
    );

    document.head.appendChild(script);
  }).catch((error) => {
    window.__yandexMapsPromise = undefined;
    throw error;
  });

  return window.__yandexMapsPromise;
}

export async function geocodeAddressSuggestions(
  query: string,
  results: number = 5,
): Promise<YandexAddressSuggestion[]> {
  const apiKey = await getYandexMapsApiKey();
  const ymaps = await loadYandexMaps(apiKey);

  const geocodeResult = await new Promise<YandexGeocodeResult>((resolve, reject) => {
    ymaps.geocode(query, { results }).then(resolve, reject);
  });

  const items: YandexAddressSuggestion[] = [];
  const geoObjects = geocodeResult?.geoObjects;
  const total = geoObjects?.getLength?.() ?? 0;

  for (let index = 0; index < total; index += 1) {
    const geoObject = geoObjects.get(index);
    const coordinates = geoObject?.geometry?.getCoordinates?.();
    const metaData = geoObject?.properties?.get?.(
      "metaDataProperty.GeocoderMetaData",
    ) as YandexGeocoderMetaData | undefined;
    const components = Array.isArray(metaData?.Address?.Components)
      ? metaData.Address.Components
      : [];

    const getComponent = (kind: string) =>
      components.find((component: { kind?: string; name?: string }) => component.kind === kind)
        ?.name;

    if (!coordinates || coordinates.length < 2) {
      continue;
    }

    items.push({
      address: geoObject.getAddressLine(),
      lat: coordinates[0],
      lng: coordinates[1],
      city: getComponent("locality") ?? getComponent("province") ?? getComponent("area"),
      country: getComponent("country"),
    });
  }

  return items;
}
