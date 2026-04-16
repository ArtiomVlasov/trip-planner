import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

interface PartnerPlacesPageProps {
  onLogout: () => void;
}

type PartnerPlaceStatus = "active" | "paused" | "archived";

interface PartnerManagedPlace {
  partner_place_id: number;
  partner_id: number;
  place_id: string;
  name: string | null;
  category: string | null;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
  types: string[] | null;
  relationship_type: string;
  priority_weight: number;
  commission_type: string | null;
  commission_value: string | null;
  is_promotable: boolean;
  start_date: string | null;
  end_date: string | null;
  status: PartnerPlaceStatus;
}

interface EditPlaceForm {
  name: string;
  category: string;
  address: string;
  lat: string;
  lng: string;
  priorityWeight: string;
  status: PartnerPlaceStatus;
  isPromotable: boolean;
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
  { value: "activity", label: "Activity" },
  { value: "transfer", label: "Transfer" },
];

const DEFAULT_CATEGORY = PLACE_CATEGORIES[0].value;
const PLACE_STATUS_OPTIONS: { value: PartnerPlaceStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

const CATEGORY_LABELS = Object.fromEntries(
  PLACE_CATEGORIES.map((category) => [category.value, category.label])
) as Record<string, string>;

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

function formatCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }
  return CATEGORY_LABELS[value] ?? value.replace(/_/g, " ");
}

function getStatusBadgeVariant(
  status: PartnerPlaceStatus
): "default" | "secondary" | "outline" {
  if (status === "active") {
    return "default";
  }
  if (status === "paused") {
    return "secondary";
  }
  return "outline";
}

function formatCoordinate(value: number | null) {
  return value === null ? "—" : value.toFixed(6);
}

