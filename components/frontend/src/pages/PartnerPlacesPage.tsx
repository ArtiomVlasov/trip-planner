import { useEffect, useRef, useState } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
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
import {
  PLACE_CATEGORIES,
  getPlaceCategoryLabel,
  getPlaceCategoryOptions,
} from "@/constants/place-categories";
import {
  geocodeAddressSuggestions,
  loadYandexMaps,
  type YandexAddressSuggestion,
} from "@/yandex-maps";

interface PartnerPlacesPageProps {
  onLogout: () => void;
}

type PartnerPlaceStatus = "active" | "paused" | "archived";
type PartnerStatsChartMetric = "impressions" | "clicks";

interface PartnerDailyStatPoint {
  date: string;
  count: number;
}

interface PartnerPlacePerformanceStats {
  impressions_count: number;
  clicks_count: number;
  unique_users_count: number;
  impressions_daily: PartnerDailyStatPoint[];
  clicks_daily: PartnerDailyStatPoint[];
}

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
  stats: PartnerPlacePerformanceStats;
}

interface PartnerPlacesSummary extends PartnerPlacePerformanceStats {
  total_places: number;
  active_places: number;
  paused_places: number;
  archived_places: number;
  promotable_places: number;
}

interface PartnerPlacesDashboard {
  summary: PartnerPlacesSummary;
  items: PartnerManagedPlace[];
}

interface EditPlaceForm {
  name: string;
  category: string;
  customCategory: string;
  address: string;
  lat: string;
  lng: string;
  priorityWeight: string;
  status: PartnerPlaceStatus;
  isPromotable: boolean;
}

interface CreatePlaceForm {
  placeName: string;
  category: string;
  customCategory: string;
  address: string;
  lat: string;
  lng: string;
}

interface AddressSearchState {
  suggestions: YandexAddressSuggestion[];
  loading: boolean;
  open: boolean;
}

const DEFAULT_CATEGORY = PLACE_CATEGORIES[0].value;
const CUSTOM_CATEGORY_VALUE = "__other__";
const KNOWN_PLACE_CATEGORIES = new Set<string>(
  PLACE_CATEGORIES.map((category) => category.value)
);
const PLACE_STATUS_OPTIONS: {
  value: PartnerPlaceStatus;
  labels: Record<Language, string>;
}[] = [
  { value: "active", labels: { ru: "Активно", en: "Active" } },
  { value: "paused", labels: { ru: "Пауза", en: "Paused" } },
  { value: "archived", labels: { ru: "Архив", en: "Archived" } },
];

const STATUS_LABELS = Object.fromEntries(
  PLACE_STATUS_OPTIONS.map((status) => [status.value, status.labels])
) as Record<PartnerPlaceStatus, Record<Language, string>>;
const EMPTY_PARTNER_PLACE_STATS: PartnerPlacePerformanceStats = {
  impressions_count: 0,
  clicks_count: 0,
  unique_users_count: 0,
  impressions_daily: [],
  clicks_daily: [],
};
const EMPTY_PARTNER_PLACES_SUMMARY: PartnerPlacesSummary = {
  ...EMPTY_PARTNER_PLACE_STATS,
  total_places: 0,
  active_places: 0,
  paused_places: 0,
  archived_places: 0,
  promotable_places: 0,
};

function getStatusOptions(language: Language) {
  return PLACE_STATUS_OPTIONS.map((status) => ({
    value: status.value,
    label: status.labels[language],
  }));
}

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

