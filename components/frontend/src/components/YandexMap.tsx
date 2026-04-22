import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  loadYandexMaps,
  type YandexGeoObject,
  type YandexGeocoderMetaData,
  type YandexLayoutClass,
  type YandexMapClickEvent,
  type YandexMapCoordinate,
  type YandexMapInstance,
  type YandexMapsNamespace,
  type YandexRoute,
} from "@/yandex-maps";

interface YandexMapProps {
  apiKey: string;
  routeQueries?: string[];
  routeBuildingText: string;
  routeReadyText: string;
  routeFailedText: string;
  routeNeedTwoPointsText: string;
  routeMissingPointsText: string;
}

const DEFAULT_CENTER: YandexMapCoordinate = [43.602314, 39.73444];
const DEFAULT_ZOOM = 14;
const SEGMENT_COLORS = [
  "#2563eb",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value?: string | number | null) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

interface ResolvedRoutePoint {
  address: string;
  coordinates: YandexMapCoordinate;
  query: string;
}

async function resolveRoutePoint(
  ymaps: YandexMapsNamespace,
  query: string,
): Promise<ResolvedRoutePoint | null> {
  const normalizedQuery = query.trim();
  const candidateQueries = Array.from(
    new Set([withSochiContext(normalizedQuery), normalizedQuery].filter(Boolean)),
  );
  const geocodeAttempts = [
    {
      results: 1,
      boundedBy: [[43.35, 39.6], [43.75, 40.1]],
      strictBounds: false,
    },
    {
      results: 1,
    },
  ];

  for (const candidateQuery of candidateQueries) {
    for (const options of geocodeAttempts) {
      const result = await ymaps.geocode(candidateQuery, options);
      const firstGeoObject = result?.geoObjects?.get?.(0);
      const coordinates = firstGeoObject?.geometry?.getCoordinates?.();

      if (coordinates && coordinates.length >= 2) {
        return {
          address: firstGeoObject.getAddressLine?.() ?? candidateQuery,
          coordinates,
          query: normalizedQuery,
        };
      }
    }
  }

  return null;
}

function getAddressParts(geoObject?: YandexGeoObject) {
  const metaData = geoObject?.properties?.get?.(
    "metaDataProperty.GeocoderMetaData",
  ) as YandexGeocoderMetaData | undefined;
  const components = Array.isArray(metaData?.Address?.Components)
    ? metaData.Address.Components
    : [];

  const getComponent = (kind: string) =>
    components.find((component: { kind?: string; name?: string }) => component.kind === kind)
      ?.name;

  return {
    city: getComponent("locality") ?? getComponent("province") ?? "",
    street: getComponent("street") ?? "",
    house: getComponent("house") ?? "",
  };
}

function withSochiContext(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  const lowerCased = normalized.toLocaleLowerCase();

  if (!normalized) {
    return normalized;
  }

  if (lowerCased.includes("сочи") || lowerCased.includes("sochi")) {
    return normalized;
  }

  return `${normalized}, Сочи`;
}

