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
  setCenter?: (coordinates: YandexMapCoordinate, zoom?: number) => void;
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
  const ymaps = await loadYandexMaps();

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
