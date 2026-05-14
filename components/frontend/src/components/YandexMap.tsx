import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl } from "@/lib/api";
import {
  loadYandexMaps,
  type YandexGeoObject,
  type YandexLayoutClass,
  type YandexMapClickEvent,
  type YandexMapCoordinate,
  type YandexMapInstance,
  type YandexMapsNamespace,
} from "@/yandex-maps";

interface YandexMapProps {
  routeQueries?: string[];
  routeBuildingText: string;
  routeReadyText: string;
  routeFailedText: string;
  addToRouteLabel?: string;
  onAddressSelect?: (selection: YandexAddressSelection) => void;
}

interface YandexAddressSelection {
  address: string;
  coordinates: string;
  lat: number;
  lng: number;
}

interface RouteRenderPoint {
  query: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

interface RouteRenderSegment {
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
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

function isCoordinateAddress(value: string, coordinatesText: string) {
  const normalizedValue = value.trim();
  const normalizedCoordinates = coordinatesText.trim();

  if (!normalizedValue) {
    return true;
  }

  if (normalizedCoordinates && normalizedValue === normalizedCoordinates) {
    return true;
  }

  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(normalizedValue);
}

function isUsableAddress(
  value: string,
  coordinatesText: string,
  addressNotSetText: string,
) {
  const normalizedValue = value.trim();

  return (
    Boolean(normalizedValue) &&
    normalizedValue !== addressNotSetText &&
    !isCoordinateAddress(normalizedValue, coordinatesText)
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNestedString(value: unknown, path: string[]) {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return "";
    }

    current = (current as Record<string, unknown>)[key];
  }

  return readString(current);
}

function getYandexGeoObjectAddress(geoObject: YandexGeoObject | undefined) {
  if (!geoObject) {
    return "";
  }

  const readProperty = (key: string) => readString(geoObject.properties.get(key));
  let directAddress = "";

  try {
    directAddress = readString(geoObject.getAddressLine?.());
  } catch {
    directAddress = "";
  }

  if (directAddress) {
    return directAddress;
  }

  const metaData = geoObject.properties.get("metaDataProperty");
  const geocoderMetaData =
    readNestedString(metaData, ["GeocoderMetaData", "text"]) ||
    readProperty("metaDataProperty.GeocoderMetaData.text");
  if (geocoderMetaData) {
    return geocoderMetaData;
  }

  const formattedAddress =
    readNestedString(
      metaData,
      ["GeocoderMetaData", "Address", "formatted"],
    ) ||
    readProperty("metaDataProperty.GeocoderMetaData.Address.formatted");
  if (formattedAddress) {
    return formattedAddress;
  }

  return (
    readProperty("text") ||
    readProperty("name") ||
    readProperty("description")
  );
}

function hasSameCoordinatesText(
  geoObject: YandexGeoObject | null | undefined,
  coordinatesText: string,
) {
  return (
    String(geoObject?.properties.get("coordinatesText") ?? "").trim() ===
    coordinatesText
  );
}

async function resolveAddressForCoordinates(
  ymaps: YandexMapsNamespace,
  coordinates: YandexMapCoordinate,
  coordinatesText: string,
) {
  const [latitude, longitude] = coordinates;

  try {
    const response = await fetch(buildApiUrl("/api/maps/reverse-geocode"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude,
        longitude,
      }),
    });

    if (response.ok) {
      const result = (await response.json()) as { address?: string };
      const resolvedAddress =
        typeof result?.address === "string" ? result.address.trim() : "";
      if (!isCoordinateAddress(resolvedAddress, coordinatesText)) {
        return resolvedAddress;
      }
    }
  } catch (error) {
    console.error("Backend reverse geocoding failed:", error);
  }

  try {
    const geocodeAttempts: Array<Record<string, unknown>> = [
      { results: 1, kind: "house" },
      { results: 1 },
    ];

    for (const options of geocodeAttempts) {
      const result = await ymaps.geocode(coordinates, options);
      const resolvedAddress = getYandexGeoObjectAddress(result.geoObjects?.get(0));
      if (!isCoordinateAddress(resolvedAddress, coordinatesText)) {
        return resolvedAddress;
      }
    }
  } catch (error) {
    console.error("Yandex reverse geocoding failed:", error);
  }