function getSegmentColor(index: number) {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

function createMarkerIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <circle cx="19" cy="19" r="17" fill="${color}" />
      <circle cx="19" cy="19" r="17" fill="none" stroke="#ffffff" stroke-width="2" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function YandexMap({
  apiKey,
  routeQueries = [],
  routeBuildingText,
  routeReadyText,
  routeFailedText,
  routeNeedTwoPointsText,
  routeMissingPointsText,
}: YandexMapProps) {
  const { copy } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YandexMapInstance | null>(null);
  const ymapsRef = useRef<YandexMapsNamespace | null>(null);
  const selectedPointRef = useRef<YandexGeoObject | null>(null);
  const numberedMarkerContentLayoutRef = useRef<YandexLayoutClass | null>(null);
  const routeRefs = useRef<YandexRoute[]>([]);
  const routePointsRef = useRef<YandexGeoObject[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routeStatus, setRouteStatus] = useState("");

  useEffect(() => {
    if (!apiKey || !mapRef.current) {
      return;
    }

    let isCancelled = false;

    loadYandexMaps(apiKey)
      .then((ymaps) => {
        if (isCancelled || !mapRef.current) {
          return;
        }

        const addToRouteLabel = escapeHtml(copy.chat.addToRoute);
        numberedMarkerContentLayoutRef.current = ymaps.templateLayoutFactory.createClass(`
          <div
            style="
              width: 38px;
              height: 38px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-size: 14px;
              font-weight: 700;
              line-height: 1;
              font-family: sans-serif;
            "
          >
            {{ properties.iconNumber }}
          </div>
        `);
        const CompactBalloonLayout = ymaps.templateLayoutFactory.createClass(
          `
            <div style="position: absolute; transform: translate(-50%, calc(-100% - 12px));">
              <div style="min-width: 180px; max-width: 220px; border-radius: 12px; padding: 9px 10px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.1); font-family: sans-serif; position: relative;">
                <button type="button" data-action="close" style="position: absolute; top: 6px; right: 6px; width: 16px; height: 16px; border: 0; background: transparent; color: #6b7280; font-size: 13px; line-height: 16px; cursor: pointer; padding: 0;">×</button>
                <div style="padding-right: 14px;">
                  $[[options.contentLayout]]
                </div>
                <button type="button" data-action="add-route" style="margin-top: 8px; width: 100%; border: 0; border-radius: 8px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: 11px; line-height: 1; padding: 8px 10px; cursor: pointer;">
                  ${addToRouteLabel}
                </button>
              </div>
            </div>
          `,
          {
            build() {
              CompactBalloonLayout.superclass.build.call(this);
              this.handleCloseClick = this.handleCloseClick.bind(this);
              this.handleAddRouteClick = this.handleAddRouteClick.bind(this);
              this.getParentElement()
                ?.querySelector("[data-action='close']")
                ?.addEventListener("click", this.handleCloseClick);
              this.getParentElement()
                ?.querySelector("[data-action='add-route']")
                ?.addEventListener("click", this.handleAddRouteClick);
            },
            clear() {
              this.getParentElement()
                ?.querySelector("[data-action='close']")
                ?.removeEventListener("click", this.handleCloseClick);
              this.getParentElement()
                ?.querySelector("[data-action='add-route']")
                ?.removeEventListener("click", this.handleAddRouteClick);
              CompactBalloonLayout.superclass.clear.call(this);
            },
            handleCloseClick(event: Event) {
              event.preventDefault();
              const geoObject = this.getData().geoObject;
              geoObject.balloon.close();
              geoObject.getMap()?.geoObjects.remove(geoObject);
              selectedPointRef.current = null;
            },
            handleAddRouteClick(event: Event) {
              event.preventDefault();
              const geoObject = this.getData().geoObject;
              window.dispatchEvent(
                new CustomEvent("map-add-to-route", {
                  detail: {
                    address: geoObject.properties.get("addressText"),
                    coordinates: geoObject.properties.get("coordinatesText"),
                  },
                }),
              );
              geoObject.balloon.close();
            },
          },
        );
        const CompactBalloonContentLayout = ymaps.templateLayoutFactory.createClass(`
          <div style="font-size: 12px; line-height: 1.3; color: #111827;">
            {{ properties.address }}
          </div>
          <div style="margin-top: 4px; font-size: 10px; line-height: 1.3; color: #6b7280;">
            {{ properties.coordinates }}
          </div>
        `);

        ymapsRef.current = ymaps;
        mapInstanceRef.current?.destroy();
        mapInstanceRef.current = new ymaps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          controls: ["zoomControl"],
        });

        mapInstanceRef.current.events.add("click", async (event: YandexMapClickEvent) => {
          const coordinates = event.get("coords");
          const [lat, lng] = coordinates;

          try {
            const result = await ymaps.geocode(coordinates, { kind: "house", results: 1 });
            const firstGeoObject = result.geoObjects.get(0);
            const { city, street, house } = getAddressParts(firstGeoObject);
            const compactAddress =
              [city, street, house].filter(Boolean).join(", ") || "Адрес не найден";
            const coordText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

            if (!selectedPointRef.current) {
              selectedPointRef.current = new ymaps.Placemark(
                coordinates,
                {},
                {
                  iconLayout: "default#image",
                  iconImageHref:
                    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
                  iconImageSize: [1, 1],
                  iconImageOffset: [0, 0],
                  hideIconOnBalloonOpen: false,
                  balloonShadow: false,
                  balloonPanelMaxMapArea: 0,
                  balloonCloseButton: false,
                  balloonLayout: CompactBalloonLayout,
                  balloonContentLayout: CompactBalloonContentLayout,
                },
              );
              mapInstanceRef.current.geoObjects.add(selectedPointRef.current);
            } else {
              selectedPointRef.current.geometry.setCoordinates(coordinates);
            }

            selectedPointRef.current.properties.set({
              address: escapeHtml(compactAddress),
              coordinates: escapeHtml(coordText),
              addressText: compactAddress,
              coordinatesText: coordText,
              hintContent: compactAddress,
            });

            selectedPointRef.current.balloon.open();
          } catch (error) {
            console.error("Reverse geocoding failed:", error);
          }
        });
        setIsMapReady(true);
      })
      .catch((error) => {
        console.error("Error loading Yandex Maps:", error);
      });

    return () => {
      isCancelled = true;
      setIsMapReady(false);
      selectedPointRef.current = null;
      numberedMarkerContentLayoutRef.current = null;
      routeRefs.current = [];
      routePointsRef.current = [];
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      ymapsRef.current = null;
    };
  }, [apiKey, copy.chat.addToRoute]);

  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !ymapsRef.current) {
      return;
    }

    const ymaps = ymapsRef.current;
    const map = mapInstanceRef.current;
    const normalizedQueries = routeQueries.map((query) => query.trim()).filter(Boolean);

    routeRefs.current.forEach((route) => {
      route.model?.events?.removeAll?.();
      map.geoObjects.remove(route);
    });
    routeRefs.current = [];

    routePointsRef.current.forEach((point) => map.geoObjects.remove(point));
    routePointsRef.current = [];

    if (normalizedQueries.length === 0) {
      setRouteStatus("");
      return;
    }

    if (normalizedQueries.length < 2) {
      setRouteStatus(routeNeedTwoPointsText);
      return;
    }

    let isCancelled = false;
    setRouteStatus(routeBuildingText);

    Promise.all(
      normalizedQueries.map((query) => resolveRoutePoint(ymaps, query)),
    )
      .then((resolvedPoints) => {
        if (isCancelled) {
          return;
        }

        const validPoints = resolvedPoints.filter(
          (point): point is ResolvedRoutePoint => Boolean(point),
        );

        const missingQueries = normalizedQueries.filter(
          (query) => !validPoints.some((point) => point.query === query),
        );

        if (missingQueries.length > 0) {
          console.error("Some route points could not be geocoded for Yandex Maps:", {
            requestedPoints: normalizedQueries,
            resolvedPoints: validPoints.map((point) => point.query),
            missingPoints: missingQueries,
          });
          setRouteStatus(`${routeMissingPointsText}: ${missingQueries.join("; ")}`);
          return;
        }

        if (validPoints.length < 2) {
          setRouteStatus(routeNeedTwoPointsText);
          return;
        }

        const orderedPoints = validPoints;
        console.info("Building Yandex route with points from GigaChat/backend:", {
          requestedPoints: normalizedQueries,
          resolvedPoints: orderedPoints.map((point) => point.address),
        });

        routePointsRef.current = orderedPoints.map((point, index) => {
          const markerColor = index === 0 ? "#16a34a" : getSegmentColor(index - 1);
          const placemark = new ymaps.Placemark(
            point.coordinates,
            {
              balloonContentHeader:
                index === 0 ? "Старт маршрута" : `Точка ${index + 1}`,
              balloonContentBody: escapeHtml(point.address),
              balloonContentFooter:
                point.query !== point.address ? escapeHtml(point.query) : "",
              hintContent: point.address,
              iconNumber: index + 1,
            },
            {
              iconLayout: "default#imageWithContent",
              iconImageHref: createMarkerIcon(markerColor),
              iconImageSize: [38, 38],
              iconImageOffset: [-19, -19],
              iconContentLayout: numberedMarkerContentLayoutRef.current,
              iconContentOffset: [0, 0],
              zIndex: 1500,
            },
          );

          map.geoObjects.add(placemark);
          return placemark;
        });

        const segmentRoutes = orderedPoints.slice(0, -1).map((point, index) => {
          const segmentColor = getSegmentColor(index);
          const nextPoint = orderedPoints[index + 1];
          const segmentRoute = new ymaps.multiRouter.MultiRoute(
            {
              referencePoints: [point.coordinates, nextPoint.coordinates],
              params: {
                routingMode: "auto",
                results: 1,
              },
            },
            {
              boundsAutoApply: index === orderedPoints.length - 2,
              routeActiveStrokeColor: segmentColor,
              routeActiveStrokeWidth: 6,
              routeStrokeColor: segmentColor,
              routeStrokeWidth: 6,
              routeOpacity: 0.9,
              wayPointVisible: false,
              viaPointVisible: false,
              pinVisible: false,
            },
          );

          map.geoObjects.add(segmentRoute);
          return segmentRoute;
        });

        routeRefs.current = segmentRoutes;

        let successCount = 0;
        let hasFailed = false;

        segmentRoutes.forEach((segmentRoute) => {
          segmentRoute.model.events.add("requestsuccess", () => {
            if (isCancelled || hasFailed) {
              return;
            }

            successCount += 1;

            if (successCount === segmentRoutes.length) {
              setRouteStatus(routeReadyText);
            }
          });

          segmentRoute.model.events.add("requestfail", () => {
            if (isCancelled || hasFailed) {
              return;
            }

            hasFailed = true;
            setRouteStatus(routeFailedText);
          });
        });
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Failed to build Yandex route:", error);
          setRouteStatus(routeFailedText);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    isMapReady,
    routeBuildingText,
    routeFailedText,
    routeNeedTwoPointsText,
    routeMissingPointsText,
    routeQueries,
    routeReadyText,
  ]);

  return (
    <div className="relative h-full w-full min-h-[320px] max-w-full">
      <div ref={mapRef} className="h-full w-full min-h-[320px] max-w-full" />
      {routeStatus ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-sm rounded-xl border bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-sm">
          {routeStatus}
        </div>
      ) : null}
    </div>
  );
}
