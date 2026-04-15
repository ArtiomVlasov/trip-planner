import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildApiUrl } from "@/lib/api";
import { ArrowLeft, MapPin, SlidersHorizontal, UserRound } from "lucide-react";
import { toast } from "sonner";

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
  };
  availability?: {
    start_time?: number | null;
    end_time?: number | null;
  };
}

const formatTime = (value?: number | string | null) => {
  if (value == null) {
    return "—";
  }

  const stringValue = value.toString().padStart(4, "0");
  return `${stringValue.slice(0, 2)}:${stringValue.slice(2)}`;
};

export function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileData | null>(null);
  const [editBlock, setEditBlock] = useState<string | null>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(buildApiUrl("/users/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.json();
      })
      .then((data) => {
        setProfile(data);
        setFormData(data);
      })
      .catch(() => toast.error("Failed to load profile"));
  }, [token]);

  const handleSave = async (block: string) => {
    if (!formData || !profile) {
      return;
    }

    const payload = {
      user: {
        preferences: block === "preferences" ? formData.preferences : null,
        starting_points: block === "starting_point" ? formData.starting_point : null,
        availability: block === "availability" ? formData.availability : null,
      },
    };

    try {
      const response = await fetch(buildApiUrl("/users/me"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error();
      }

      setProfile({
        ...profile,
        preferences: block === "preferences" ? formData.preferences : profile.preferences,
        starting_point: block === "starting_point" ? formData.starting_point : profile.starting_point,
        availability: block === "availability" ? formData.availability : profile.availability,
      });
      setEditBlock(null);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    }
  };

  if (!profile || !formData) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Button variant="outline" className="w-fit rounded-2xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="rounded-[2rem] border-none bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Profile</p>
              <h1 className="mt-2 text-3xl font-semibold">{profile.username}</h1>
              <p className="mt-1 text-sm text-slate-300">{profile.email}</p>
            </div>
            <Badge className="w-fit rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/10">Mobile-first settings</Badge>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="rounded-[2rem] border-none bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Preferences</h2>
                  <p className="text-sm text-slate-500">How the route engine should adapt.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditBlock(editBlock === "preferences" ? null : "preferences")}>
                {editBlock === "preferences" ? "Close" : "Edit"}
              </Button>
            </div>

            {editBlock === "preferences" ? (
              <div className="space-y-3">
                <Input
                  type="number"
                  placeholder="Max walking distance"
                  value={formData.preferences?.max_walking_distance_meters ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      preferences: {
                        ...state?.preferences,
                        max_walking_distance_meters: event.target.value ? Number(event.target.value) : null,
                      },
                    }))
                  }
                />
                <Input
                  type="number"
                  placeholder="Budget level"
                  value={formData.preferences?.budget_level ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      preferences: {
                        ...state?.preferences,
                        budget_level: event.target.value ? Number(event.target.value) : null,
                      },
                    }))
                  }
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Rating threshold"
                  value={formData.preferences?.rating_threshold ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      preferences: {
                        ...state?.preferences,
                        rating_threshold: event.target.value ? Number(event.target.value) : null,
                      },
                    }))
                  }
                />
                <Input
                  type="text"
                  placeholder="Transport mode"
                  value={formData.preferences?.transport_mode ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      preferences: {
                        ...state?.preferences,
                        transport_mode: event.target.value || null,
                      },
                    }))
                  }
                />
                <Button className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => handleSave("preferences")}>
                  Save preferences
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p>Transport: {profile.preferences?.transport_mode || "—"}</p>
                <p>Budget level: {profile.preferences?.budget_level ?? "—"}</p>
                <p>Rating threshold: {profile.preferences?.rating_threshold ?? "—"}</p>
                <p>Max walking distance: {profile.preferences?.max_walking_distance_meters ?? "—"} m</p>
                <p>Breakfast outside: {String(profile.preferences?.likes_breakfast_outside ?? false)}</p>
              </div>
            )}
          </Card>

          <Card className="rounded-[2rem] border-none bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Starting point</h2>
                  <p className="text-sm text-slate-500">Base location for itinerary generation.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditBlock(editBlock === "starting_point" ? null : "starting_point")}>
                {editBlock === "starting_point" ? "Close" : "Edit"}
              </Button>
            </div>

            {editBlock === "starting_point" ? (
              <div className="space-y-3">
                <Input
                  placeholder="Name"
                  value={formData.starting_point?.name ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      starting_point: { ...state?.starting_point, name: event.target.value || null },
                    }))
                  }
                />
                <Input
                  placeholder="City"
                  value={formData.starting_point?.city ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      starting_point: { ...state?.starting_point, city: event.target.value || null },
                    }))
                  }
                />
                <Input
                  placeholder="Country"
                  value={formData.starting_point?.country ?? ""}
                  onChange={(event) =>
                    setFormData((state) => ({
                      ...state!,
                      starting_point: { ...state?.starting_point, country: event.target.value || null },
                    }))
                  }
                />
                <Button className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => handleSave("starting_point")}>
                  Save starting point
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p>{profile.starting_point?.name || "—"}</p>
                <p>
                  {profile.starting_point?.city || "—"}, {profile.starting_point?.country || "—"}
                </p>
              </div>
            )}
          </Card>
        </div>

        <Card className="rounded-[2rem] border-none bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Availability</h2>
                <p className="text-sm text-slate-500">Time window used by the planner.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditBlock(editBlock === "availability" ? null : "availability")}>
              {editBlock === "availability" ? "Close" : "Edit"}
            </Button>
          </div>

          {editBlock === "availability" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <Input
                type="number"
                placeholder="Start time"
                value={formData.availability?.start_time ?? ""}
                onChange={(event) =>
                  setFormData((state) => ({
                    ...state!,
                    availability: { ...state?.availability, start_time: event.target.value ? Number(event.target.value) : null },
                  }))
                }
              />
              <span className="hidden text-center text-slate-400 sm:block">to</span>
              <Input
                type="number"
                placeholder="End time"
                value={formData.availability?.end_time ?? ""}
                onChange={(event) =>
                  setFormData((state) => ({
                    ...state!,
                    availability: { ...state?.availability, end_time: event.target.value ? Number(event.target.value) : null },
                  }))
                }
              />
              <Button className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800 sm:col-span-3" onClick={() => handleSave("availability")}>
                Save availability
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {formatTime(profile.availability?.start_time)} to {formatTime(profile.availability?.end_time)}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
