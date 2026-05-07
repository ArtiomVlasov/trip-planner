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
  add(object: unknown): void;
  remove(object: unknown): void;
  getBounds?: () => [YandexMapCoordinate, YandexMapCoordinate] | null;
}

export interface YandexMapInstance {
  destroy(): void;
  setCenter?: (coordinates: YandexMapCoordinate, zoom?: number) => void;
  setBounds?: (
    bounds: [YandexMapCoordinate, YandexMapCoordinate],
    options?: Record<string, unknown>,
  ) => void;
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
  Polyline: new (
    coordinates: YandexMapCoordinate[],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => unknown;
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

function getYandexMapsScriptSources() {
  const proxyScriptUrl = buildApiUrl("/api/maps/script?lang=ru_RU&load=package.full");
  const legacyBrowserKey = (import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "").trim();
  const sources = [proxyScriptUrl];

  if (legacyBrowserKey) {
    sources.push(
      `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(legacyBrowserKey)}&lang=ru_RU&load=package.full`,
    );
  }

  return sources;
}

function removeInjectedYandexMapsScripts() {
  document
    .querySelectorAll<HTMLScriptElement>('script[data-yandex-maps-api="true"]')
    .forEach((script) => script.remove());
}

export function loadYandexMaps(): Promise<YandexMapsNamespace> {
  if (window.ymaps) {
    return new Promise((resolve, reject) => {
      window.ymaps.ready(() => resolve(window.ymaps), reject);
    });
  }

  if (window.__yandexMapsPromise) {
    return window.__yandexMapsPromise;
  }

  window.__yandexMapsPromise = new Promise<YandexMapsNamespace>((resolve, reject) => {
    const scriptSources = getYandexMapsScriptSources();
    let currentSourceIndex = 0;
    let lastError: Error | null = null;

    const tryNextSource = () => {
      if (currentSourceIndex >= scriptSources.length) {
        reject(lastError ?? new Error("Failed to load Yandex Maps script"));
        return;
      }

      const script = document.createElement("script");
      const scriptSource = scriptSources[currentSourceIndex];
      currentSourceIndex += 1;

      removeInjectedYandexMapsScripts();
      script.src = scriptSource;
      script.async = true;
      script.defer = true;
      script.dataset.yandexMapsApi = "true";

      const handleFailure = (reason: string) => {
        script.remove();
        lastError = new Error(reason);
        tryNextSource();
      };

      script.addEventListener(
        "load",
        () => {
          if (!window.ymaps) {
            handleFailure("Yandex Maps namespace is unavailable");
            return;
          }

          window.ymaps.ready(() => resolve(window.ymaps), (error) => {
            handleFailure(
              error instanceof Error ? error.message : "Yandex Maps ready() failed",
            );
          });
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => handleFailure("Failed to load Yandex Maps script"),
        { once: true },
      );

      document.head.appendChild(script);
    };

    tryNextSource();
  }).catch((error) => {
    removeInjectedYandexMapsScripts();
    window.__yandexMapsPromise = undefined;
    throw error;
  });

  return window.__yandexMapsPromise;
}

export async function geocodeAddressSuggestions(
  query: string,
  results: number = 5,
): Promise<YandexAddressSuggestion[]> {
  const response = await fetch(
    buildApiUrl(
      `/api/maps/geocode?q=${encodeURIComponent(query)}&results=${encodeURIComponent(String(results))}`,
    ),
  );

  if (!response.ok) {
    throw new Error(`Geocode request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item: Record<string, unknown>) => ({
      address: String(item.address ?? "").trim(),
      lat: Number(item.lat),
      lng: Number(item.lng),
      city: typeof item.city === "string" ? item.city : undefined,
      country: typeof item.country === "string" ? item.country : undefined,
    }))
    .filter(
      (item) =>
        Boolean(item.address) &&
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lng),
    );
}
