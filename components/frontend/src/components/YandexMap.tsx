import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadYandexMaps } from "@/yandex-maps";

interface RouteData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  intermediates: {
    lat: number;
    lng: number;
    placeInfo?: {
      name?: string;
      address?: string;
      rating?: number;
      price_level?: number;
      photo_url?: string;
    };
  }[];
  polyline: string;
  optimizedOrder: number[];
}

interface YandexMapProps {
  apiKey: string;
  routeData: RouteData[];
}

type MapCoordinate = [number, number];

const DEFAULT_CENTER: MapCoordinate = [43.602314, 39.73444];
const DEFAULT_ZOOM = 14;

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

function getAddressParts(geoObject: any) {
  const metaData = geoObject?.properties?.get?.("metaDataProperty.GeocoderMetaData");
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

function decodeGooglePolyline(encoded: string): MapCoordinate[] {
  const coordinates: MapCoordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([latitude / 1e5, longitude / 1e5]);
  }

  return coordinates;
}

function buildFallbackPath(route: RouteData): MapCoordinate[] {
  const points = [route.origin, ...(route.intermediates ?? []), route.destination];

  return points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => [point.lat, point.lng]);
}

function getPlacemarkPreset(label: string) {
  if (label === "S") {
    return "islands#greenStretchyIcon";
  }

  if (label === "E") {
    return "islands#redStretchyIcon";
  }

  return "islands#blueStretchyIcon";
}

export function YandexMap({ apiKey, routeData }: YandexMapProps) {
  const { copy } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const ymapsRef = useRef<any | null>(null);
  const selectedPointRef = useRef<any | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

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
        const CompactBalloonLayout = ymaps.templateLayoutFactory.createClass(
          `
            <div style="position: absolute; transform: translate(-50%, calc(-100% - 12px));">
              <div style="min-width: 220px; max-width: 260px; border-radius: 14px; padding: 12px 14px; background: #ffffff; border: 1px solid #e5e7eb; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); font-family: sans-serif; position: relative;">
                <button type="button" data-action="close" style="position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border: 0; background: transparent; color: #6b7280; font-size: 16px; line-height: 20px; cursor: pointer; padding: 0;">×</button>
                <div style="padding-right: 18px;">
                  $[[options.contentLayout]]
                </div>
                <button type="button" data-action="add-route" style="margin-top: 10px; width: 100%; border: 0; border-radius: 10px; background: #111827; color: #ffffff; font-size: 12px; line-height: 1; padding: 10px 12px; cursor: pointer;">
                  ${addToRouteLabel}
                </button>
              </div>
            </div>
          `,
          {
            build() {
              // @ts-expect-error Yandex layout superclass typing is unavailable here.
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
              // @ts-expect-error Yandex layout superclass typing is unavailable here.
              CompactBalloonLayout.superclass.clear.call(this);
            },
            handleCloseClick(event: Event) {
              event.preventDefault();
              this.getData().geoObject.balloon.close();
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
          <div style="font-size: 14px; line-height: 1.4; color: #111827;">
            {{ properties.address }}
          </div>
          <div style="margin-top: 6px; font-size: 11px; line-height: 1.4; color: #6b7280;">
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

        mapInstanceRef.current.events.add("click", async (event: any) => {
          const coordinates = event.get("coords") as MapCoordinate;
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
                  preset: "islands#violetDotIcon",
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

    map.geoObjects.removeAll();

    if (!routeData.length) {
      map.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const route = routeData[0];
    const geoObjects = new ymaps.GeoObjectCollection();

    const createBalloonContent = (info?: RouteData["intermediates"][number]["placeInfo"]) => {
      if (!info) {
        return undefined;
      }

      const name = escapeHtml(info.name ?? copy.map.unknownPlace);
      const address = escapeHtml(info.address);
      const rating = escapeHtml(info.rating ?? "-");
      const priceLevel = escapeHtml(info.price_level ?? "-");
      const photoUrl = escapeHtml(info.photo_url);

      return {
        balloonContentHeader: name,
        balloonContentBody: `
          <div style="min-width:220px; font-family: sans-serif;">
            ${photoUrl ? `<img src="${photoUrl}" style="width:100%; height:120px; object-fit:cover; border-radius:6px; margin-bottom:6px;" />` : ""}
            <strong>${name}</strong><br/>
            ${address ? `<small>${address}</small><br/>` : ""}
            ⭐ ${rating} &nbsp; 💰 ${priceLevel}
          </div>
        `,
      };
    };

    const createPlacemark = (
      coordinates: MapCoordinate,
      label: string,
      info?: RouteData["intermediates"][number]["placeInfo"],
    ) =>
      new ymaps.Placemark(
        coordinates,
        {
          iconContent: label,
          hintContent: info?.name ?? label,
          ...(createBalloonContent(info) ?? {}),
        },
        {
          preset: getPlacemarkPreset(label),
          hideIconOnBalloonOpen: false,
        },
      );

    let path = route.polyline ? decodeGooglePolyline(route.polyline) : [];
    if (path.length < 2) {
      path = buildFallbackPath(route);
    }

    if (path.length >= 2) {
      geoObjects.add(
        new ymaps.Polyline(
          path,
          {},
          {
            strokeColor: "#1EA7FD",
            strokeWidth: 4,
            strokeOpacity: 0.9,
          },
        ),
      );
    }

    geoObjects.add(createPlacemark([route.origin.lat, route.origin.lng], "S"));
    geoObjects.add(createPlacemark([route.destination.lat, route.destination.lng], "E"));

    route.intermediates?.forEach((waypoint, index) => {
      geoObjects.add(
        createPlacemark(
          [waypoint.lat, waypoint.lng],
          `${index + 1}`,
          waypoint.placeInfo,
        ),
      );
    });

    map.geoObjects.add(geoObjects);

    const bounds = geoObjects.getBounds();
    if (bounds) {
      map.setBounds(bounds, { checkZoomRange: true });
    } else if (path.length > 0) {
      map.setCenter(path[0], DEFAULT_ZOOM);
    }
  }, [copy.map.unknownPlace, isMapReady, routeData]);

  return <div ref={mapRef} className="w-full h-[calc(100vh-120px)] min-h-[400px] max-w-full" />;
}
