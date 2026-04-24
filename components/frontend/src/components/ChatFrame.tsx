import { useState, useEffect, useRef } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pencil,
  Send,
  Trash2,
  LogOut,
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

interface ChatFrameProps {
  onLogout: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
  onPartnerLogin?: () => void;
}

interface PlannedRoutePoint {
  time?: string;
  name?: string;
  address?: string;
  reason?: string;
}

interface PlannedRouteResponse {
  status?: string;
  title?: string;
  summary?: string;
  route_queries?: string[];
  route_points?: PlannedRoutePoint[];
  practical_tips?: string[];
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
  const [needsAccommodation, setNeedsAccommodation] = useState(false);
  const [routeRequest, setRouteRequest] = useState("");
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

  const createUserMessage = (text: string): Message => ({
    id: Date.now().toString(),
    text: text.trim(),
    isUser: true,
    timestamp: new Date(),
    isSent: false,
  });

  const buildConversationPrompt = (items: Message[]) => {
    return items
      .filter((message) => message.isUser)
      .map((message) => message.text.trim())
      .filter(Boolean)
      .join("\n\n");
  };

  const formatAssistantRouteMessage = (route: PlannedRouteResponse) => {
    const lines: string[] = [];

    if (route.title?.trim()) {
      lines.push(route.title.trim());
    }

    if (route.summary?.trim()) {
      lines.push(route.summary.trim());
    }

    const routePoints = Array.isArray(route.route_points) ? route.route_points : [];
    if (routePoints.length > 0) {
      lines.push("");
      lines.push("План дня:");
      routePoints.forEach((point, index) => {
        const title = [point.time?.trim(), point.name?.trim()].filter(Boolean).join(" - ");
        const address = point.address?.trim();
        const reason = point.reason?.trim();
        lines.push(`${index + 1}. ${title || point.name?.trim() || "Точка маршрута"}`);
        if (address) {
          lines.push(`   ${address}`);
        }
        if (reason) {
          lines.push(`   ${reason}`);
        }
      });
    }

    const practicalTips = Array.isArray(route.practical_tips) ? route.practical_tips : [];
    if (practicalTips.length > 0) {
      lines.push("");
      lines.push("Советы:");
      practicalTips.slice(0, 3).forEach((tip) => {
        if (tip?.trim()) {
          lines.push(`- ${tip.trim()}`);
        }
      });
    }

    return lines.join("\n").trim() || copy.chat.routeReady;
  };

  const generateRoute = async (sourceMessages = messages) => {
    const pendingMessages = sourceMessages.filter((message) => message.isUser && !message.isSent);
    const conversationPrompt = buildConversationPrompt(sourceMessages);

    setLoading(true);

    try {
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

      if (!conversationPrompt) {
        toast.error(copy.chat.enterRouteDetailsError);
        return;
      }

      const promptResponse = await fetch(buildApiUrl("/prompt/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: conversationPrompt,
        }),
      });

      if (!promptResponse.ok) {
        throw new Error(`Prompt request failed with status ${promptResponse.status}`);
      }

      const routeResponse = await fetch(buildApiUrl("/route/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!routeResponse.ok) {
        throw new Error(`Route request failed with status ${routeResponse.status}`);
      }

      const routeData = (await routeResponse.json()) as PlannedRouteResponse;
      const nextRouteQueries = Array.isArray(routeData.route_queries)
        ? routeData.route_queries.map((query) => query.trim()).filter(Boolean)
        : [];

      if (nextRouteQueries.length < 2) {
        toast.error(copy.chat.routeNeedTwoPoints);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            text: copy.chat.routeNeedTwoPoints,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setRouteQueries(nextRouteQueries);
      setShowChat(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: formatAssistantRouteMessage(routeData),
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error(err);
      toast.error(copy.chat.serverError);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: copy.chat.connectionError,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedText = userMessage.trim();

    if (!normalizedText) {
      return;
    }

    const nextMessage = createUserMessage(normalizedText);
    const nextMessages = [...messages, nextMessage];
    setUserMessage("");
    setMessages(nextMessages);
    void generateRoute(nextMessages);
  };

  const handlePlannerStart = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedRouteRequest = routeRequest.trim();

    if (!normalizedRouteRequest) {
      toast.error(copy.chat.enterRouteDetailsError);
      return;
    }

    const normalizedRequiredPlaces = requiredPlaces.map((place) => place.trim()).filter(Boolean);

    const initialMessageParts = [
      needsAccommodation
        ? copy.chat.initialMessageAccommodationYes
        : copy.chat.initialMessageAccommodationNo,
      `${copy.chat.initialMessageRoutePrefix} ${normalizedRouteRequest}`,
      normalizedRequiredPlaces.length > 0
        ? `${copy.chat.initialMessageRequiredPlacesPrefix}\n${normalizedRequiredPlaces
            .map((place, index) => `${index + 1}. ${place}`)
            .join("\n")}`
        : copy.chat.initialMessageNoRequiredPlaces,
    ];

    const initialMessage = initialMessageParts.join("\n");
    const initialMessages = [
      {
        id: Date.now().toString(),
        text: initialMessage,
        isUser: true,
        timestamp: new Date(),
        isSent: false,
      },
    ];

    setRouteQueries([]);
    setMessages(initialMessages);
    setPlannerStarted(true);
    setShowChat(true);
    setUserMessage("");
    await generateRoute(initialMessages);
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
                <label
                  htmlFor="planner-accommodation"
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 transition-colors hover:bg-muted/40"
                >
                  <Checkbox
                    id="planner-accommodation"
                    checked={needsAccommodation}
                    onCheckedChange={(checked) => setNeedsAccommodation(checked === true)}
                  />
                  <div className="font-medium">{copy.chat.accommodationYes}</div>
                </label>
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

              <Button type="submit" className="w-full sm:w-auto">
                {copy.chat.setupSubmit}
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
            <div>
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={loading || editingMessageId !== null || !userMessage.trim()}
              >
                <Send className="w-4 h-4" />
                {copy.chat.sendMessage}
              </Button>
            </div>
          </form>
        </div>
        ) : (
          /* Map */
          <div className="bg-white rounded-lg shadow-sm border max-w-full h-[calc(100vh-170px)] md:h-[calc(100vh-185px)]">
          {apiKey ? (
            <YandexMap
              apiKey={apiKey}
              routeQueries={routeQueries}
              routeBuildingText={copy.chat.routeBuilding}
              routeReadyText={copy.chat.routeReady}
              routeFailedText={copy.chat.routeFailed}
              routeNeedTwoPointsText={copy.chat.routeNeedTwoPoints}
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
