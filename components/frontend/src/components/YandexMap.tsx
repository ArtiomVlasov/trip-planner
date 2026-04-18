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

        ymapsRef.current = ymaps;
        mapInstanceRef.current?.destroy();
        mapInstanceRef.current = new ymaps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          controls: ["zoomControl"],
        });
        setIsMapReady(true);
      })
      .catch((error) => {
        console.error("Error loading Yandex Maps:", error);
      });

    return () => {
      isCancelled = true;
      setIsMapReady(false);
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      ymapsRef.current = null;
    };
  }, [apiKey]);

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

  return <div ref={mapRef} className="w-full h-full min-h-[320px] max-w-full" />;
}
