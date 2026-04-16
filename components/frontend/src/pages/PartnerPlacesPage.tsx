import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

interface PartnerPlacesPageProps {
  onLogout: () => void;
}

const PLACE_CATEGORIES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "coffee_shop", label: "Coffee Shop" },
  { value: "bakery", label: "Bakery" },
  { value: "bar", label: "Bar" },
  { value: "pub", label: "Pub" },
  { value: "beach", label: "Beach" },
  { value: "museum", label: "Museum" },
  { value: "park", label: "Park" },
  { value: "viewpoint", label: "Viewpoint" },
  { value: "hotel", label: "Hotel" },
  { value: "guest_house", label: "Guest House" },
  { value: "spa", label: "Spa" },
  { value: "shopping_center", label: "Shopping Center" },
  { value: "entertainment_center", label: "Entertainment Center" },
];

const DEFAULT_CATEGORY = PLACE_CATEGORIES[0].value;

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function PartnerPlacesPage({ onLogout }: PartnerPlacesPageProps) {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [externalIdPreview, setExternalIdPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({
    placeName: "",
    category: DEFAULT_CATEGORY,
    address: "",
    lat: "",
    lng: "",
  });

  useEffect(() => {
    const trimmedName = form.placeName.trim();
    if (!trimmedName || !token) {
      setExternalIdPreview("");
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch(
          buildApiUrl(`/api/v1/crm/places/external-id-preview?name=${encodeURIComponent(trimmedName)}`),
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to generate external ID");
        }

        const data = (await response.json()) as { external_id?: string };
        if (!controller.signal.aborted) {
          setExternalIdPreview(data.external_id ?? "");
        }
      } catch {
        if (!controller.signal.aborted) {
          setExternalIdPreview("");
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [form.placeName, token]);

  const createPlace = async () => {
    const placePayload = {
      source: "partner",
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

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to create place"));
    }

    const created = await response.json();
    return created.place_id as string;
  };

  const linkPartnerPlace = async (placeId: string) => {
    const linkPayload = {
      place_id: placeId,
      relationship_type: "owner",
      priority_weight: 1.0,
      is_promotable: true,
    };

    const response = await fetch(buildApiUrl("/api/v1/crm/partner-places"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(linkPayload),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to link partner place"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Partner session expired. Please sign in again.");
      return;
    }

    if (!form.placeName.trim() || !form.category || !form.lat || !form.lng) {
      toast.error("Fill name, category and coordinates");
      return;
    }

    if (Number.isNaN(Number(form.lat)) || Number.isNaN(Number(form.lng))) {
      toast.error("Latitude and longitude must be valid numbers");
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
        category: DEFAULT_CATEGORY,
        address: "",
        lat: "",
        lng: "",
      }));
      setExternalIdPreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add partner place");
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
          <p className="mb-4 text-sm text-muted-foreground">
            The place will be linked to the currently signed-in partner automatically.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Place Name</Label>
              <Input
                value={form.placeName}
                onChange={(e) => setForm((prev) => ({ ...prev, placeName: e.target.value }))}
                placeholder="Place name"
              />
            </div>

            <div className="space-y-2">
              <Label>External ID</Label>
              <Input
                value={form.placeName.trim() ? (externalIdPreview || (previewLoading ? "Generating..." : "")) : ""}
                readOnly
                placeholder="Generated from place name"
              />
              <p className="text-sm text-muted-foreground">
                Generated automatically from the place name and checked for uniqueness in your account.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {PLACE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
