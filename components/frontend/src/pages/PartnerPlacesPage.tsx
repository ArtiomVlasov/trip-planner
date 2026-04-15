import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildApiUrl } from "@/lib/api";
import { Building2, LogOut, MapPin, Store } from "lucide-react";
import { toast } from "sonner";

interface PartnerPlacesPageProps {
  onLogout: () => void;
}

export function PartnerPlacesPage({ onLogout }: PartnerPlacesPageProps) {
  const token = localStorage.getItem("token");
  const storedPartnerId = localStorage.getItem("partnerId") || "";
  const username = localStorage.getItem("username") || "Partner";

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

    const response = await fetch(buildApiUrl("/api/v1/crm/places"), {
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
        buildApiUrl(`/api/v1/crm/places/search?name=${encodeURIComponent(form.placeName)}&lat=${form.lat}&lng=${form.lng}&radius_m=50`),
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );

      if (searchResponse.ok) {
        const candidates = await searchResponse.json();
        if (Array.isArray(candidates) && candidates[0]?.place_id) {
          return candidates[0].place_id as string;
        }
      }
    }

    throw new Error("Failed to create or resolve place");
  };

  const linkPartnerPlace = async (placeId: string) => {
    const response = await fetch(buildApiUrl("/api/v1/crm/partner-places"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        partner_id: Number(form.partnerId),
        place_id: placeId,
        relationship_type: "owner",
        priority_weight: 1,
        is_promotable: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to link partner place");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.partnerId || !form.placeName || !form.category || !form.lat || !form.lng) {
      toast.error("Fill partner id, name, category, and coordinates");
      return;
    }

    setLoading(true);
    try {
      const placeId = await createPlace();
      await linkPartnerPlace(placeId);
      toast.success("Partner place added to database");
      setForm((state) => ({ ...state, placeName: "", category: "restaurant", address: "", lat: "", lng: "", externalId: "" }));
    } catch {
      toast.error("Failed to add partner place");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-start justify-between gap-4 rounded-[2rem] bg-slate-950 px-5 py-4 text-white shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Partner panel</p>
            <h1 className="mt-1 text-2xl font-semibold">Hi, {username}</h1>
            <p className="mt-1 text-sm text-slate-300">Manage promoted places from a touch-friendly form.</p>
          </div>
          <Button variant="outline" className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </header>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="rounded-3xl border-none bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <Store className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-950">Partner id</p>
            <p className="mt-1 text-sm text-slate-500">Stored from partner login and editable in the form below.</p>
          </Card>
          <Card className="rounded-3xl border-none bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <MapPin className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-950">Place coordinates</p>
            <p className="mt-1 text-sm text-slate-500">Keep latitude and longitude handy before submitting.</p>
          </Card>
          <Card className="rounded-3xl border-none bg-white p-4 shadow-sm">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-950">CRM flow</p>
            <p className="mt-1 text-sm text-slate-500">The form creates a place and links it to the partner in one action.</p>
          </Card>
        </div>

        <Card className="rounded-[2rem] border-none bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Badge className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700 hover:bg-cyan-50">New place</Badge>
            <p className="text-sm text-slate-500">All fields are laid out mobile-first and scale up on wider screens.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Partner ID</Label>
                <Input value={form.partnerId} onChange={(event) => setForm((state) => ({ ...state, partnerId: event.target.value }))} placeholder="Partner ID" />
              </div>
              <div className="space-y-2">
                <Label>External ID</Label>
                <Input value={form.externalId} onChange={(event) => setForm((state) => ({ ...state, externalId: event.target.value }))} placeholder="optional external id" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Place name</Label>
              <Input value={form.placeName} onChange={(event) => setForm((state) => ({ ...state, placeName: event.target.value }))} placeholder="Partner place name" />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(event) => setForm((state) => ({ ...state, category: event.target.value }))} placeholder="restaurant / hotel / activity" />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(event) => setForm((state) => ({ ...state, address: event.target.value }))} placeholder="Sochi address" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input value={form.lat} onChange={(event) => setForm((state) => ({ ...state, lat: event.target.value }))} placeholder="43.585" />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input value={form.lng} onChange={(event) => setForm((state) => ({ ...state, lng: event.target.value }))} placeholder="39.723" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800 sm:w-auto sm:px-8">
              {loading ? "Adding place..." : "Add place"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
