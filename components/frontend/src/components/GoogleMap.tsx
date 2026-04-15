import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";

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

interface GoogleMapProps {
  apiKey: string;
  routeData: RouteData[];
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export function GoogleMap({ apiKey, routeData }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
  };

  useEffect(() => {
    if (!apiKey || !mapRef.current) {
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["geometry"],
    });

    loader
      .load()
      .then(() => {
        if (!mapRef.current) {
          return;
        }

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 43.602314, lng: 39.73444 },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
            { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#bae6fd" }] },
          ],
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
      })
      .catch(() => undefined);
  }, [apiKey]);

  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    const route = routeData[0];

    clearMarkers();
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!route) {
      map.setCenter({ lat: 43.602314, lng: 39.73444 });
      map.setZoom(13);
      return;
    }

    try {
      const path = google.maps.geometry.encoding.decodePath(route.polyline);
      const bounds = new google.maps.LatLngBounds();

      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#0f172a",
        strokeOpacity: 1,
        strokeWeight: 4,
      });
      polyline.setMap(map);
      polylineRef.current = polyline;

      const createMarker = (
        position: { lat: number; lng: number },
        label: string,
        info?: RouteData[0]["intermediates"][number]["placeInfo"],
      ) => {
        const marker = new google.maps.Marker({
          position,
          map,
          label,
        });

        bounds.extend(position);

        if (info) {
          marker.addListener("click", () => {
            infoWindowRef.current?.setContent(`
              <div style="min-width:220px;font-family:Inter,sans-serif;line-height:1.5">
                ${info.photo_url ? `<img src="${info.photo_url}" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-bottom:10px;" />` : ""}
                <strong>${info.name || "Place"}</strong><br/>
                <small>${info.address || ""}</small><br/>
                <span>⭐ ${info.rating ?? "-"}</span>
                <span style="margin-left:10px">💰 ${info.price_level ?? "-"}</span>
              </div>
            `);
            infoWindowRef.current?.open(map, marker);
          });
        }

        markersRef.current.push(marker);
      };

      createMarker(route.origin, "S");
      createMarker(route.destination, "E");
      route.intermediates.forEach((waypoint, index) => createMarker(waypoint, String(index + 1), waypoint.placeInfo));

      path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    } catch {
      map.setCenter({ lat: 43.602314, lng: 39.73444 });
      map.setZoom(13);
    }
  }, [routeData]);

  return <div ref={mapRef} className="h-full min-h-[24rem] w-full" />;
}
