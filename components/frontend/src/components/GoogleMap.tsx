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
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["geometry"],
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 43.602314, lng: 39.734440 }, 
        zoom: 14,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "on" }],
          },
        ],
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new google.maps.InfoWindow();
    }).catch((error) => {
      console.error("Error loading Google Maps:", error);
    });
  }, [apiKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !routeData.length) return;

    const map = mapInstanceRef.current;
    const route = routeData[0];

    clearMarkers();
    if (polylineRef.current) polylineRef.current.setMap(null);

    try {
      const path = google.maps.geometry.encoding.decodePath(route.polyline);

      // Основной полилин
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#1EA7FD",
        strokeOpacity: 1.0,
        strokeWeight: 4,
      });
      polyline.setMap(map);
      polylineRef.current = polyline;

      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));

      // Маркеры
      const createMarker = (position: { lat: number; lng: number }, label: string, info?: any) => {
        const marker = new google.maps.Marker({
          position,
          map,
          label,
        });

        if (info) {
          marker.addListener("click", () => {
            const content = `
              <div style="min-width:220px; font-family: sans-serif;">
                ${
                  info.photo_url
                    ? `<img src="${info.photo_url}" 
                         style="width:100%; height:120px; object-fit:cover; border-radius:6px; margin-bottom:6px;" />`
                    : ""
                }
                <strong>${info.name || "Unknown place"}</strong><br/>
                <small>${info.address || ""}</small><br/>
                ⭐ ${info.rating ?? "-"} &nbsp; 💰 ${info.price_level ?? "-"}
              </div>
            `;

            infoWindowRef.current?.setContent(content);
            infoWindowRef.current?.open(map, marker);
          });
        }

        markersRef.current.push(marker);
      };

      // Start и End
      createMarker(route.origin, "S");
      createMarker(route.destination, "E");

      // Intermediates
      if (route.intermediates && route.intermediates.length > 0) {
        route.intermediates.forEach((wp, index) => {
          createMarker(wp, `${index + 1}`, wp.placeInfo);
        });
      }

      map.fitBounds(bounds);
    } catch (error) {
      console.error("Error decoding polyline:", error);
    }
  }, [routeData]);

  return <div ref={mapRef} className="w-full h-[calc(100vh-120px)] min-h-[400px]" />;
}
