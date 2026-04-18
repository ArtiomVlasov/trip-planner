import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadYandexMaps } from "@/yandex-maps";

interface YandexMapProps {
  apiKey: string;
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

export function YandexMap({ apiKey }: YandexMapProps) {
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
                <button type="button" data-action="add-route" style="margin-top: 10px; width: 100%; border: 0; border-radius: 10px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: 12px; line-height: 1; padding: 10px 12px; cursor: pointer;">
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
      mapInstanceRef.current?.destroy();
      mapInstanceRef.current = null;
      ymapsRef.current = null;
    };
  }, [apiKey, copy.chat.addToRoute]);

  return <div ref={mapRef} className="w-full h-full min-h-[320px] max-w-full" />;
}
