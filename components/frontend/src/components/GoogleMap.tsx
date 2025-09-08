import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";

interface RouteData {
  polyline: {
    encodedPolyline: string;
  };
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

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({
      apiKey: apiKey,
      version: "weekly",
      libraries: ["geometry"]
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 48.8566, lng: 2.3522 }, // Default to Paris
        zoom: 13,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "on" }]
          }
        ]
      });

      mapInstanceRef.current = map;
    }).catch((error) => {
      console.error("Error loading Google Maps:", error);
    });
  }, [apiKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !routeData.length) return;

    // Clear existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const route = routeData[0];
    if (!route?.polyline?.encodedPolyline) return;

    try {
      // Decode the polyline
      const decodedPath = google.maps.geometry.encoding.decodePath(
        route.polyline.encodedPolyline
      );

      // Create polyline
      const polyline = new google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: "#1EA7FD",
        strokeOpacity: 1.0,
        strokeWeight: 4,
      });

      polyline.setMap(mapInstanceRef.current);
      polylineRef.current = polyline;

      // Fit bounds to show entire route
      const bounds = new google.maps.LatLngBounds();
      decodedPath.forEach((point) => bounds.extend(point));
      mapInstanceRef.current.fitBounds(bounds);

      // Add markers for start and end
      if (decodedPath.length > 0) {
        new google.maps.Marker({
          position: decodedPath[0],
          map: mapInstanceRef.current,
          title: "Start",
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#22c55e" stroke="white" stroke-width="2"/>
                <path d="M8 12l2 2 4-4" stroke="white" stroke-width="2" fill="none"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
          },
        });

        new google.maps.Marker({
          position: decodedPath[decodedPath.length - 1],
          map: mapInstanceRef.current,
          title: "End",
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="white" stroke-width="2"/>
                <path d="M8 8l8 8M16 8l-8 8" stroke="white" stroke-width="2"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
          },
        });
      }
    } catch (error) {
      console.error("Error decoding polyline:", error);
    }
  }, [routeData]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[calc(100vh-120px)] min-h-[400px]"
    />
  );
}