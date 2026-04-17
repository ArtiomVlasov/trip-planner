import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  geocodeAddressSuggestions,
  getYandexMapsApiKey,
  type YandexAddressSuggestion,
} from "@/yandex-maps";

interface AddressAutocompleteFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (suggestion: YandexAddressSuggestion) => void;
  placeholder: string;
  hint: string;
  searchingText: string;
  noMatchesText: string;
  coordinatesLabel: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  disabled?: boolean;
}

function formatDetectedCoordinates(
  latitude?: number | string | null,
  longitude?: number | string | null,
) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") {
    return null;
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
    return null;
  }

  return `${parsedLatitude.toFixed(6)}, ${parsedLongitude.toFixed(6)}`;
}

export function AddressAutocompleteField({
  value,
  onValueChange,
  onSelect,
  placeholder,
  hint,
  searchingText,
  noMatchesText,
  coordinatesLabel,
  latitude,
  longitude,
  disabled = false,
}: AddressAutocompleteFieldProps) {
  const [mapsReady, setMapsReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<YandexAddressSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;

    getYandexMapsApiKey()
      .then(() => {
        if (!cancelled) {
          setMapsReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Yandex Maps key:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = value.trim();

    if (!mapsReady || disabled || query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextSuggestions = await geocodeAddressSuggestions(query, 5);
        if (!cancelled) {
          setSuggestions(nextSuggestions);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [disabled, mapsReady, value]);

  const detectedCoordinates = formatDetectedCoordinates(latitude, longitude);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
            }, 150);
          }}
          onChange={(event) => onValueChange(event.target.value)}
        />
        {open &&
        !disabled &&
        (loading || suggestions.length > 0 || value.trim().length >= 3) ? (
          <div className="absolute z-50 mt-2 w-full rounded-md border bg-background shadow-lg">
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {searchingText}
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.address}-${suggestion.lat}-${suggestion.lng}`}
                  type="button"
                  className="w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(suggestion);
                    setSuggestions([]);
                    setOpen(false);
                  }}
                >
                  {suggestion.address}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {noMatchesText}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {detectedCoordinates
          ? `${coordinatesLabel}: ${detectedCoordinates}`
          : hint}
      </p>
    </div>
  );
}