export function PartnerPlacesPage({ onLogout }: PartnerPlacesPageProps) {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [partnerPlaces, setPartnerPlaces] = useState<PartnerManagedPlace[]>([]);
  const [externalIdPreview, setExternalIdPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PartnerManagedPlace | null>(null);
  const [editForm, setEditForm] = useState<EditPlaceForm>({
    name: "",
    category: DEFAULT_CATEGORY,
    address: "",
    lat: "",
    lng: "",
    priorityWeight: "1",
    status: "active",
    isPromotable: true,
  });
  const [form, setForm] = useState({
    placeName: "",
    category: DEFAULT_CATEGORY,
    address: "",
    lat: "",
    lng: "",
  });

  const fetchPartnerPlaces = async (showBackgroundToast = false) => {
    if (!token) {
      setPartnerPlaces([]);
      setListLoading(false);
      return;
    }

    if (!showBackgroundToast) {
      setListLoading(true);
    }

    try {
      const response = await fetch(buildApiUrl("/api/v1/crm/partner-places/mine"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Failed to load your places"));
      }

      const data = (await response.json()) as PartnerManagedPlace[];
      setPartnerPlaces(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load your places");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void fetchPartnerPlaces();
  }, [token]);

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
          buildApiUrl(
            `/api/v1/crm/places/external-id-preview?name=${encodeURIComponent(trimmedName)}`
          ),
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
    const response = await fetch(buildApiUrl("/api/v1/crm/places"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        source: "partner",
        name: form.placeName.trim(),
        category: form.category,
        lat: Number(form.lat),
        lng: Number(form.lng),
        address: form.address.trim(),
        city: "sochi",
        tags: ["partner"],
      }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to create place"));
    }

    const created = await response.json();
    return created.place_id as string;
  };

  const linkPartnerPlace = async (placeId: string) => {
    const response = await fetch(buildApiUrl("/api/v1/crm/partner-places"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        place_id: placeId,
        relationship_type: "owner",
        priority_weight: 1.0,
        is_promotable: true,
      }),
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
      await fetchPartnerPlaces(true);

      toast.success("Partner place added to database");
      setForm({
        placeName: "",
        category: DEFAULT_CATEGORY,
        address: "",
        lat: "",
        lng: "",
      });
      setExternalIdPreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add partner place");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (place: PartnerManagedPlace) => {
    setEditingPlace(place);
    setEditForm({
      name: place.name ?? "",
      category: place.category ?? DEFAULT_CATEGORY,
      address: place.formatted_address ?? "",
      lat: place.lat === null ? "" : String(place.lat),
      lng: place.lng === null ? "" : String(place.lng),
      priorityWeight: String(place.priority_weight),
      status: place.status,
      isPromotable: place.is_promotable,
    });
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingPlace(null);
  };

  const patchPartnerPlace = async (
    partnerPlaceId: number,
    payload: Record<string, unknown>
  ) => {
    const response = await fetch(
      buildApiUrl(`/api/v1/crm/partner-places/${partnerPlaceId}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to update partner place"));
    }
  };

  const patchPlace = async (placeId: string, payload: Record<string, unknown>) => {
    const response = await fetch(buildApiUrl(`/api/v1/crm/places/${encodeURIComponent(placeId)}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to update place"));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPlace) {
      return;
    }

    if (!editForm.name.trim() || !editForm.category || !editForm.lat || !editForm.lng) {
      toast.error("Fill name, category and coordinates");
      return;
    }

    if (
      Number.isNaN(Number(editForm.lat)) ||
      Number.isNaN(Number(editForm.lng)) ||
      Number.isNaN(Number(editForm.priorityWeight))
    ) {
      toast.error("Coordinates and priority weight must be valid numbers");
      return;
    }

    setEditSaving(true);
    try {
      await patchPlace(editingPlace.place_id, {
        name: editForm.name.trim(),
        category: editForm.category,
        address: editForm.address.trim(),
        lat: Number(editForm.lat),
        lng: Number(editForm.lng),
      });
      await patchPartnerPlace(editingPlace.partner_place_id, {
        priority_weight: Number(editForm.priorityWeight),
        status: editForm.status,
        is_promotable: editForm.isPromotable,
      });
      await fetchPartnerPlaces(true);

      toast.success("Place updated");
      closeEditDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update place");
    } finally {
      setEditSaving(false);
    }
  };

  const handleQuickStatusChange = async (
    place: PartnerManagedPlace,
    status: PartnerPlaceStatus
  ) => {
    setActionKey(`status-${place.partner_place_id}`);
    try {
      await patchPartnerPlace(place.partner_place_id, { status });
      await fetchPartnerPlaces(true);
      toast.success(status === "archived" ? "Place archived" : "Status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setActionKey(null);
    }
  };

  const handlePromotableToggle = async (place: PartnerManagedPlace) => {
    setActionKey(`promo-${place.partner_place_id}`);
    try {
      await patchPartnerPlace(place.partner_place_id, {
        is_promotable: !place.is_promotable,
      });
      await fetchPartnerPlaces(true);
      toast.success(
        !place.is_promotable ? "Promotion enabled" : "Promotion disabled"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update promotion status"
      );
    } finally {
      setActionKey(null);
    }
  };

  const archivePlace = async (place: PartnerManagedPlace) => {
    const confirmed = window.confirm(
      `Archive "${place.name ?? place.place_id}"? You can still see it later in the list.`
    );
    if (!confirmed) {
      return;
    }

    await handleQuickStatusChange(place, "archived");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Partner Panel</h1>
            <p className="text-sm text-muted-foreground">
              Add new places, review your current inventory, and manage what is promoted.
            </p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Add New Partner Place</CardTitle>
            <CardDescription>
              The place will be linked to the currently signed-in partner automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Place Name</Label>
                <Input
                  value={form.placeName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, placeName: e.target.value }))
                  }
                  placeholder="Place name"
                />
              </div>

              <div className="space-y-2">
                <Label>External ID</Label>
                <Input
                  value={
                    form.placeName.trim()
                      ? externalIdPreview || (previewLoading ? "Generating..." : "")
                      : ""
                  }
                  readOnly
                  placeholder="Generated from place name"
                />
                <p className="text-sm text-muted-foreground">
                  Generated automatically from the place name and checked for uniqueness in
                  your account.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, category: value }))
                    }
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
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Sochi address"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    value={form.lat}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lat: e.target.value }))
                    }
                    placeholder="43.585"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    value={form.lng}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lng: e.target.value }))
                    }
                    placeholder="39.723"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add place to DB"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">Your Places</CardTitle>
              <CardDescription>
                Review all places linked to your partner account and manage how they behave.
              </CardDescription>
            </div>
            <Button variant="secondary" onClick={() => void fetchPartnerPlaces()} disabled={listLoading}>
              {listLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Loading your places...
              </div>
            ) : partnerPlaces.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                You do not have any places yet. Add your first place above.
              </div>
            ) : (
              <div className="space-y-4">
                {partnerPlaces.map((place) => (
                  <div
                    key={place.partner_place_id}
                    className="rounded-xl border p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {place.name ?? "Unnamed place"}
                          </h3>
                          <Badge variant={getStatusBadgeVariant(place.status)}>
                            {place.status}
                          </Badge>
                          <Badge variant={place.is_promotable ? "default" : "outline"}>
                            {place.is_promotable ? "Promotion on" : "Promotion off"}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>{place.formatted_address || "Address not set"}</p>
                          <p>
                            External ID: <span className="font-mono text-foreground">{place.place_id}</span>
                          </p>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-muted-foreground">Category</p>
                            <p className="font-medium">{formatCategoryLabel(place.category)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Priority</p>
                            <p className="font-medium">{place.priority_weight}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Latitude</p>
                            <p className="font-medium">{formatCoordinate(place.lat)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Longitude</p>
                            <p className="font-medium">{formatCoordinate(place.lng)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                          variant="outline"
                          onClick={() => openEditDialog(place)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void handlePromotableToggle(place)}
                          disabled={actionKey === `promo-${place.partner_place_id}`}
                        >
                          {actionKey === `promo-${place.partner_place_id}`
                            ? "Saving..."
                            : place.is_promotable
                              ? "Disable Promo"
                              : "Enable Promo"}
                        </Button>
                        {place.status === "active" ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "paused")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? "Saving..."
                              : "Pause"}
                          </Button>
                        ) : place.status === "paused" ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "active")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? "Saving..."
                              : "Activate"}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "active")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? "Saving..."
                              : "Restore"}
                          </Button>
                        )}
                        {place.status !== "archived" && (
                          <Button
                            variant="destructive"
                            onClick={() => void archivePlace(place)}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) {
              setEditingPlace(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Place</DialogTitle>
              <DialogDescription>
                Update the place data and promotion settings for this partner location.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Place Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({ ...prev, category: value }))
                    }
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
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: value as PartnerPlaceStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLACE_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    value={editForm.lat}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, lat: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    value={editForm.lng}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, lng: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Priority Weight</Label>
                  <Input
                    value={editForm.priorityWeight}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        priorityWeight: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="font-medium">Promotion</p>
                    <p className="text-sm text-muted-foreground">
                      Allow this place to appear in partner recommendations.
                    </p>
                  </div>
                  <Switch
                    checked={editForm.isPromotable}
                    onCheckedChange={(checked) =>
                      setEditForm((prev) => ({ ...prev, isPromotable: checked }))
                    }
                  />
                </div>
              </div>

              {editingPlace && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                  External ID:{" "}
                  <span className="font-mono text-foreground">{editingPlace.place_id}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeEditDialog} disabled={editSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
