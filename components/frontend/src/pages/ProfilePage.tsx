import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { buildApiUrl } from "@/lib/api";
import {
  BUDGET_LEVELS,
  getBudgetLevelLabel,
  getTransportModeLabel,
  PREFERRED_PLACE_TYPES,
  RATING_THRESHOLDS,
  TRANSPORT_MODES,
} from "@/lib/travel-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface ProfileData {
  username: string;
  email: string;
  preferred_types?: string[];
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
  };
  availability?: {
    start_time?: number | null;
    end_time?: number | null;
  };
}

type EditBlock = "preferences" | "preferred_types" | "starting_point" | "availability" | null;

function toTimeInputValue(value?: number | string | null) {
  if (value == null || value === "") {
    return "";
  }

  const digits = value.toString().padStart(4, "0");
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function toStoredTime(value: string) {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(":");
  return Number(`${hours}${minutes}`);
}

function formatTime(value?: number | string | null) {
  return toTimeInputValue(value) || "—";
}

function getOrderedPreferredTypes(types: string[] = []) {
  const knownTypes = PREFERRED_PLACE_TYPES.filter((type) => types.includes(type));
  const customTypes = types.filter((type) => !PREFERRED_PLACE_TYPES.includes(type));
  return [...knownTypes, ...customTypes];
}

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editBlock, setEditBlock] = useState<EditBlock>(null);
  const [formData, setFormData] = useState<ProfileData | null>(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(buildApiUrl("/users/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setFormData(data);
      })
      .catch(() => toast.error("Failed to load profile"));
  }, [token]);

  const handleSave = async (block: Exclude<EditBlock, null>) => {
    if (!formData) return;

    if (block === "preferred_types" && !formData.preferred_types?.length) {
      toast.error("Please select at least one preferred place type");
      return;
    }

    const payload = {
      user: {
        preferences: block === "preferences" ? formData.preferences : null,
        starting_points: block === "starting_point" ? formData.starting_point : null,
        availability: block === "availability" ? formData.availability : null,
        preferred_types: block === "preferred_types" ? formData.preferred_types : null,
      },
    };

    try {
      const res = await fetch(buildApiUrl("/users/me"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      toast.success("Updated successfully");
      setEditBlock(null);
      setProfile((currentProfile) => {
        if (!currentProfile) {
          return currentProfile;
        }

        const updatedProfile = { ...currentProfile };
        if (block === "preferences") updatedProfile.preferences = formData.preferences;
        if (block === "starting_point") updatedProfile.starting_point = formData.starting_point;
        if (block === "availability") updatedProfile.availability = formData.availability;
        if (block === "preferred_types") updatedProfile.preferred_types = formData.preferred_types;

        return updatedProfile;
      });
    } catch {
      toast.error("Failed to update");
    }
  };

  const togglePreferredType = (type: string) => {
    setFormData((current) => {
      if (!current) {
        return current;
      }

      const currentTypes = current.preferred_types ?? [];
      return {
        ...current,
        preferred_types: currentTypes.includes(type)
          ? currentTypes.filter((currentType) => currentType !== type)
          : [...currentTypes, type],
      };
    });
  };

  if (!profile || !formData) {
    return <div className="p-8">Loading profile…</div>;
  }

  const visiblePreferredTypes = getOrderedPreferredTypes(profile.preferred_types ?? []);

  return (
    <div className="container mx-auto p-8 max-w-3xl space-y-6">
      <Button variant="outline" onClick={() => navigate(-1)}>← Back</Button>

      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">User Info</h2>
        <p><b>Username:</b> {profile.username}</p>
        <p><b>Email:</b> {profile.email}</p>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Preferences</h2>
          <Button size="sm" onClick={() => setEditBlock(editBlock === "preferences" ? null : "preferences")}>
            {editBlock === "preferences" ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editBlock === "preferences" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-walking-distance">Max walking distance (meters)</Label>
                <Input
                  id="max-walking-distance"
                  type="number"
                  min="100"
                  max="5000"
                  value={formData.preferences?.max_walking_distance_meters ?? ""}
                  onChange={(e) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        max_walking_distance_meters: e.target.value ? Number(e.target.value) : null,
                      },
                    };
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Budget level</Label>
                <Select
                  value={formData.preferences?.budget_level != null ? String(formData.preferences.budget_level) : undefined}
                  onValueChange={(value) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        budget_level: Number(value),
                      },
                    };
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget level" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rating threshold</Label>
                <Select
                  value={formData.preferences?.rating_threshold != null ? String(formData.preferences.rating_threshold) : undefined}
                  onValueChange={(value) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        rating_threshold: Number(value),
                      },
                    };
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating threshold" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATING_THRESHOLDS.map((threshold) => (
                      <SelectItem key={threshold.value} value={threshold.value}>
                        {threshold.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transport mode</Label>
                <Select
                  value={formData.preferences?.transport_mode ?? undefined}
                  onValueChange={(value) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      preferences: {
                        ...(current.preferences ?? {}),
                        transport_mode: value,
                      },
                    };
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transport mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Breakfast outside</p>
                <p className="text-sm text-muted-foreground">Use it when nearby breakfast spots should be favored.</p>
              </div>
              <Switch
                checked={Boolean(formData.preferences?.likes_breakfast_outside)}
                onCheckedChange={(checked) => setFormData((current) => {
                  if (!current) return current;
                  return {
                    ...current,
                    preferences: {
                      ...(current.preferences ?? {}),
                      likes_breakfast_outside: checked,
                    },
                  };
                })}
              />
            </div>

            <Button size="sm" onClick={() => handleSave("preferences")}>Apply</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p>Transport: {getTransportModeLabel(profile.preferences?.transport_mode)}</p>
            <p>Budget level: {getBudgetLevelLabel(profile.preferences?.budget_level)}</p>
            <p>
              Rating threshold: {profile.preferences?.rating_threshold != null
                ? `${profile.preferences.rating_threshold}+ Stars`
                : "—"}
            </p>
            <p>
              Max walking distance: {profile.preferences?.max_walking_distance_meters != null
                ? `${profile.preferences.max_walking_distance_meters} m`
                : "—"}
            </p>
            <p>
              Breakfast outside: {profile.preferences?.likes_breakfast_outside == null
                ? "—"
                : profile.preferences.likes_breakfast_outside ? "Yes" : "No"}
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Availability</h2>
          <Button size="sm" onClick={() => setEditBlock(editBlock === "availability" ? null : "availability")}>
            {editBlock === "availability" ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editBlock === "availability" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="availability-start">Available from</Label>
                <Input
                  id="availability-start"
                  type="time"
                  value={toTimeInputValue(formData.availability?.start_time)}
                  onChange={(e) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      availability: {
                        ...(current.availability ?? {}),
                        start_time: toStoredTime(e.target.value),
                      },
                    };
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="availability-end">Available until</Label>
                <Input
                  id="availability-end"
                  type="time"
                  value={toTimeInputValue(formData.availability?.end_time)}
                  onChange={(e) => setFormData((current) => {
                    if (!current) return current;
                    return {
                      ...current,
                      availability: {
                        ...(current.availability ?? {}),
                        end_time: toStoredTime(e.target.value),
                      },
                    };
                  })}
                />
              </div>
            </div>

            <Button size="sm" onClick={() => handleSave("availability")}>Apply</Button>
          </div>
        ) : (
          <p>
            {formatTime(profile.availability?.start_time)} – {formatTime(profile.availability?.end_time)}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Preferred Place Types</h2>
          <Button size="sm" onClick={() => setEditBlock(editBlock === "preferred_types" ? null : "preferred_types")}>
            {editBlock === "preferred_types" ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editBlock === "preferred_types" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These types shape what the planner prioritizes for your routes.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PREFERRED_PLACE_TYPES.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={formData.preferred_types?.includes(type) ? "default" : "outline"}
                  onClick={() => togglePreferredType(type)}
                  className="justify-start whitespace-normal h-auto py-3"
                >
                  {type}
                </Button>
              ))}
            </div>

            <Button size="sm" onClick={() => handleSave("preferred_types")}>Apply</Button>
          </div>
        ) : visiblePreferredTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visiblePreferredTypes.map((type) => (
              <Badge key={type} variant="secondary" className="px-3 py-1">
                {type}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No preferred place types selected yet.</p>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Starting Point</h2>
          <Button size="sm" onClick={() => setEditBlock(editBlock === "starting_point" ? null : "starting_point")}>
            {editBlock === "starting_point" ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editBlock === "starting_point" ? (
          <div className="space-y-4">
            <Input
              placeholder="Name"
              value={formData.starting_point?.name ?? ""}
              onChange={(e) => setFormData((current) => {
                if (!current) return current;
                return {
                  ...current,
                  starting_point: {
                    ...(current.starting_point ?? {}),
                    name: e.target.value || null,
                  },
                };
              })}
            />
            <Input
              placeholder="City"
              value={formData.starting_point?.city ?? ""}
              onChange={(e) => setFormData((current) => {
                if (!current) return current;
                return {
                  ...current,
                  starting_point: {
                    ...(current.starting_point ?? {}),
                    city: e.target.value || null,
                  },
                };
              })}
            />
            <Input
              placeholder="Country"
              value={formData.starting_point?.country ?? ""}
              onChange={(e) => setFormData((current) => {
                if (!current) return current;
                return {
                  ...current,
                  starting_point: {
                    ...(current.starting_point ?? {}),
                    country: e.target.value || null,
                  },
                };
              })}
            />
            <Button size="sm" onClick={() => handleSave("starting_point")}>Apply</Button>
          </div>
        ) : (
          <>
            <p>{profile.starting_point?.name ?? "—"}</p>
            <p>
              {[profile.starting_point?.city, profile.starting_point?.country].filter(Boolean).join(", ") || "—"}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
