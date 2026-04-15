import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
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

function formatTime(value?: number | string) {
    if (value == null) return "—";
    const str = value.toString().padStart(4, "0");
    return `${str.slice(0, 2)}:${str.slice(2)}`;
}

export function ProfilePage() {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [editBlock, setEditBlock] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>(null);

    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    useEffect(() => {
        fetch("http://43.245.224.126:8000/users/me", {
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
    }, []);

    const handleSave = async (block: string) => {
        if (!formData) return;

        const payload = {
            user: {
                preferences: block === "preferences" ? formData.preferences : null,
                starting_points: block === "starting_point" ? formData.starting_point : null,
                availability: block === "availability" ? formData.availability : null,
            },
        };

        try {
            const res = await fetch("http://43.245.224.126:8000/users/me", {
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

            const updated = { ...profile };
            if (block === "preferences") updated.preferences = formData.preferences;
            if (block === "starting_point") updated.starting_point = formData.starting_point;
            if (block === "availability") updated.availability = formData.availability;
            setProfile(updated);
        } catch {
            toast.error("Failed to update");
        }
    };

    if (!profile || !formData) return <div className="p-4 sm:p-6">Loading profile…</div>;

    return (
        <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">← Back</Button>

            <Card className="p-4 sm:p-6">
                <h2 className="text-2xl font-bold mb-4">User Info</h2>
                <p className="break-words"><b>Username:</b> {profile.username}</p>
                <p className="break-words"><b>Email:</b> {profile.email}</p>
            </Card>
            <Card className="p-4 sm:p-6">
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold">Preferences</h2>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => setEditBlock(editBlock === "preferences" ? null : "preferences")}>
                        {editBlock === "preferences" ? "Cancel" : "Edit"}
                    </Button>
                </div>

                {editBlock === "preferences" ? (
                    <div className="space-y-2">
                        <Input
                            type="number"
                            placeholder="Max walking distance"
                            value={formData.preferences?.max_walking_distance_meters ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    max_walking_distance_meters: e.target.value ? Number(e.target.value) : null
                                }
                            })}
                        />
                        <Input
                            type="number"
                            placeholder="Budget level"
                            value={formData.preferences?.budget_level ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    budget_level: e.target.value ? Number(e.target.value) : null
                                }
                            })}
                        />
                        <Input
                            type="number"
                            step="0.1"
                            placeholder="Rating threshold"
                            value={formData.preferences?.rating_threshold ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    rating_threshold: e.target.value ? Number(e.target.value) : null
                                }
                            })}
                        />
                        <Input
                            type="text"
                            placeholder="Transport mode"
                            value={formData.preferences?.transport_mode ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                preferences: {
                                    ...formData.preferences,
                                    transport_mode: e.target.value || null
                                }
                            })}
                        />
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => handleSave("preferences")}>Apply</Button>
                    </div>
                ) : (
                    <>
                        <p>Transport: {profile.preferences?.transport_mode}</p>
                        <p>Budget level: {profile.preferences?.budget_level}</p>
                        <p>Rating threshold: {profile.preferences?.rating_threshold}</p>
                        <p>Max walking distance: {profile.preferences?.max_walking_distance_meters} m</p>
                        <p>Breakfast outside: {String(profile.preferences?.likes_breakfast_outside)}</p>
                    </>
                )}
            </Card>

            <Card className="p-4 sm:p-6">
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold">Starting Point</h2>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => setEditBlock(editBlock === "starting_point" ? null : "starting_point")}>
                        {editBlock === "starting_point" ? "Cancel" : "Edit"}
                    </Button>
                </div>

                {editBlock === "starting_point" ? (
                    <div className="space-y-2">
                        <Input
                            placeholder="Name"
                            value={formData.starting_point?.name ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                starting_point: { ...formData.starting_point, name: e.target.value || null }
                            })}
                        />
                        <Input
                            placeholder="City"
                            value={formData.starting_point?.city ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                starting_point: { ...formData.starting_point, city: e.target.value || null }
                            })}
                        />
                        <Input
                            placeholder="Country"
                            value={formData.starting_point?.country ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                starting_point: { ...formData.starting_point, country: e.target.value || null }
                            })}
                        />
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => handleSave("starting_point")}>Apply</Button>
                    </div>
                ) : (
                    <>
                        <p>{profile.starting_point?.name}</p>
                        <p>{profile.starting_point?.city}, {profile.starting_point?.country}</p>
                    </>
                )}
            </Card>

            <Card className="p-4 sm:p-6">
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-semibold">Availability</h2>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => setEditBlock(editBlock === "availability" ? null : "availability")}>
                        {editBlock === "availability" ? "Cancel" : "Edit"}
                    </Button>
                </div>

                {editBlock === "availability" ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                            type="number"
                            value={formData.availability?.start_time ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                availability: { ...formData.availability, start_time: e.target.value ? Number(e.target.value) : null }
                            })}
                            placeholder="Start time"
                        />
                        <span className="hidden sm:inline">–</span>
                        <Input
                            type="number"
                            value={formData.availability?.end_time ?? ""}
                            onChange={(e) => setFormData({
                                ...formData,
                                availability: { ...formData.availability, end_time: e.target.value ? Number(e.target.value) : null }
                            })}
                            placeholder="End time"
                        />
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => handleSave("availability")}>Apply</Button>
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