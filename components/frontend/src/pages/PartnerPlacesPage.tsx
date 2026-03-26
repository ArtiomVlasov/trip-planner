import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface PartnerPlacesPageProps {
  onLogout: () => void;
}

export function PartnerPlacesPage({ onLogout }: PartnerPlacesPageProps) {
  const token = localStorage.getItem("token");
  const storedPartnerId = localStorage.getItem("partnerId") || "";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    partnerId: storedPartnerId,
    placeName: "",
    category: "restaurant",
    address: "",
    lat: "",
    lng: "",
    externalId: "",
  });

  const createPlace = async () => {
    const placePayload = {
      source: "partner",
      external_id: form.externalId || undefined,
      name: form.placeName,
      category: form.category,
      lat: Number(form.lat),
      lng: Number(form.lng),
      address: form.address,
      city: "sochi",
      tags: ["partner"],
    };

    const response = await fetch("http://43.245.224.126:8000/api/v1/crm/places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(placePayload),
    });

    if (response.status === 201) {
      const created = await response.json();
      return created.place_id as string;
    }

    if (response.status === 409) {
      const searchResponse = await fetch(
        `http://43.245.224.126:8000/api/v1/crm/places/search?name=${encodeURIComponent(form.placeName)}&lat=${form.lat}&lng=${form.lng}&radius_m=50`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (searchResponse.ok) {
        const candidates = await searchResponse.json();
        if (Array.isArray(candidates) && candidates.length > 0 && candidates[0].place_id) {
          return candidates[0].place_id as string;
        }
      }
    }

    throw new Error("Failed to create or resolve place");
  };

  const linkPartnerPlace = async (placeId: string) => {
    const linkPayload = {
      partner_id: Number(form.partnerId),
      place_id: placeId,
      relationship_type: "owner",
      priority_weight: 1.0,
      is_promotable: true,
    };

    const response = await fetch("http://43.245.224.126:8000/api/v1/crm/partner-places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(linkPayload),
    });

    if (!response.ok) {
      throw new Error("Failed to link partner place");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.partnerId || !form.placeName || !form.category || !form.lat || !form.lng) {
      toast.error("Fill partner id, name, category and coordinates");
      return;
    }

    setLoading(true);
    try {
      const placeId = await createPlace();
      await linkPartnerPlace(placeId);

      toast.success("Partner place added to database");
      setForm((prev) => ({
        ...prev,
        placeName: "",
        category: "restaurant",
        address: "",
        lat: "",
        lng: "",
        externalId: "",
      }));
    } catch (error) {
      toast.error("Failed to add partner place");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Partner Panel</h1>
          <Button variant="outline" onClick={onLogout}>Logout</Button>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Add New Partner Place</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Partner ID</Label>
                <Input
                  value={form.partnerId}
                  onChange={(e) => setForm((prev) => ({ ...prev, partnerId: e.target.value }))}
                  placeholder="Partner ID"
                />
              </div>
              <div className="space-y-2">
                <Label>External ID (optional)</Label>
                <Input
                  value={form.externalId}
                  onChange={(e) => setForm((prev) => ({ ...prev, externalId: e.target.value }))}
                  placeholder="partner_place_123"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Place Name</Label>
              <Input
                value={form.placeName}
                onChange={(e) => setForm((prev) => ({ ...prev, placeName: e.target.value }))}
                placeholder="Place name"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="restaurant / hotel / activity / transfer"
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Sochi address"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  value={form.lat}
                  onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                  placeholder="43.585"
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  value={form.lng}
                  onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
                  placeholder="39.723"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add place to DB"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
