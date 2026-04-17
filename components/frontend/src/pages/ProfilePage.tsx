import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { AddressAutocompleteField } from "@/components/AddressAutocompleteField";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl } from "@/lib/api";
import { BUDGET_LEVELS, TRANSPORT_MODES } from "@/lib/travel-preferences";
import { buildStartingPointFromSuggestion } from "@/constants/starting-point";
import { geocodeAddressSuggestions, type YandexAddressSuggestion } from "@/yandex-maps";

interface ProfileData {
  username: string;
  email: string;
  preferences?: {
    max_walking_distance_meters?: number | null;
    budget_level?: number | null;
    rating_threshold?: number | null;
    likes_breakfast_outside?: boolean | null;
    transport_mode?: string | null;
  };
  starting_point?: {
    name?: string | null;
    city?: string | null;
    country?: string | null;
    location?: {
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  };
  availability?: {
    start_time?: number | null;
    end_time?: number | null;
  };
}

function formatTime(value?: number | string) {
  if (value == null) {
    return "—";
  }

  const str = value.toString().padStart(4, "0");
  return `${str.slice(0, 2)}:${str.slice(2)}`;
}

function formatStartingPointMeta(startingPoint?: ProfileData["starting_point"]) {
  const meta = [startingPoint?.city, startingPoint?.country].filter(Boolean);
  return meta.length ? meta.join(", ") : null;
}

export function ProfilePage() {
  const { language, copy } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editBlock, setEditBlock] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileData | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    navigate("/");
  };

  const getOptionLabel = (
    options: Array<{ value: string; label?: string; labels?: Record<"ru" | "en", string> }>,
    value?: string | number | null,
    fallback = copy.profile.notSpecified,
  ) => {
    if (value == null) {
      return fallback;
    }

    const match = options.find((option) => option.value === String(value));
    return match?.labels?.[language] ?? match?.label ?? String(value);
  };

  useEffect(() => {
    fetch(buildApiUrl("/users/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error();
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setFormData(data);
      })
      .catch(() => toast.error(copy.profile.loadError));
  }, [copy.profile.loadError, token]);

  const handleStartingPointValueChange = (address: string) => {
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            starting_point: {
              ...prev.starting_point,
              name: address || null,
              location: null,
            },
          }
        : prev,
    );
  };

  const handleStartingPointSelect = (suggestion: YandexAddressSuggestion) => {
    const nextStartingPoint = buildStartingPointFromSuggestion(suggestion);

    setFormData((prev) =>
      prev
        ? {
            ...prev,
            starting_point: nextStartingPoint,
          }
        : prev,
    );
  };

  const prepareStartingPointPayload = async () => {
    const startingPoint = formData?.starting_point;
    const address = startingPoint?.name?.trim();

    if (!address) {
      throw new Error(copy.profile.enterStartingPointAddress);
    }

    const latitude = startingPoint?.location?.latitude;
    const longitude = startingPoint?.location?.longitude;

    if (latitude != null && longitude != null) {
      return {
        name: address,
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        city: startingPoint.city || "Sochi",
        country: startingPoint.country || "Russia",
      };
    }

    const suggestions = await geocodeAddressSuggestions(address, 1);
    const suggestion = suggestions[0];
    if (!suggestion) {
      throw new Error(copy.profile.addressLookupError);
    }

    return buildStartingPointFromSuggestion(suggestion);
  };

  const handleSave = async (block: string) => {
    if (!formData || !profile) {
      return;
    }

    try {
      const preparedStartingPoint =
        block === "starting_point" ? await prepareStartingPointPayload() : null;

      const payload = {
        user: {
          preferences: block === "preferences" ? formData.preferences : null,
          starting_points:
            block === "starting_point" ? preparedStartingPoint : null,
          availability: block === "availability" ? formData.availability : null,
        },
      };

      const res = await fetch(buildApiUrl("/users/me"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error();
      }

      toast.success(copy.profile.updateSuccess);
      setEditBlock(null);

      const updated = { ...profile };
      if (block === "preferences") {
        updated.preferences = formData.preferences;
      }
      if (block === "starting_point") {
        updated.starting_point = preparedStartingPoint;
        setFormData((prev) =>
          prev ? { ...prev, starting_point: preparedStartingPoint } : prev,
        );
      }
      if (block === "availability") {
        updated.availability = formData.availability;
      }
      setProfile(updated);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : copy.profile.updateError;
      toast.error(message);
    }
  };

  if (!profile || !formData) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AppSidebarMenu isAuth onLogout={handleLogout} />
            <Button variant="outline" onClick={() => navigate(-1)}>
              {copy.profile.back}
            </Button>
          </div>
          <LanguageToggle className="hidden self-start sm:inline-flex" />
        </div>
        <Card className="p-6">{copy.profile.loading}</Card>
      </div>
    );
  }

  const startingPointMeta = formatStartingPointMeta(profile.starting_point);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AppSidebarMenu isAuth onLogout={handleLogout} />
          <Button variant="outline" onClick={() => navigate(-1)}>
            {copy.profile.back}
          </Button>
        </div>
        <LanguageToggle className="hidden self-start sm:inline-flex" />
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-2xl font-bold">{copy.profile.userInfo}</h2>
        <p>
          <b>{copy.profile.username}:</b> {profile.username}
        </p>
        <p>
          <b>{copy.profile.email}:</b> {profile.email}
        </p>
      </Card>

      <Card className="p-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{copy.profile.preferences}</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditBlock(editBlock === "preferences" ? null : "preferences")
            }
          >
            {editBlock === "preferences" ? copy.profile.cancel : copy.profile.edit}
          </Button>
        </div>

        {editBlock === "preferences" ? (
          <div className="space-y-2">
            <Input
              type="number"
              placeholder={copy.profile.maxWalkingDistance}
              value={formData.preferences?.max_walking_distance_meters ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: {
                    ...formData.preferences,
                    max_walking_distance_meters: e.target.value
                      ? Number(e.target.value)
                      : null,
                  },
                })
              }
            />
            <Input
              type="number"
              placeholder={copy.profile.budgetLevel}
              value={formData.preferences?.budget_level ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: {
                    ...formData.preferences,
                    budget_level: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
            <Input
              type="number"
              step="0.1"
              placeholder={copy.profile.ratingThreshold}
              value={formData.preferences?.rating_threshold ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: {
                    ...formData.preferences,
                    rating_threshold: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
            />
            <Input
              type="text"
              placeholder={copy.profile.transportMode}
              value={formData.preferences?.transport_mode ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  preferences: {
                    ...formData.preferences,
                    transport_mode: e.target.value || null,
                  },
                })
              }
            />
            <Button size="sm" onClick={() => handleSave("preferences")}>
              {copy.profile.apply}
            </Button>
          </div>
        ) : (
          <>
            <p>
              {copy.profile.transportMode}:{" "}
              {getOptionLabel(TRANSPORT_MODES, profile.preferences?.transport_mode)}
            </p>
            <p>
              {copy.profile.budgetLevel}:{" "}
              {getOptionLabel(BUDGET_LEVELS, profile.preferences?.budget_level)}
            </p>
            <p>
              {copy.profile.ratingThreshold}:{" "}
              {profile.preferences?.rating_threshold ?? copy.profile.notSpecified}
            </p>
            <p>
              {copy.profile.maxWalkingDistance}:{" "}
              {profile.preferences?.max_walking_distance_meters ??
                copy.profile.notSpecified}{" "}
              {profile.preferences?.max_walking_distance_meters
                ? copy.profile.metersShort
                : ""}
            </p>
            <p>
              {copy.profile.breakfastOutside}:{" "}
              {profile.preferences?.likes_breakfast_outside
                ? copy.profile.yes
                : copy.profile.no}
            </p>
          </>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{copy.profile.startingPoint}</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditBlock(editBlock === "starting_point" ? null : "starting_point")
            }
          >
            {editBlock === "starting_point" ? copy.profile.cancel : copy.profile.edit}
          </Button>
        </div>

        {editBlock === "starting_point" ? (
          <div className="space-y-3">
            <Label>{copy.profile.startingPointAddress}</Label>
            <AddressAutocompleteField
              value={formData.starting_point?.name ?? ""}
              onValueChange={handleStartingPointValueChange}
              onSelect={handleStartingPointSelect}
              placeholder={copy.profile.addressPlaceholder}
              hint={copy.profile.addressHint}
              searchingText={copy.profile.searchingAddress}
              noMatchesText={copy.profile.noAddressMatches}
              coordinatesLabel={copy.profile.coordinatesDetected}
              latitude={formData.starting_point?.location?.latitude}
              longitude={formData.starting_point?.location?.longitude}
            />
            <Button size="sm" onClick={() => handleSave("starting_point")}>
              {copy.profile.apply}
            </Button>
          </div>
        ) : (
          <>
            <p>{profile.starting_point?.name || copy.profile.notSpecified}</p>
            <p>{startingPointMeta || copy.profile.notSpecified}</p>
          </>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{copy.profile.availability}</h2>
          <Button
            size="sm"
            onClick={() =>
              setEditBlock(editBlock === "availability" ? null : "availability")
            }
          >
            {editBlock === "availability" ? copy.profile.cancel : copy.profile.edit}
          </Button>
        </div>

        {editBlock === "availability" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="number"
              value={formData.availability?.start_time ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: {
                    ...formData.availability,
                    start_time: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              placeholder={copy.profile.startTime}
            />
            –
            <Input
              type="number"
              value={formData.availability?.end_time ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: {
                    ...formData.availability,
                    end_time: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              placeholder={copy.profile.endTime}
            />
            <Button size="sm" onClick={() => handleSave("availability")}>
              {copy.profile.apply}
            </Button>
          </div>
        ) : (
          <p>
            {formatTime(profile.availability?.start_time)} –{" "}
            {formatTime(profile.availability?.end_time)}
          </p>
        )}
      </Card>
    </div>
  );
}