function getStatusLabel(status: PartnerPlaceStatus, language: Language) {
  return STATUS_LABELS[status]?.[language] ?? status;
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

function getLocale(language: Language) {
  return language === "ru" ? "ru-RU" : "en-US";
}

function formatInteger(value: number, language: Language) {
  return new Intl.NumberFormat(getLocale(language)).format(value);
}

function formatDetectedCoordinates(lat: string, lng: string) {
  if (!lat || !lng) {
    return null;
  }

  const latitude = Number(lat);
  const longitude = Number(lng);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function isKnownPlaceCategory(value: string | null | undefined) {
  return typeof value === "string" && KNOWN_PLACE_CATEGORIES.has(value);
}

function getCategoryFieldState(category: string | null | undefined) {
  if (typeof category === "string" && category.trim() && !isKnownPlaceCategory(category)) {
    return {
      category: CUSTOM_CATEGORY_VALUE,
      customCategory: category,
    };
  }

  return {
    category: category && isKnownPlaceCategory(category) ? category : DEFAULT_CATEGORY,
    customCategory: "",
  };
}

function getEffectiveCategory(category: string, customCategory: string) {
  return category === CUSTOM_CATEGORY_VALUE ? customCategory.trim() : category;
}

function formatChartDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDailySeries(points: PartnerDailyStatPoint[], days = 30) {
  const countByDate = new Map(
    points.map((point) => [point.date, Number(point.count) || 0])
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    const dateKey = getDateKey(date);

    return {
      date: dateKey,
      count: countByDate.get(dateKey) ?? 0,
    };
  });
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
) {
  if (points.length === 0) {
    return "";
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function PartnerPlacesPage({ onLogout }: PartnerPlacesPageProps) {
  const { language, copy } = useLanguage();
  const token = localStorage.getItem("token");
  const categoryOptions = [
    ...getPlaceCategoryOptions(language),
    { value: CUSTOM_CATEGORY_VALUE, label: copy.partnerPlaces.categoryOther },
  ];
  const statusOptions = getStatusOptions(language);

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<PartnerPlacesSummary>(
    EMPTY_PARTNER_PLACES_SUMMARY
  );
  const [partnerPlaces, setPartnerPlaces] = useState<PartnerManagedPlace[]>([]);
  const [statsChartDialog, setStatsChartDialog] = useState<{
    title: string;
    metric: PartnerStatsChartMetric;
    points: PartnerDailyStatPoint[];
  } | null>(null);
  const [externalIdPreview, setExternalIdPreview] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PartnerManagedPlace | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const addPlaceCardRef = useRef<HTMLDivElement | null>(null);
  const placeNameInputRef = useRef<HTMLInputElement | null>(null);
  const [createAddressSearch, setCreateAddressSearch] = useState<AddressSearchState>({
    suggestions: [],
    loading: false,
    open: false,
  });
  const [editAddressSearch, setEditAddressSearch] = useState<AddressSearchState>({
    suggestions: [],
    loading: false,
    open: false,
  });
  const [editForm, setEditForm] = useState<EditPlaceForm>({
    name: "",
    category: DEFAULT_CATEGORY,
    customCategory: "",
    address: "",
    lat: "",
    lng: "",
    priorityWeight: "1",
    status: "active",
    isPromotable: true,
  });
  const [form, setForm] = useState<CreatePlaceForm>({
    placeName: "",
    category: DEFAULT_CATEGORY,
    customCategory: "",
    address: "",
    lat: "",
    lng: "",
  });

  useEffect(() => {
    let cancelled = false;

    loadYandexMaps()
      .then(() => {
        if (!cancelled) {
          setMapsReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Yandex Maps for partner places:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPartnerDashboard = async (showBackgroundToast = false) => {
    if (!token) {
      setPartnerPlaces([]);
      setDashboardSummary(EMPTY_PARTNER_PLACES_SUMMARY);
      setListLoading(false);
      return;
    }

    if (!showBackgroundToast) {
      setListLoading(true);
    }

    try {
      const response = await fetch(
        buildApiUrl("/api/v1/crm/partner-places/mine/stats"),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, copy.partnerPlaces.loadError));
      }

      const data = (await response.json()) as PartnerPlacesDashboard;
      setPartnerPlaces(data.items ?? []);
      setDashboardSummary(data.summary ?? EMPTY_PARTNER_PLACES_SUMMARY);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.partnerPlaces.loadError);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void fetchPartnerDashboard();
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
          throw new Error(copy.partnerPlaces.externalIdError);
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

  useEffect(() => {
    const query = form.address.trim();
    if (!mapsReady || query.length < 3) {
      setCreateAddressSearch((prev) => ({
        ...prev,
        suggestions: [],
        loading: false,
      }));
      return;
    }

    let cancelled = false;
    setCreateAddressSearch((prev) => ({ ...prev, loading: true }));

    const timeoutId = window.setTimeout(async () => {
      try {
        const suggestions = await geocodeAddressSuggestions(query, 5);
        if (!cancelled) {
          setCreateAddressSearch((prev) => ({
            ...prev,
            suggestions,
            loading: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setCreateAddressSearch((prev) => ({
            ...prev,
            suggestions: [],
            loading: false,
          }));
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form.address, mapsReady]);

  useEffect(() => {
    const query = editForm.address.trim();
    if (!mapsReady || query.length < 3 || !isEditOpen) {
      setEditAddressSearch((prev) => ({
        ...prev,
        suggestions: [],
        loading: false,
      }));
      return;
    }

    let cancelled = false;
    setEditAddressSearch((prev) => ({ ...prev, loading: true }));

    const timeoutId = window.setTimeout(async () => {
      try {
        const suggestions = await geocodeAddressSuggestions(query, 5);
        if (!cancelled) {
          setEditAddressSearch((prev) => ({
            ...prev,
            suggestions,
            loading: false,
          }));
        }
      } catch {
        if (!cancelled) {
          setEditAddressSearch((prev) => ({
            ...prev,
            suggestions: [],
            loading: false,
          }));
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [editForm.address, isEditOpen, mapsReady]);

  const selectCreateSuggestion = (suggestion: YandexAddressSuggestion) => {
    setForm((prev) => ({
      ...prev,
      address: suggestion.address,
      lat: String(suggestion.lat),
      lng: String(suggestion.lng),
    }));
    setCreateAddressSearch((prev) => ({
      ...prev,
      suggestions: [],
      open: false,
    }));
  };

  const selectEditSuggestion = (suggestion: YandexAddressSuggestion) => {
    setEditForm((prev) => ({
      ...prev,
      address: suggestion.address,
      lat: String(suggestion.lat),
      lng: String(suggestion.lng),
    }));
    setEditAddressSearch((prev) => ({
      ...prev,
      suggestions: [],
      open: false,
    }));
  };

  const resolveAddressCoordinates = async (address: string) => {
    const suggestions = await geocodeAddressSuggestions(address, 1);
    return suggestions[0] ?? null;
  };

  const createPlace = async (payload: { address: string; lat: number; lng: number }) => {
    const category = getEffectiveCategory(form.category, form.customCategory);

    const response = await fetch(buildApiUrl("/api/v1/crm/places"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        source: "partner",
        name: form.placeName.trim(),
        category,
        lat: payload.lat,
        lng: payload.lng,
        address: payload.address,
        city: "sochi",
        tags: ["partner"],
      }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, copy.partnerPlaces.createError));
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
      throw new Error(await getErrorMessage(response, copy.partnerPlaces.linkError));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error(copy.partnerPlaces.sessionExpired);
      return;
    }

    if (!form.placeName.trim() || !form.category || !form.address.trim()) {
      toast.error(copy.partnerPlaces.fillRequiredFields);
      return;
    }

    if (form.category === CUSTOM_CATEGORY_VALUE && !form.customCategory.trim()) {
      toast.error(copy.partnerPlaces.customCategoryRequired);
      return;
    }

    setLoading(true);
    try {
      let address = form.address.trim();
      let lat = form.lat;
      let lng = form.lng;

      if (!lat || !lng) {
        const resolved = await resolveAddressCoordinates(address);
        if (!resolved) {
          throw new Error(copy.partnerPlaces.addressLookupError);
        }

        address = resolved.address;
        lat = String(resolved.lat);
        lng = String(resolved.lng);
        setForm((prev) => ({
          ...prev,
          address,
          lat,
          lng,
        }));
      }

      if (Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
        throw new Error(copy.partnerPlaces.invalidNumbers);
      }

      const placeId = await createPlace({
        address,
        lat: Number(lat),
        lng: Number(lng),
      });
      await linkPartnerPlace(placeId);
      await fetchPartnerDashboard(true);

      toast.success(copy.partnerPlaces.addSuccess);
      setForm({
        placeName: "",
        category: DEFAULT_CATEGORY,
        customCategory: "",
        address: "",
        lat: "",
        lng: "",
      });
      setCreateAddressSearch({
        suggestions: [],
        loading: false,
        open: false,
      });
      setExternalIdPreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.partnerPlaces.addError);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (place: PartnerManagedPlace) => {
    const categoryState = getCategoryFieldState(place.category);

    setEditingPlace(place);
    setEditForm({
      name: place.name ?? "",
      category: categoryState.category,
      customCategory: categoryState.customCategory,
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
    setEditAddressSearch({
      suggestions: [],
      loading: false,
      open: false,
    });
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
      throw new Error(await getErrorMessage(response, copy.partnerPlaces.updateError));
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
      throw new Error(await getErrorMessage(response, copy.partnerPlaces.updateError));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPlace) {
      return;
    }

    if (!editForm.name.trim() || !editForm.category || !editForm.address.trim()) {
      toast.error(copy.partnerPlaces.fillRequiredFields);
      return;
    }

    if (editForm.category === CUSTOM_CATEGORY_VALUE && !editForm.customCategory.trim()) {
      toast.error(copy.partnerPlaces.customCategoryRequired);
      return;
    }

    if (Number.isNaN(Number(editForm.priorityWeight))) {
      toast.error(copy.partnerPlaces.invalidNumbersWithPriority);
      return;
    }

    setEditSaving(true);
    try {
      let lat = editForm.lat;
      let lng = editForm.lng;
      let address = editForm.address.trim();

      if (!lat || !lng) {
        const resolved = await resolveAddressCoordinates(address);
        if (!resolved) {
          throw new Error(copy.partnerPlaces.addressLookupError);
        }

        address = resolved.address;
        lat = String(resolved.lat);
        lng = String(resolved.lng);
        setEditForm((prev) => ({
          ...prev,
          address,
          lat,
          lng,
        }));
      }

      if (Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
        throw new Error(copy.partnerPlaces.invalidNumbers);
      }

      await patchPlace(editingPlace.place_id, {
        name: editForm.name.trim(),
        category: getEffectiveCategory(editForm.category, editForm.customCategory),
        address,
        lat: Number(lat),
        lng: Number(lng),
      });
      await patchPartnerPlace(editingPlace.partner_place_id, {
        priority_weight: Number(editForm.priorityWeight),
        status: editForm.status,
        is_promotable: editForm.isPromotable,
      });
      await fetchPartnerDashboard(true);

      toast.success(copy.partnerPlaces.updateSuccess);
      closeEditDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.partnerPlaces.updateError);
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
      await fetchPartnerDashboard(true);
      toast.success(
        status === "archived"
          ? copy.partnerPlaces.archivedSuccess
          : copy.partnerPlaces.statusSuccess
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.partnerPlaces.statusError);
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
      await fetchPartnerDashboard(true);
      toast.success(
        !place.is_promotable
          ? copy.partnerPlaces.promotionEnabled
          : copy.partnerPlaces.promotionDisabled
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : copy.partnerPlaces.promotionError
      );
    } finally {
      setActionKey(null);
    }
  };

  const archivePlace = async (place: PartnerManagedPlace) => {
    const confirmed = window.confirm(
      `${copy.partnerPlaces.confirmArchivePrefix} "${place.name ?? place.place_id}"? ${copy.partnerPlaces.confirmArchiveSuffix}`
    );
    if (!confirmed) {
      return;
    }

    await handleQuickStatusChange(place, "archived");
  };

  const scrollToAddPlaceForm = () => {
    addPlaceCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      placeNameInputRef.current?.focus();
    }, 250);
  };

  const openStatsChart = (
    title: string,
    metric: PartnerStatsChartMetric,
    points: PartnerDailyStatPoint[]
  ) => {
    setStatsChartDialog({
      title,
      metric,
      points,
    });
  };

  const renderStatButton = (
    label: string,
    value: number,
    metric: PartnerStatsChartMetric,
    points: PartnerDailyStatPoint[],
    title: string
  ) => (
    <button
      type="button"
      onClick={() => openStatsChart(title, metric, points)}
      className="rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">
        {formatInteger(value, language)}
      </p>
    </button>
  );

  const renderStatsChart = (points: PartnerDailyStatPoint[]) => {
    const hasEvents = points.some((point) => Number(point.count) > 0);

    if (!hasEvents) {
      return (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {copy.partnerPlaces.chartNoData}
        </div>
      );
    }

    const series = normalizeDailySeries(points);
    const width = 640;
    const height = 260;
    const padding = { top: 20, right: 20, bottom: 42, left: 42 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxCount = Math.max(1, ...series.map((point) => point.count));
    const chartPoints = series.map((point, index) => {
      const x =
        padding.left +
        (series.length <= 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
      const y = padding.top + plotHeight - (point.count / maxCount) * plotHeight;

      return { x, y, point };
    });
    const areaPath = buildAreaPath(chartPoints, padding.top + plotHeight);
    const linePath = buildLinePath(chartPoints);
    const yTicks = Array.from({ length: Math.min(maxCount, 4) + 1 }, (_, index) =>
      Math.round((maxCount / Math.min(maxCount, 4)) * index)
    );

    return (
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 min-w-[560px] w-full"
          role="img"
          aria-label={statsChartDialog?.title}
        >
          <defs>
            <linearGradient id="partner-stats-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.24" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = padding.top + plotHeight - (tick / maxCount) * plotHeight;

            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border))"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#partner-stats-area)" />
          <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />

          {chartPoints.map(({ x, y, point }) => (
            <g key={point.date}>
              <circle cx={x} cy={y} r="4" fill="hsl(var(--primary))" />
              <title>
                {`${formatChartDate(point.date, language)}: ${formatInteger(point.count, language)}`}
              </title>
            </g>
          ))}

          {chartPoints
            .filter((_, index) => index === 0 || index === chartPoints.length - 1 || index % 5 === 0)
            .map(({ x, point }) => (
              <text
                key={`label-${point.date}`}
                x={x}
                y={height - 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {formatChartDate(point.date, language)}
              </text>
            ))}
        </svg>
      </div>
    );
  };

  const summaryPrimaryStats = [
    {
      label: copy.partnerPlaces.totalPlaces,
      value: formatInteger(dashboardSummary.total_places, language),
    },
    {
      label: copy.partnerPlaces.activePlaces,
      value: formatInteger(dashboardSummary.active_places, language),
    },
    {
      label: copy.partnerPlaces.promotablePlaces,
      value: formatInteger(dashboardSummary.promotable_places, language),
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="container mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AppSidebarMenu isAuth isPartner onLogout={onLogout} />
            <div>
              <h1 className="text-3xl font-bold">{copy.partnerPlaces.pageTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {copy.partnerPlaces.pageDescription}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={scrollToAddPlaceForm} className="self-start">
              {copy.partnerPlaces.addPlaceAction}
            </Button>
            <Button variant="outline" onClick={onLogout} className="hidden sm:inline-flex">
              {copy.partnerPlaces.logout}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{copy.partnerPlaces.statsTitle}</CardTitle>
            <CardDescription>
              {copy.partnerPlaces.statsDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {summaryPrimaryStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border bg-muted/30 px-4 py-3 shadow-sm"
                >
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
              {renderStatButton(
                copy.partnerPlaces.suggestionsCount,
                dashboardSummary.impressions_count,
                "impressions",
                dashboardSummary.impressions_daily,
                copy.partnerPlaces.summarySuggestionsChartTitle,
              )}
              {renderStatButton(
                copy.partnerPlaces.routeAddsCount,
                dashboardSummary.clicks_count,
                "clicks",
                dashboardSummary.clicks_daily,
                copy.partnerPlaces.summaryRouteAddsChartTitle,
              )}
            </div>

            {dashboardSummary.impressions_count === 0 && dashboardSummary.clicks_count === 0 ? (
              <p className="text-sm text-muted-foreground">
                {copy.partnerPlaces.summaryHint}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{copy.partnerPlaces.yourPlaces}</CardTitle>
              <CardDescription>
                {copy.partnerPlaces.yourPlacesDescription}
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              onClick={() => void fetchPartnerDashboard()}
              disabled={listLoading}
            >
              {listLoading ? copy.partnerPlaces.refreshing : copy.partnerPlaces.refresh}
            </Button>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {copy.partnerPlaces.listLoading}
              </div>
            ) : partnerPlaces.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <p>{copy.partnerPlaces.empty}</p>
                <Button onClick={scrollToAddPlaceForm}>
                  {copy.partnerPlaces.addPlaceAction}
                </Button>
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
                            {place.name ?? copy.partnerPlaces.unnamedPlace}
                          </h3>
                          <Badge variant={getStatusBadgeVariant(place.status)}>
                            {getStatusLabel(place.status, language)}
                          </Badge>
                          <Badge variant={place.is_promotable ? "default" : "outline"}>
                            {place.is_promotable
                              ? copy.partnerPlaces.promotionOn
                              : copy.partnerPlaces.promotionOff}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>{place.formatted_address || copy.partnerPlaces.addressNotSet}</p>
                          <p>
                            {copy.partnerPlaces.externalId}:{" "}
                            <span className="font-mono text-foreground">{place.place_id}</span>
                          </p>
                        </div>

                        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-muted-foreground">{copy.partnerPlaces.category}</p>
                            <p className="font-medium">
                              {getPlaceCategoryLabel(
                                place.category,
                                language,
                                copy.profile.notSpecified,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{copy.partnerPlaces.priority}</p>
                            <p className="font-medium">{place.priority_weight}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{copy.partnerPlaces.latitude}</p>
                            <p className="font-medium">{formatCoordinate(place.lat)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{copy.partnerPlaces.longitude}</p>
                            <p className="font-medium">{formatCoordinate(place.lng)}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex flex-col gap-1">
                            <p className="font-medium">
                              {copy.partnerPlaces.placePerformance}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {copy.partnerPlaces.placePerformanceDescription}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                            {renderStatButton(
                              copy.partnerPlaces.suggestionsCount,
                              place.stats.impressions_count,
                              "impressions",
                              place.stats.impressions_daily,
                              `${place.name ?? copy.partnerPlaces.unnamedPlace}: ${copy.partnerPlaces.suggestionsCount}`,
                            )}
                            {renderStatButton(
                              copy.partnerPlaces.routeAddsCount,
                              place.stats.clicks_count,
                              "clicks",
                              place.stats.clicks_daily,
                              `${place.name ?? copy.partnerPlaces.unnamedPlace}: ${copy.partnerPlaces.routeAddsCount}`,
                            )}
                            <div className="rounded-lg border bg-background px-4 py-3">
                              <p className="text-sm text-muted-foreground">
                                {copy.partnerPlaces.uniqueUsersCount}
                              </p>
                              <p className="mt-1 text-2xl font-semibold text-foreground">
                                {formatInteger(place.stats.unique_users_count, language)}
                              </p>
                            </div>
                          </div>

                          {place.stats.impressions_count === 0 && place.stats.clicks_count === 0 ? (
                            <p className="mt-3 text-sm text-muted-foreground">
                              {copy.partnerPlaces.noPlaceStatsYet}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                          variant="outline"
                          onClick={() => openEditDialog(place)}
                        >
                          {copy.partnerPlaces.edit}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => void handlePromotableToggle(place)}
                          disabled={actionKey === `promo-${place.partner_place_id}`}
                        >
                          {actionKey === `promo-${place.partner_place_id}`
                            ? copy.partnerPlaces.saving
                            : place.is_promotable
                              ? copy.partnerPlaces.disablePromo
                              : copy.partnerPlaces.enablePromo}
                        </Button>
                        {place.status === "active" ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "paused")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? copy.partnerPlaces.saving
                              : copy.partnerPlaces.pause}
                          </Button>
                        ) : place.status === "paused" ? (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "active")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? copy.partnerPlaces.saving
                              : copy.partnerPlaces.activate}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => void handleQuickStatusChange(place, "active")}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {actionKey === `status-${place.partner_place_id}`
                              ? copy.partnerPlaces.saving
                              : copy.partnerPlaces.restore}
                          </Button>
                        )}
                        {place.status !== "archived" && (
                          <Button
                            variant="destructive"
                            onClick={() => void archivePlace(place)}
                            disabled={actionKey === `status-${place.partner_place_id}`}
                          >
                            {copy.partnerPlaces.archive}
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

        <div ref={addPlaceCardRef} className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{copy.partnerPlaces.addTitle}</CardTitle>
              <CardDescription>
                {copy.partnerPlaces.addDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{copy.partnerPlaces.placeName}</Label>
                  <Input
                    ref={placeNameInputRef}
                    value={form.placeName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, placeName: e.target.value }))
                    }
                    placeholder={copy.partnerPlaces.placeNamePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{copy.partnerPlaces.externalId}</Label>
                  <Input
                    value={
                      form.placeName.trim()
                        ? externalIdPreview || (previewLoading ? copy.partnerPlaces.generating : "")
                        : ""
                    }
                    readOnly
                    placeholder={copy.partnerPlaces.externalIdPlaceholder}
                  />
                  <p className="text-sm text-muted-foreground">
                    {copy.partnerPlaces.externalIdHelp}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{copy.partnerPlaces.category}</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={copy.partnerPlaces.categoryPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.category === CUSTOM_CATEGORY_VALUE ? (
                      <div className="space-y-2">
                        <Label>{copy.partnerPlaces.customCategory}</Label>
                        <Input
                          value={form.customCategory}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              customCategory: e.target.value,
                            }))
                          }
                          placeholder={copy.partnerPlaces.customCategoryPlaceholder}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>{copy.partnerPlaces.address}</Label>
                    <div className="relative">
                      <Input
                        value={form.address}
                        onFocus={() =>
                          setCreateAddressSearch((prev) => ({ ...prev, open: true }))
                        }
                        onBlur={() => {
                          window.setTimeout(() => {
                            setCreateAddressSearch((prev) => ({ ...prev, open: false }));
                          }, 150);
                        }}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            address: e.target.value,
                            lat: "",
                            lng: "",
                          }))
                        }
                        placeholder={copy.partnerPlaces.addressPlaceholder}
                      />
                      {createAddressSearch.open &&
                      (createAddressSearch.loading ||
                        createAddressSearch.suggestions.length > 0 ||
                        form.address.trim().length >= 3) ? (
                        <div className="absolute z-50 mt-2 w-full rounded-md border bg-background shadow-lg">
                          {createAddressSearch.loading ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {copy.partnerPlaces.searchingAddress}
                            </div>
                          ) : createAddressSearch.suggestions.length > 0 ? (
                            createAddressSearch.suggestions.map((suggestion) => (
                              <button
                                key={`${suggestion.address}-${suggestion.lat}-${suggestion.lng}`}
                                type="button"
                                className="w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectCreateSuggestion(suggestion)}
                              >
                                {suggestion.address}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {copy.partnerPlaces.noAddressMatches}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {form.lat && form.lng
                        ? `${copy.partnerPlaces.coordinatesDetected}: ${formatDetectedCoordinates(form.lat, form.lng)}`
                        : copy.partnerPlaces.addressHint}
                    </p>
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? copy.partnerPlaces.addingButton : copy.partnerPlaces.addButton}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

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
              <DialogTitle>{copy.partnerPlaces.editTitle}</DialogTitle>
              <DialogDescription>
                {copy.partnerPlaces.editDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{copy.partnerPlaces.placeName}</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{copy.partnerPlaces.category}</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={copy.partnerPlaces.categoryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editForm.category === CUSTOM_CATEGORY_VALUE ? (
                    <div className="space-y-2">
                      <Label>{copy.partnerPlaces.customCategory}</Label>
                      <Input
                        value={editForm.customCategory}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            customCategory: e.target.value,
                          }))
                        }
                        placeholder={copy.partnerPlaces.customCategoryPlaceholder}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{copy.partnerPlaces.status}</Label>
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
                      <SelectValue placeholder={copy.partnerPlaces.statusPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{copy.partnerPlaces.address}</Label>
                <div className="relative">
                  <Input
                    value={editForm.address}
                    onFocus={() =>
                      setEditAddressSearch((prev) => ({ ...prev, open: true }))
                    }
                    onBlur={() => {
                      window.setTimeout(() => {
                        setEditAddressSearch((prev) => ({ ...prev, open: false }));
                      }, 150);
                    }}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                        lat: "",
                        lng: "",
                      }))
                    }
                  />
                  {editAddressSearch.open &&
                  (editAddressSearch.loading ||
                    editAddressSearch.suggestions.length > 0 ||
                    editForm.address.trim().length >= 3) ? (
                    <div className="absolute z-50 mt-2 w-full rounded-md border bg-background shadow-lg">
                      {editAddressSearch.loading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {copy.partnerPlaces.searchingAddress}
                        </div>
                      ) : editAddressSearch.suggestions.length > 0 ? (
                        editAddressSearch.suggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.address}-${suggestion.lat}-${suggestion.lng}`}
                            type="button"
                            className="w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectEditSuggestion(suggestion)}
                          >
                            {suggestion.address}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {copy.partnerPlaces.noAddressMatches}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {editForm.lat && editForm.lng
                    ? `${copy.partnerPlaces.coordinatesDetected}: ${formatDetectedCoordinates(editForm.lat, editForm.lng)}`
                    : copy.partnerPlaces.addressHint}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{copy.partnerPlaces.priorityWeight}</Label>
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
                    <p className="font-medium">{copy.partnerPlaces.promotion}</p>
                    <p className="text-sm text-muted-foreground">
                      {copy.partnerPlaces.promotionDescription}
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
                  {copy.partnerPlaces.externalId}:{" "}
                  <span className="font-mono text-foreground">{editingPlace.place_id}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeEditDialog} disabled={editSaving}>
                {copy.partnerPlaces.cancel}
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? copy.partnerPlaces.saving : copy.partnerPlaces.saveChanges}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={statsChartDialog !== null}
          onOpenChange={(open) => {
            if (!open) {
              setStatsChartDialog(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{statsChartDialog?.title}</DialogTitle>
              <DialogDescription>
                {statsChartDialog?.metric === "clicks"
                  ? copy.partnerPlaces.routeAddsChartDescription
                  : copy.partnerPlaces.suggestionsChartDescription}
              </DialogDescription>
            </DialogHeader>

            {renderStatsChart(statsChartDialog?.points ?? [])}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
