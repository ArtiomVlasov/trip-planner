import { useState, useEffect, useRef } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Send,
  Trash2,
  LogOut,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { YandexMap } from "./YandexMap";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { buildApiUrl } from "@/lib/api";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isSent?: boolean;
  isEditing?: boolean;
}

interface RoutePlanningPayload {
  route_request: string;
  accommodation_required: boolean;
  meal_required: boolean | null;
  meal_preferences?: string;
  starting_point_address?: string;
  required_places: string[];
}

interface RoutePlanningItem {
  order: number;
  place_name: string;
  address: string;
  category?: string | null;
  visit_reason?: string | null;
}

interface RoutePlanningResponse {
  route_points?: string[];
  route_items?: RoutePlanningItem[];
}

interface RoutePlanningResult {
  routePoints: string[];
  routeItems: RoutePlanningItem[];
}

interface ChatFrameProps {
  onLogout: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
  onPartnerLogin?: () => void;
}

function normalizeRoutePoint(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
}

function addUniqueRoutePoint(target: string[], value: string) {
  const normalized = normalizeRoutePoint(value);

  if (!normalized) {
    return;
  }

  if (!target.some((point) => point.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
    target.push(normalized);
  }
}

export function ChatFrame({ onLogout, onLogin, onSignup, onPartnerLogin }: ChatFrameProps) {
  const { copy } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [plannerStarted, setPlannerStarted] = useState(false);
  const [accommodationPreference, setAccommodationPreference] = useState<"yes" | "no" | "">("");
  const [mealPreference, setMealPreference] = useState<"yes" | "no" | "">("");
  const [routeRequest, setRouteRequest] = useState("");
  const [startingPointAddress, setStartingPointAddress] = useState("");
  const [mealPreferencesText, setMealPreferencesText] = useState("");
  const [requiredPlaces, setRequiredPlaces] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showChat, setShowChat] = useState(true);
  const [routeQueries, setRouteQueries] = useState<string[]>([]);
  const [isFormMapOpen, setIsFormMapOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMountedRef = useRef(false);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isAuth = Boolean(token);
  const isPartner = localStorage.getItem("accountType") === "partner";
  const [partnerPlace, setPartnerPlace] = useState({
    partnerId: "1",
    name: "",
    formattedAddress: "",
    lat: "",
    lng: "",
    types: "restaurant"
  });
  const [submittingPartnerPlace, setSubmittingPartnerPlace] = useState(false);
  const browserMapsApiKey = import.meta.env.VITE_YANDEX_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (browserMapsApiKey) {
      setApiKey(browserMapsApiKey);
      return;
    }

    fetch(buildApiUrl("/api/maps-key"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Maps key request failed with status ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        if (!data?.apiKey) {
          throw new Error("Maps key is missing in response");
        }

        setApiKey(data.apiKey);
      })
      .catch((error) => {
        console.error("Failed to load Yandex Maps API key:", error);
        toast.error(copy.chat.mapsLoadError);
      });
  }, [browserMapsApiKey, copy.chat.mapsLoadError, token]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (!loading && messages.length === 0) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > 0 ? "smooth" : "auto",
      block: "nearest",
    });
  }, [loading, messages.length]);

  useEffect(() => {
    if (!editingTextareaRef.current) {
      return;
    }

    editingTextareaRef.current.style.height = "0px";
    editingTextareaRef.current.style.height = `${editingTextareaRef.current.scrollHeight}px`;
  }, [editingMessageId, editingText]);

  const addUserMessage = (text: string) => {
    if (!text.trim()) return;

    const messageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        text: text.trim(),
        isUser: true,
        timestamp: new Date(),
        isSent: false,
      },
    ]);
  };

  const addAssistantMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + Math.random()).toString(),
        text,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const buildInitialPlannerMessage = (
    normalizedRouteRequest: string,
    normalizedRequiredPlaces: string[],
  ) => {
    const initialMessageParts = [
      accommodationPreference === "yes"
        ? copy.chat.initialMessageAccommodationYes
        : copy.chat.initialMessageAccommodationNo,
      `${copy.chat.initialMessageRoutePrefix} ${normalizedRouteRequest}`,
      startingPointAddress.trim()
        ? `${copy.chat.initialMessageStartingPointPrefix} ${startingPointAddress.trim()}`
        : copy.chat.initialMessageNoStartingPoint,
      mealPreference === "yes"
        ? mealPreferencesText.trim()
          ? `${copy.chat.initialMessageMealYes} ${mealPreferencesText.trim()}`
          : copy.chat.initialMessageMealYesNoDetails
        : mealPreference === "no"
          ? copy.chat.initialMessageMealNo
          : copy.chat.initialMessageMealOptional,
      normalizedRequiredPlaces.length > 0
        ? `${copy.chat.initialMessageRequiredPlacesPrefix}\n${normalizedRequiredPlaces
            .map((place, index) => `${index + 1}. ${place}`)
            .join("\n")}`
        : copy.chat.initialMessageNoRequiredPlaces,
    ];

    return initialMessageParts.join("\n");
  };

  const buildRoutePointsAssistantMessage = (
    routePoints: string[],
    routeItems: RoutePlanningItem[],
  ) =>
    `${copy.chat.routePointsMessagePrefix}\n${(routeItems.length > 0 ? routeItems : routePoints)
      .map((point, index) =>
        typeof point === "string"
          ? `${index + 1}. ${point}`
          : `${point.order}. ${point.place_name} — ${point.address}`,
      )
      .join("\n")}`;

  const requestRoutePoints = async (payload: RoutePlanningPayload): Promise<RoutePlanningResult> => {
    const response = await fetch(buildApiUrl("/api/route-points"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    let data: RoutePlanningResponse | { detail?: string } | null = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const errorDetail =
      data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail.trim()
        : "";

    if (!response.ok) {
      throw new Error(errorDetail || copy.chat.routeFailed);
    }

    const routePoints =
      data && typeof data === "object" && "route_points" in data && Array.isArray(data.route_points)
        ? data.route_points.map((point) => String(point).trim()).filter(Boolean)
        : [];
    const routeItems =
      data && typeof data === "object" && "route_items" in data && Array.isArray(data.route_items)
        ? data.route_items
            .map((item, index) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              const placeName =
                "place_name" in item && typeof item.place_name === "string"
                  ? item.place_name.trim()
                  : "";
              const address =
                "address" in item && typeof item.address === "string"
                  ? item.address.trim()
                  : "";

              if (!address) {
                return null;
              }

              return {
                order:
                  "order" in item && typeof item.order === "number" ? item.order : index + 1,
                place_name: placeName || address,
                address,
                category:
                  "category" in item && typeof item.category === "string"
                    ? item.category
                    : null,
                visit_reason:
                  "visit_reason" in item && typeof item.visit_reason === "string"
                    ? item.visit_reason
                    : null,
              };
            })
            .filter((item): item is RoutePlanningItem => Boolean(item))
        : [];
    const normalizedRoutePoints =
      routePoints.length > 0
        ? routePoints
        : routeItems.map((item) => item.address).filter(Boolean);

    if (normalizedRoutePoints.length < 2) {
      throw new Error(copy.chat.routeNeedTwoPoints);
    }

    console.info("Route points response from backend:", {
      routePoints: normalizedRoutePoints,
      routeItems,
    });

    return { routePoints: normalizedRoutePoints, routeItems };
  };

  const generateRoute = () => {
    const pendingMessages = messages.filter((message) => message.isUser && !message.isSent);

    if (pendingMessages.length > 0) {
      const pendingIds = new Set(pendingMessages.map((message) => message.id));
      setMessages((prev) =>
        prev.map((message) =>
          pendingIds.has(message.id)
            ? { ...message, isSent: true, isEditing: false }
            : message,
        ),
      );
    }

    if (routeQueries.length < 2) {
      toast.error(copy.chat.routeNeedTwoPoints);
      addAssistantMessage(copy.chat.routeNeedTwoPoints);
      return;
    }

    setShowChat(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = userMessage;
    setUserMessage("");
    addUserMessage(text);
  };

  const handlePlannerStart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accommodationPreference) {
      toast.error(copy.chat.selectAccommodationError);
      return;
    }

    const normalizedRouteRequest = routeRequest.trim();

    if (!normalizedRouteRequest) {
      toast.error(copy.chat.enterRouteDetailsError);
      return;
    }

    const normalizedRequiredPlaces = requiredPlaces.map((place) => place.trim()).filter(Boolean);
    const initialMessage = buildInitialPlannerMessage(
      normalizedRouteRequest,
      normalizedRequiredPlaces,
    );
    const payload: RoutePlanningPayload = {
      route_request: normalizedRouteRequest,
      accommodation_required: accommodationPreference === "yes",
      meal_required: mealPreference ? mealPreference === "yes" : null,
      meal_preferences: mealPreferencesText.trim() || undefined,
      starting_point_address: startingPointAddress.trim() || undefined,
      required_places: normalizedRequiredPlaces,
    };

    setLoading(true);

    try {
      const { routePoints, routeItems } = await requestRoutePoints(payload);

      setRouteQueries(routePoints);
      setMessages([
        {
          id: Date.now().toString(),
          text: initialMessage,
          isUser: true,
          timestamp: new Date(),
          isSent: true,
        },
        {
          id: (Date.now() + 1).toString(),
          text: buildRoutePointsAssistantMessage(routePoints, routeItems),
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      setPlannerStarted(true);
      setShowChat(false);
      setUserMessage("");
      setIsFormMapOpen(false);
    } catch (error) {
      console.error("Failed to plan route via GigaChat:", error);
      toast.error(error instanceof Error ? error.message : copy.chat.connectionError);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setEditingText("");
    }
  };

  const handleStartEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingText(message.text);
  };

  const handleSaveEditing = (messageId: string) => {
    const nextText = editingText.trim();
    if (!nextText) {
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, text: nextText } : message,
      ),
    );
    setEditingMessageId(null);
    setEditingText("");
  };

  useEffect(() => {
    const handleAddToRoute = (event: Event) => {
      const detail = (event as CustomEvent<{ address?: string; coordinates?: string }>).detail;
      const address = detail?.address?.trim();

      if (!address) {
        return;
      }

      if (!plannerStarted && isFormMapOpen) {
        addRequiredPlaceFromMap(address);
        setIsFormMapOpen(false);
        toast.success(copy.chat.requiredPlaceAddedFromMap);
        return;
      }

      setShowChat(true);
      toast.success(copy.chat.routePointAdded);
      setRouteQueries((prev) => {
        const next = [...prev];
        addUniqueRoutePoint(next, address);
        return next;
      });
      addUserMessage(`Добавь в маршрут точку: ${address}.`);
    };

    window.addEventListener("map-add-to-route", handleAddToRoute);

    return () => {
      window.removeEventListener("map-add-to-route", handleAddToRoute);
    };
  }, [copy.chat.requiredPlaceAddedFromMap, copy.chat.routePointAdded, isFormMapOpen, plannerStarted]);

  const handlePartnerPlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partnerPlace.name || !partnerPlace.lat || !partnerPlace.lng) {
      toast.error(copy.chat.partnerValidationError);
      return;
    }

    const payload = {
      partner_id: Number(partnerPlace.partnerId || 1),
      name: partnerPlace.name,
      formatted_address: partnerPlace.formattedAddress,
      location: {
        latitude: Number(partnerPlace.lat),
        longitude: Number(partnerPlace.lng),
      },
      types: partnerPlace.types.split(",").map((type) => type.trim()).filter(Boolean),
    };

    setSubmittingPartnerPlace(true);
    try {
      await fetch(buildApiUrl("/partners/places"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      toast.success(copy.chat.partnerSubmitSuccess);
      setPartnerPlace({
        partnerId: partnerPlace.partnerId,
        name: "",
        formattedAddress: "",
        lat: "",
        lng: "",
        types: "restaurant"
      });
    } catch {
      toast.error(copy.chat.serverError);
    } finally {
      setSubmittingPartnerPlace(false);
    }
  };

  const renderGuestActions = () => (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button type="button" onClick={onLogin} className="w-full sm:w-auto">
        {copy.sidebar.login}
      </Button>
      <Button type="button" variant="outline" onClick={onSignup} className="w-full sm:w-auto">
        <UserPlus className="mr-2 h-4 w-4" />
        {copy.sidebar.signup}
      </Button>
    </div>
  );

  const addRequiredPlace = () => {
    setRequiredPlaces((prev) => [...prev, ""]);
  };

  const addRequiredPlaceFromMap = (value: string) => {
    const normalized = normalizeRoutePoint(value);

    if (!normalized) {
      return;
    }

    setRequiredPlaces((prev) => {
      if (
        prev.some(
          (place) =>
            normalizeRoutePoint(place).toLocaleLowerCase() === normalized.toLocaleLowerCase(),
        )
      ) {
        return prev;
      }

      return [...prev, normalized];
    });
  };

  const updateRequiredPlace = (index: number, value: string) => {
    setRequiredPlaces((prev) =>
      prev.map((place, placeIndex) => (placeIndex === index ? value : place)),
    );
  };

  const removeRequiredPlace = (index: number) => {
    setRequiredPlaces((prev) => prev.filter((_, placeIndex) => placeIndex !== index));
  };

  const moveRequiredPlace = (index: number, direction: "up" | "down") => {
    setRequiredPlaces((prev) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <div className="bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-3 md:p-4">
        <div className="container mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <AppSidebarMenu
              isAuth={isAuth}
              isPartner={isPartner}
              onLogin={onLogin}
              onSignup={onSignup}
              onPartnerLogin={onPartnerLogin}
              onLogout={onLogout}
            />
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold sm:text-xl">{copy.chat.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {isAuth && (
              <>
                <LanguageToggle className="hidden sm:inline-flex" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                  className="hidden sm:inline-flex"
                >
                  <User className="w-4 h-4 mr-2" />
                  {copy.chat.profile}
                </Button>

                <Button onClick={onLogout} variant="outline" size="sm" className="hidden sm:inline-flex">
                  <LogOut className="w-4 h-4 mr-2" />
                  {copy.chat.logout}
                </Button>
              </>
            )}
            {!isAuth && (
              <>
                <LanguageToggle className="hidden sm:inline-flex" />
                <Button onClick={onLogin} size="sm" className="hidden sm:inline-flex">
                  {copy.sidebar.login}
                </Button>
                <Button onClick={onSignup} variant="outline" size="sm" className="hidden sm:inline-flex">
                  {copy.sidebar.signup}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {!plannerStarted ? (
        <div className="container mx-auto flex flex-1 items-start justify-center px-4 py-6 sm:px-6 md:py-10">
          <Card className="w-full max-w-3xl border-border/70 p-5 shadow-sm sm:p-7">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{copy.chat.setupTitle}</h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                {copy.chat.setupDescription}
              </p>
            </div>

            <form onSubmit={handlePlannerStart} className="mt-6 space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">{copy.chat.accommodationQuestion}</Label>
                <RadioGroup
                  value={accommodationPreference}
                  onValueChange={(value) => setAccommodationPreference(value as "yes" | "no")}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/40">
                    <RadioGroupItem value="yes" id="planner-accommodation-yes" />
                    <div>
                      <div className="font-medium">{copy.chat.accommodationYes}</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/40">
                    <RadioGroupItem value="no" id="planner-accommodation-no" />
                    <div>
                      <div className="font-medium">{copy.chat.accommodationNo}</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label htmlFor="planner-route-request" className="text-base font-medium">
                  {copy.chat.routeDetailsLabel}
                </Label>
                <Textarea
                  id="planner-route-request"
                  value={routeRequest}
                  onChange={(event) => setRouteRequest(event.target.value)}
                  placeholder={copy.chat.routeDetailsPlaceholder}
                  className="min-h-[160px] resize-y rounded-2xl"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{copy.chat.requiredPlacesLabel}</Label>
                <p className="text-sm text-muted-foreground">{copy.chat.requiredPlacesHint}</p>

                {requiredPlaces.length > 0 ? (
                  <div className="space-y-3">
                    {requiredPlaces.map((place, index) => (
                      <div key={`required-place-${index}`} className="flex items-center gap-2">
                        <Input
                          value={place}
                          onChange={(event) => updateRequiredPlace(index, event.target.value)}
                          placeholder={copy.chat.requiredPlacePlaceholder}
                          className="rounded-2xl"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveRequiredPlace(index, "up")}
                          aria-label={copy.chat.moveRequiredPlaceUp}
                          disabled={index === 0}
                          className="shrink-0 rounded-2xl"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveRequiredPlace(index, "down")}
                          aria-label={copy.chat.moveRequiredPlaceDown}
                          disabled={index === requiredPlaces.length - 1}
                          className="shrink-0 rounded-2xl"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeRequiredPlace(index)}
                          aria-label={copy.chat.removeRequiredPlace}
                          className="shrink-0 rounded-2xl"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRequiredPlace}
                    className="h-10 flex-1 justify-start rounded-2xl px-3 text-sm whitespace-nowrap"
                  >
                    {copy.chat.addRequiredPlace}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormMapOpen((prev) => !prev)}
                    size="icon"
                    aria-label={
                      isFormMapOpen ? copy.chat.closeRequiredPlaceMap : copy.chat.openRequiredPlaceMap
                    }
                    title={
                      isFormMapOpen ? copy.chat.closeRequiredPlaceMap : copy.chat.openRequiredPlaceMap
                    }
                    className="h-10 w-10 shrink-0 rounded-2xl"
                    disabled={!apiKey}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>

                {isFormMapOpen ? (
                  <Card className="overflow-hidden border-border/70 p-3">
                    <div className="mb-3 space-y-1">
                      <p className="text-sm font-medium">{copy.chat.requiredPlaceMapTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {copy.chat.requiredPlaceMapHint}
                      </p>
                    </div>
                    {apiKey ? (
                      <div className="h-[360px] overflow-hidden rounded-2xl border">
                        <YandexMap
                          apiKey={apiKey}
                          routeQueries={[]}
                          routeBuildingText={copy.chat.routeBuilding}
                          routeReadyText={copy.chat.routeReady}
                          routeFailedText={copy.chat.routeFailed}
                          routeNeedTwoPointsText={copy.chat.routeNeedTwoPoints}
                          routeMissingPointsText={copy.chat.routeMissingPoints}
                        />
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                        {copy.chat.mapLoading}
                      </div>
                    )}
                  </Card>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label htmlFor="planner-starting-point" className="text-base font-medium">
                  {copy.chat.startingPointLabel}
                </Label>
                <Input
                  id="planner-starting-point"
                  value={startingPointAddress}
                  onChange={(event) => setStartingPointAddress(event.target.value)}
                  placeholder={copy.chat.startingPointPlaceholder}
                  className="rounded-2xl"
                />
                <p className="text-sm text-muted-foreground">{copy.chat.startingPointHint}</p>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{copy.chat.mealQuestion}</Label>
                <RadioGroup
                  value={mealPreference}
                  onValueChange={(value) => setMealPreference(value as "yes" | "no")}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/40">
                    <RadioGroupItem value="yes" id="planner-meal-yes" />
                    <div>
                      <div className="font-medium">{copy.chat.mealYes}</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/40">
                    <RadioGroupItem value="no" id="planner-meal-no" />
                    <div>
                      <div className="font-medium">{copy.chat.mealNo}</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {mealPreference === "yes" && (
                <div className="space-y-3">
                  <Label htmlFor="planner-meal-preferences" className="text-base font-medium">
                    {copy.chat.mealPreferencesLabel}
                  </Label>
                  <Textarea
                    id="planner-meal-preferences"
                    value={mealPreferencesText}
                    onChange={(event) => setMealPreferencesText(event.target.value)}
                    placeholder={copy.chat.mealPreferencesPlaceholder}
                    className="min-h-[120px] resize-y rounded-2xl"
                  />
                </div>
              )}

              {!isAuth && (
                <Card className="border-dashed p-4 text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    {copy.chat.guestModeMessage}
                  </p>
                  {renderGuestActions()}
                </Card>
              )}

              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading ? copy.chat.planning : copy.chat.setupSubmit}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <>
          {/* Toggle Buttons */}
          <div className="container mx-auto px-4 py-2 sm:px-6 sm:py-3">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
            <Button
              variant={showChat ? "default" : "outline"}
              onClick={() => setShowChat(true)}
                className="w-full px-8 sm:w-auto sm:min-w-[120px]"
            >
              {copy.chat.chatTab}
            </Button>
            <Button
              variant={!showChat ? "default" : "outline"}
              onClick={() => setShowChat(false)}
                className="w-full px-8 sm:w-auto sm:min-w-[120px]"
            >
              {copy.chat.mapTab}
            </Button>
            </div>
          </div>

          <div
            className={`flex-1 container mx-auto px-2 pb-2 md:px-4 md:pb-4 ${
              showChat ? "pt-0 md:pt-1" : "pt-0"
            }`}
          >
            {showChat ? (
          /* Chat */
          <div className="flex flex-col h-[calc(100vh-200px)] max-w-full">
          {!isAuth && (
            <Card className="mb-4 border-dashed p-4 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                {copy.chat.guestModeMessage}
              </p>
              {renderGuestActions()}
            </Card>
          )}
          {isPartner && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-3">{copy.chat.partnerPanelTitle}</h3>
              <form onSubmit={handlePartnerPlaceSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>{copy.chat.partnerIdLabel}</Label>
                    <Input
                      value={partnerPlace.partnerId}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, partnerId: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{copy.chat.placeNameLabel}</Label>
                    <Input
                      value={partnerPlace.name}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={copy.chat.placeNamePlaceholder}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{copy.chat.addressLabel}</Label>
                  <Input
                    value={partnerPlace.formattedAddress}
                    onChange={(e) => setPartnerPlace((prev) => ({ ...prev, formattedAddress: e.target.value }))}
                    placeholder={copy.chat.addressPlaceholder}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>{copy.chat.latitudeLabel}</Label>
                    <Input
                      value={partnerPlace.lat}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, lat: e.target.value }))}
                      placeholder={copy.chat.latitudePlaceholder}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{copy.chat.longitudeLabel}</Label>
                    <Input
                      value={partnerPlace.lng}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, lng: e.target.value }))}
                      placeholder={copy.chat.longitudePlaceholder}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{copy.chat.typesLabel}</Label>
                  <Input
                    value={partnerPlace.types}
                    onChange={(e) => setPartnerPlace((prev) => ({ ...prev, types: e.target.value }))}
                    placeholder={copy.chat.typesPlaceholder}
                  />
                </div>
                <Button type="submit" disabled={submittingPartnerPlace}>
                  {submittingPartnerPlace ? copy.chat.partnerSubmitting : copy.chat.partnerSubmit}
                </Button>
              </form>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.isUser ? "justify-end" : "justify-start"}`}>
                <Card
                  className={`max-w-[90%] md:max-w-[80%] p-3 ${
                    m.isUser
                      ? m.isSent
                        ? "bg-primary text-primary-foreground"
                        : "border-primary/30 bg-primary/10 text-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.isUser && editingMessageId === m.id ? (
                    <div className="space-y-3">
                      <textarea
                        ref={editingTextareaRef}
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        rows={1}
                        className={`w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm outline-none ${
                          m.isSent ? "text-primary-foreground" : "text-foreground"
                        }`}
                      />
                      <div className="flex justify-end">
                        <Button type="button" size="sm" onClick={() => handleSaveEditing(m.id)}>
                          <Check className="h-4 w-4" />
                          {copy.chat.saveEdit}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                      {m.isUser ? (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span
                            className={`text-xs ${
                              m.isSent
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            }`}
                          >
                            {m.isSent ? copy.chat.sentMessage : copy.chat.unsentMessage}
                          </span>
                          {!m.isSent ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleStartEditing(m)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDeleteMessage(m.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </Card>
              </div>
            ))}
            {loading && <Card className="p-3 bg-muted">{copy.chat.planning}</Card>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="space-y-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder={copy.chat.inputPlaceholder}
              disabled={loading}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={loading || !userMessage.trim()}
              >
                <Send className="w-4 h-4" />
                {copy.chat.sendMessage}
              </Button>
              <Button
                type="button"
                onClick={generateRoute}
                className="w-full"
                disabled={
                  loading ||
                  editingMessageId !== null ||
                  messages.filter((message) => message.isUser).length === 0
                }
              >
                {copy.chat.generateRoute}
              </Button>
            </div>
          </form>
        </div>
        ) : (
          /* Map */
          <div className="bg-white rounded-lg shadow-sm border max-w-full h-[calc(100vh-170px)] md:h-[calc(100vh-185px)]">
          {!isAuth ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-muted-foreground">{copy.chat.mapSignIn}</p>
              <div className="w-full max-w-sm">
                {renderGuestActions()}
              </div>
            </div>
          ) : apiKey ? (
            <YandexMap
              apiKey={apiKey}
              routeQueries={routeQueries}
              routeBuildingText={copy.chat.routeBuilding}
              routeReadyText={copy.chat.routeReady}
              routeFailedText={copy.chat.routeFailed}
              routeNeedTwoPointsText={copy.chat.routeNeedTwoPoints}
              routeMissingPointsText={copy.chat.routeMissingPoints}
            />
          ) : (
            <div className="h-full flex items-center justify-center">{copy.chat.mapLoading}</div>
          )}
        </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