  return "";
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

function toCoordinatePair(point: {
  latitude: number;
  longitude: number;
}): YandexMapCoordinate {
  return [point.latitude, point.longitude];
}

export function YandexMap({
  routeQueries = [],
  routeBuildingText,
  routeReadyText,
  routeFailedText,
  addToRouteLabel,
  onAddressSelect,
}: YandexMapProps) {
  const { copy } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<YandexMapInstance | null>(null);
  const ymapsRef = useRef<YandexMapsNamespace | null>(null);
  const selectedPointRef = useRef<YandexGeoObject | null>(null);
  const numberedMarkerContentLayoutRef = useRef<YandexLayoutClass | null>(null);
  const routeObjectsRef = useRef<unknown[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routeStatus, setRouteStatus] = useState("");

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    let isCancelled = false;

    loadYandexMaps()
      .then((ymaps) => {
        if (isCancelled || !mapRef.current) {
          return;
        }

        const actionLabel = escapeHtml(addToRouteLabel ?? copy.chat.addToRoute);
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
                  ${actionLabel}
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
              const coordinates = geoObject.geometry?.getCoordinates?.() as
                | YandexMapCoordinate
                | undefined;
              const latitude = Number(coordinates?.[0]);
              const longitude = Number(coordinates?.[1]);
              const coordinatesText = String(
                geoObject.properties.get("coordinatesText") ?? "",
              ).trim();
              const currentAddressText = String(
                geoObject.properties.get("addressText") ?? "",
              ).trim();

              const notifySelection = (
                address: string,
                { closeBalloon = true }: { closeBalloon?: boolean } = {},
              ) => {
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                  return false;
                }

                const detail = {
                  address: address.trim(),
                  coordinates: coordinatesText,
                  lat: latitude,
                  lng: longitude,
                };

                if (onAddressSelect) {
                  onAddressSelect(detail);
                } else {
                  window.dispatchEvent(
                    new CustomEvent("map-add-to-route", { detail }),
                  );
                }
                if (closeBalloon) {
                  geoObject.balloon.close();
                }
                return true;
              };

              if (isUsableAddress(
                currentAddressText,
                coordinatesText,
                copy.partnerPlaces.addressNotSet,
              )) {
                notifySelection(currentAddressText);
                return;
              }

              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
              }

              geoObject.properties.set({
                address: escapeHtml(copy.partnerPlaces.searchingAddress),
                addressText: "",
                hintContent: copy.partnerPlaces.searchingAddress,
              });
              geoObject.balloon.open();

              void resolveAddressForCoordinates(
                ymaps,
                [latitude, longitude],
                coordinatesText,
              )
                .then((resolvedAddress) => {
                  if (!hasSameCoordinatesText(geoObject, coordinatesText)) {
                    return;
                  }

                  if (!resolvedAddress) {
                    geoObject.properties.set({
                      address: escapeHtml(copy.partnerPlaces.addressNotSet),
                      addressText: copy.partnerPlaces.addressNotSet,
                      hintContent: copy.partnerPlaces.addressNotSet,
                    });
                    geoObject.balloon.open();
                    notifySelection("", { closeBalloon: false });
                    return;
                  }

                  geoObject.properties.set({
                    address: escapeHtml(resolvedAddress),
                    addressText: resolvedAddress,
                    hintContent: resolvedAddress,
                  });
                  notifySelection(resolvedAddress);
                })
                .catch((error) => {
                  console.error("Reverse geocoding failed during add to route:", error);
                  if (!hasSameCoordinatesText(geoObject, coordinatesText)) {
                    return;
                  }

                  geoObject.properties.set({
                    address: escapeHtml(copy.partnerPlaces.addressNotSet),
                    addressText: copy.partnerPlaces.addressNotSet,
                    hintContent: copy.partnerPlaces.addressNotSet,
                  });
                  geoObject.balloon.open();
                  notifySelection("", { closeBalloon: false });
                });
            },
          },
        );
        const CompactBalloonContentLayout = ymaps.templateLayoutFactory.createClass(`
          <div style="font-size: 12px; line-height: 1.3; color: #111827;">
            {{ properties.address }}
          </div>
        `);

        ymapsRef.current = ymaps;
        mapInstanceRef.current?.destroy();
        mapInstanceRef.current = new ymaps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          controls: ["zoomControl"],
        });

        mapInstanceRef.current.events.add("click", (event: YandexMapClickEvent) => {
          const coordinates = event.get("coords");
          const [latitude, longitude] = coordinates;
          const coordText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

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
            mapInstanceRef.current?.geoObjects.add(selectedPointRef.current);
          } else {
            selectedPointRef.current.geometry.setCoordinates(coordinates);
          }

          selectedPointRef.current.properties.set({
            address: escapeHtml(copy.partnerPlaces.searchingAddress),
            coordinates: escapeHtml(coordText),
            addressText: "",
            coordinatesText: coordText,
            hintContent: copy.partnerPlaces.searchingAddress,
          });
          selectedPointRef.current.balloon.open();

          void resolveAddressForCoordinates(ymaps, coordinates, coordText)
            .then((resolvedAddress) => {
              if (!hasSameCoordinatesText(selectedPointRef.current, coordText)) {
                return;
              }

              const addressText = resolvedAddress || copy.partnerPlaces.addressNotSet;

              selectedPointRef.current?.properties.set({
                address: escapeHtml(addressText),
                coordinates: escapeHtml(coordText),
                addressText,
                coordinatesText: coordText,
                hintContent: addressText,
              });
              selectedPointRef.current?.balloon.open();
            })
            .catch((error) => {
              console.error("Reverse geocoding failed:", error);
              if (!hasSameCoordinatesText(selectedPointRef.current, coordText)) {
                return;
              }

              selectedPointRef.current?.properties.set({
                address: escapeHtml(copy.partnerPlaces.addressNotSet),
                addressText: copy.partnerPlaces.addressNotSet,
                hintContent: copy.partnerPlaces.addressNotSet,
              });
              selectedPointRef.current?.balloon.open();
            });
        });
        setIsMapReady(true);
      })
      .catch((error) => {
        console.error("Error loading Yandex Maps:", error);
        if (!isCancelled) {
          setRouteStatus(copy.chat.mapsLoadError);
        }
      });

    return () => {
      isCancelled = true;
      setIsMapReady(false);
      selectedPointRef.current = null;
      numberedMarkerContentLayoutRef.current = null;
      routeObjectsRef.current = [];
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      ymapsRef.current = null;
    };
  }, [
    addToRouteLabel,
    copy.chat.addToRoute,
    copy.chat.mapsLoadError,
    copy.partnerPlaces.addressNotSet,
    copy.partnerPlaces.searchingAddress,
    onAddressSelect,
  ]);

  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !ymapsRef.current) {
      return;
    }

    const normalizedQueries = routeQueries
      .map((query) => query.trim())
      .filter(Boolean);
    const map = mapInstanceRef.current;
    const ymaps = ymapsRef.current;

    routeObjectsRef.current.forEach((object) => {
      map.geoObjects.remove(object);
    });
    routeObjectsRef.current = [];

    if (normalizedQueries.length === 0) {
      setRouteStatus("");
      return;
    }

    let isCancelled = false;
    setRouteStatus(routeBuildingText);

    void fetch(buildApiUrl("/routes/render-data"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routeQueries: normalizedQueries,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Route render request failed with status ${response.status}`);
        }

        return response.json();
      })
      .then((payload: { routePoints?: RouteRenderPoint[]; routeSegments?: RouteRenderSegment[] }) => {
        if (isCancelled) {
          return;
        }

        const routePoints = Array.isArray(payload?.routePoints)
          ? payload.routePoints.filter(
              (point) =>
                Number.isFinite(point?.coordinates?.latitude)
                && Number.isFinite(point?.coordinates?.longitude),
            )
          : [];
        const routeSegments = Array.isArray(payload?.routeSegments)
          ? payload.routeSegments
          : [];

        if (routePoints.length === 0) {
          setRouteStatus(routeFailedText);
          return;
        }

        routePoints.forEach((point, index) => {
          const markerColor = index === 0 ? "#16a34a" : getSegmentColor(index - 1);
          const placemark = new ymaps.Placemark(
            toCoordinatePair(point.coordinates),
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
          routeObjectsRef.current.push(placemark);
        });

        routeSegments.forEach((segment, index) => {
          const segmentCoordinates = Array.isArray(segment?.coordinates)
            ? segment.coordinates
                .filter(
                  (point) =>
                    Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude),
                )
                .map(toCoordinatePair)
            : [];

          if (segmentCoordinates.length < 2) {
            return;
          }

          const polyline = new ymaps.Polyline(
            segmentCoordinates,
            {},
            {
              strokeColor: getSegmentColor(index),
              strokeWidth: 6,
              strokeOpacity: 0.9,
              zIndex: 900,
            },
          );

          map.geoObjects.add(polyline);
          routeObjectsRef.current.push(polyline);
        });

        const bounds = map.geoObjects.getBounds?.();
        if (bounds) {
          map.setBounds?.(bounds, {
            checkZoomRange: true,
            zoomMargin: 32,
          });
        } else if (routePoints.length === 1) {
          map.setCenter?.(toCoordinatePair(routePoints[0].coordinates), DEFAULT_ZOOM);
        }

        setRouteStatus(routeReadyText);
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Failed to build route render data:", error);
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
