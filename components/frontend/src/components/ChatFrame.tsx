import { useState, useEffect, useRef } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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

interface ChatFrameProps {
  onLogout: () => void;
  onLogin?: (options?: { intent?: "save-route" }) => void;
  onSignup?: (options?: { intent?: "save-route" }) => void;
  onPartnerLogin?: () => void;
  authIntent?: "none" | "save-route";
  onAuthIntentHandled?: () => void;
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

function removeRoutePoint(target: string[], value: string) {
  const normalized = normalizeRoutePoint(value).toLocaleLowerCase();

  if (!normalized) {
    return;
  }

  const nextPoints = target.filter(
    (point) => normalizeRoutePoint(point).toLocaleLowerCase() !== normalized,
  );

  target.splice(0, target.length, ...nextPoints);
}

function parsePointsText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+\.)\s*/, "").trim())
    .filter(Boolean);
}

export function ChatFrame({
  onLogout,
  onLogin,
  onSignup,
  onPartnerLogin,
  authIntent = "none",
  onAuthIntentHandled,
}: ChatFrameProps) {
  const { copy } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [plannerStarted, setPlannerStarted] = useState(false);
  const [accommodationPreference, setAccommodationPreference] = useState<"yes" | "no" | "">("");
  const [routeDescription, setRouteDescription] = useState("");
  const [startingPointAddress, setStartingPointAddress] = useState("");
  const [requiredPlaces, setRequiredPlaces] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [routeQueries, setRouteQueries] = useState<string[]>([]);
  const [isFormMapOpen, setIsFormMapOpen] = useState(false);
  const [routeGenerated, setRouteGenerated] = useState(false);
  const [routeSaveLoading, setRouteSaveLoading] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<number | null>(null);
  const [isPreferencesRegenerationOpen, setIsPreferencesRegenerationOpen] = useState(false);
  const [regenerationPreferencesText, setRegenerationPreferencesText] = useState("");
  const [regenerationAddedPointsText, setRegenerationAddedPointsText] = useState("");
  const [isPointReplacementOpen, setIsPointReplacementOpen] = useState(false);
  const [routePointsToReplace, setRoutePointsToReplace] = useState<string[]>([]);
  const [replacementNotesText, setReplacementNotesText] = useState("");
  const [replacementPointsText, setReplacementPointsText] = useState("");
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

  useEffect(() => {
    if (!isAuth) {
      setSavedRouteId(null);
    }
  }, [isAuth]);

  useEffect(() => {
    setRoutePointsToReplace((current) =>
      current.filter((selectedPoint) =>
        routeQueries.some(
          (routePoint) =>
            routePoint.toLocaleLowerCase() === selectedPoint.toLocaleLowerCase(),
        ),
      ),
    );
  }, [routeQueries]);

  const markRouteAsDirty = () => {
    setRouteGenerated(false);
    setSavedRouteId(null);
  };

  const addUserMessage = (text: string) => {
    if (!text.trim()) return;

    markRouteAsDirty();
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

  const extractRouteQueriesFromMessages = (items: Message[]) => {
    const queries: string[] = [];

    items
      .filter((message) => message.isUser)
      .forEach((message) => {
        const lines = message.text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        let currentBlock: "required" | "added" | "removed" | null = null;

        lines.forEach((line) => {
          if (line === copy.chat.initialMessageRequiredPlacesPrefix) {
            currentBlock = "required";
            return;
          }

          if (line === copy.chat.regenerationAddedPointsPrefix) {
            currentBlock = "added";
            return;
          }

          if (line === copy.chat.regenerationRemovedPointsPrefix) {
            currentBlock = "removed";
            return;
          }

          if (currentBlock) {
            const routePointMatch = line.match(/^\d+\.\s+(.+)$/);

            if (routePointMatch) {
              if (currentBlock === "removed") {
                removeRoutePoint(queries, routePointMatch[1]);
              } else {
                addUniqueRoutePoint(queries, routePointMatch[1]);
              }
              return;
            }

            currentBlock = null;
          }

          if (
            line.startsWith(copy.chat.initialMessageStartingPointPrefix) &&
            !line.startsWith(copy.chat.initialMessageNoStartingPoint)
          ) {
            addUniqueRoutePoint(
              queries,
              line.slice(copy.chat.initialMessageStartingPointPrefix.length).trim(),
            );
            return;
          }

          if (line.startsWith(copy.chat.routePointInstructionPrefix)) {
            addUniqueRoutePoint(
              queries,
              line.slice(copy.chat.routePointInstructionPrefix.length).trim(),
            );
          }
        });
      });

    return queries;
  };

  const getCurrentRouteTitle = () => {
    const firstRequiredPlace = requiredPlaces.map((place) => place.trim()).find(Boolean);

    if (firstRequiredPlace) {
      return firstRequiredPlace;
    }

    if (routeDescription.trim()) {
      return routeDescription.trim();
    }

    if (startingPointAddress.trim()) {
      return startingPointAddress.trim();
    }

    return copy.chat.defaultSavedRouteTitle;
  };

  const saveCurrentRoute = async () => {
    if (!token) {
      return;
    }

    if (!routeGenerated) {
      toast.error(copy.chat.routeSaveRequiresReady);
      return;
    }

    setRouteSaveLoading(true);

    try {
      const response = await fetch(buildApiUrl("/users/me/routes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: getCurrentRouteTitle(),
          routeQueries,
          messages: messages.map((message) => ({
            id: message.id,
            text: message.text,
            isUser: message.isUser,
            timestamp: message.timestamp.toISOString(),
            isSent: message.isSent ?? false,
          })),
          metadata: {
            accommodationPreference,
            routeDescription: routeDescription.trim(),
            requiredPlaces: requiredPlaces.map((place) => place.trim()).filter(Boolean),
            startingPointAddress: startingPointAddress.trim(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Save route request failed with status ${response.status}`);
      }

      const data = await response.json();
      setSavedRouteId(typeof data?.id === "number" ? data.id : null);
      toast.success(copy.chat.routeSavedSuccess);
    } catch (error) {
      console.error("Failed to save route:", error);
      toast.error(copy.chat.routeSavedError);
    } finally {
      setRouteSaveLoading(false);
    }
  };

  useEffect(() => {
    if (
      !isAuth ||
      authIntent !== "save-route" ||
      routeSaveLoading ||
      !routeGenerated ||
      savedRouteId !== null
    ) {
      return;
    }

    onAuthIntentHandled?.();
    void saveCurrentRoute();
  }, [
    authIntent,
    isAuth,
    onAuthIntentHandled,
    routeGenerated,
    routeSaveLoading,
    saveCurrentRoute,
    savedRouteId,
  ]);

  const requestGeneratedRouteQueries = async (
    sourceMessages: Message[],
    extractedRouteQueries: string[],
  ) => {
    const response = await fetch(buildApiUrl("/routes/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        routeDescription: routeDescription.trim(),
        startingPointAddress: startingPointAddress.trim(),
        requiredPlaces: requiredPlaces.map((place) => place.trim()).filter(Boolean),
        routeQueries: extractedRouteQueries,
        accommodationPreference: accommodationPreference || undefined,
        contextMessages: sourceMessages
          .filter((message) => message.isUser)
          .map((message) => message.text.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      throw new Error(`Route generation request failed with status ${response.status}`);
    }

    const data = await response.json();

    return Array.isArray(data?.routeQueries)
      ? data.routeQueries
          .map((query: unknown) => String(query ?? "").trim())
          .filter(Boolean)
      : [];
  };

  const generateRoute = async (
    sourceMessages: Message[],
    options?: { isRegeneration?: boolean },
  ) => {
    const pendingMessages = sourceMessages.filter((message) => message.isUser && !message.isSent);
    let nextMessages = sourceMessages;

    setLoading(true);

    try {
      if (pendingMessages.length > 0) {
        const pendingIds = new Set(pendingMessages.map((message) => message.id));
        nextMessages = sourceMessages.map((message) =>
          pendingIds.has(message.id)
            ? { ...message, isSent: true, isEditing: false }
            : message,
        );
        setMessages(nextMessages);
      }

      const extractedRouteQueries = extractRouteQueriesFromMessages(nextMessages);
      let nextRouteQueries = extractedRouteQueries;

      try {
        const generatedRouteQueries = await requestGeneratedRouteQueries(
          nextMessages,
          extractedRouteQueries,
        );

        if (generatedRouteQueries.length > 0) {
          nextRouteQueries = generatedRouteQueries;
        }
      } catch (routeGenerationError) {
        console.error("Failed to reach route generation service:", routeGenerationError);
      }

      if (nextRouteQueries.length === 0) {
        setRouteQueries([]);
        setRouteGenerated(false);
        setSavedRouteId(null);
        setShowChat(true);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            text: copy.chat.routeFailed,
            isUser: false,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setRouteQueries(nextRouteQueries);
      setRouteGenerated(true);
      setSavedRouteId(null);
      setShowChat(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text:
            nextRouteQueries.length === 1
              ? options?.isRegeneration
                ? copy.chat.routeDraftUpdated
                : copy.chat.routeDraftReady
              : options?.isRegeneration
                ? copy.chat.routeUpdated
                : copy.chat.routeReady,
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

  const createPendingUserMessage = (text: string): Message => ({
    id: Date.now().toString(),
    text,
    isUser: true,
    timestamp: new Date(),
    isSent: false,
  });

  const appendMessageAndGenerate = async (text: string) => {
    const nextMessage = createPendingUserMessage(text);
    const nextMessages = [...messages, nextMessage];

    markRouteAsDirty();
    setMessages(nextMessages);
    setShowChat(true);

    await generateRoute(nextMessages, { isRegeneration: true });
  };

  const handleGenerateFromChat = (e: React.FormEvent) => {
    e.preventDefault();

    const text = userMessage.trim();
    const nextMessages = text
      ? [...messages, createPendingUserMessage(text)]
      : messages;

    if (text) {
      markRouteAsDirty();
      setUserMessage("");
      setMessages(nextMessages);
    }

    void generateRoute(nextMessages, { isRegeneration: routeGenerated });
  };

  const handlePlannerStart = (e: React.FormEvent) => {
    e.preventDefault();

    if (!accommodationPreference) {
      toast.error(copy.chat.selectAccommodationError);
      return;
    }

    const normalizedRequiredPlaces = requiredPlaces.map((place) => place.trim()).filter(Boolean);

    const initialMessageParts = [
      accommodationPreference === "yes"
        ? copy.chat.initialMessageAccommodationYes
        : copy.chat.initialMessageAccommodationNo,
      routeDescription.trim()
        ? `${copy.chat.initialMessageRoutePrefix} ${routeDescription.trim()}`
        : "",
      startingPointAddress.trim()
        ? `${copy.chat.initialMessageStartingPointPrefix} ${startingPointAddress.trim()}`
        : copy.chat.initialMessageNoStartingPoint,
      normalizedRequiredPlaces.length > 0
        ? `${copy.chat.initialMessageRequiredPlacesPrefix}\n${normalizedRequiredPlaces
            .map((place, index) => `${index + 1}. ${place}`)
            .join("\n")}`
        : copy.chat.initialMessageNoRequiredPlaces,
    ];

    const initialMessage = initialMessageParts.filter(Boolean).join("\n");
    const nextMessages = [
      {
        id: Date.now().toString(),
        text: initialMessage,
        isUser: true,
        timestamp: new Date(),
        isSent: false,
      },
    ];

    markRouteAsDirty();
    setRouteQueries(extractRouteQueriesFromMessages(nextMessages));
    setMessages(nextMessages);
    setPlannerStarted(true);
    setShowChat(true);
    setIsFormMapOpen(false);
    setUserMessage("");
    void generateRoute(nextMessages);
  };

  const toggleRoutePointReplacement = (point: string) => {
    setRoutePointsToReplace((current) =>
      current.some((value) => value.toLocaleLowerCase() === point.toLocaleLowerCase())
        ? current.filter((value) => value.toLocaleLowerCase() !== point.toLocaleLowerCase())
        : [...current, point],
    );
  };

  const handlePreferencesRegeneration = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedPreferences = regenerationPreferencesText.trim();
    const addedPoints = parsePointsText(regenerationAddedPointsText);

    if (!normalizedPreferences && addedPoints.length === 0) {
      toast.error(copy.chat.regenerationPreferencesError);
      return;
    }

    const messageParts = [
      normalizedPreferences
        ? `${copy.chat.regenerationPreferencePrefix} ${normalizedPreferences}`
        : "",
      addedPoints.length > 0
        ? `${copy.chat.regenerationAddedPointsPrefix}\n${addedPoints
            .map((point, index) => `${index + 1}. ${point}`)
            .join("\n")}`
        : "",
    ].filter(Boolean);

    setIsPreferencesRegenerationOpen(false);
    setRegenerationPreferencesText("");
    setRegenerationAddedPointsText("");
    await appendMessageAndGenerate(messageParts.join("\n"));
  };

  const handleRoutePointReplacement = async (event: React.FormEvent) => {
    event.preventDefault();

    if (routePointsToReplace.length === 0) {
      toast.error(copy.chat.regenerationPointsSelectError);
      return;
    }

    const normalizedNotes = replacementNotesText.trim();
    const replacementPoints = parsePointsText(replacementPointsText);

    const messageParts = [
      normalizedNotes
        ? `${copy.chat.regenerationReplacementPrefix} ${normalizedNotes}`
        : copy.chat.regenerationReplacementFallback,
      `${copy.chat.regenerationRemovedPointsPrefix}\n${routePointsToReplace
        .map((point, index) => `${index + 1}. ${point}`)
        .join("\n")}`,
      replacementPoints.length > 0
        ? `${copy.chat.regenerationAddedPointsPrefix}\n${replacementPoints
            .map((point, index) => `${index + 1}. ${point}`)
            .join("\n")}`
        : "",
    ].filter(Boolean);

    setIsPointReplacementOpen(false);
    setRoutePointsToReplace([]);
    setReplacementNotesText("");
    setReplacementPointsText("");
    await appendMessageAndGenerate(messageParts.join("\n"));
  };

  const handleDeleteMessage = (messageId: string) => {
    markRouteAsDirty();
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
    markRouteAsDirty();
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
      addUserMessage(`${copy.chat.routePointInstructionPrefix} ${address}.`);
    };

    window.addEventListener("map-add-to-route", handleAddToRoute);

    return () => {
      window.removeEventListener("map-add-to-route", handleAddToRoute);
    };
  }, [
    copy.chat.requiredPlaceAddedFromMap,
    copy.chat.routePointAdded,
    copy.chat.routePointInstructionPrefix,
    isFormMapOpen,
    plannerStarted,
  ]);

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

  const handleRequireAuthToSave = (mode: "login" | "signup") => {
    if (mode === "signup") {
      onSignup?.({ intent: "save-route" });
      return;
    }

    onLogin?.({ intent: "save-route" });
  };

  const renderRouteSaveCallout = () => {
    if (!routeGenerated) {
      return null;
    }

    const title = savedRouteId
      ? copy.chat.routeSavedCardTitle
      : copy.chat.saveRouteCardTitle;
    const description = savedRouteId
      ? copy.chat.routeSavedCardDescription
      : isAuth
        ? copy.chat.saveRouteCardDescriptionAuth
        : copy.chat.saveRouteCardDescriptionGuest;

    return (
      <Card className="border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {savedRouteId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/profile")}
                className="w-full sm:w-auto"
              >
                <User className="mr-2 h-4 w-4" />
                {copy.chat.profile}
              </Button>
            ) : isAuth ? (
              <Button
                type="button"
                onClick={() => void saveCurrentRoute()}
                disabled={routeSaveLoading}
                className="w-full sm:w-auto"
              >
                {routeSaveLoading ? copy.chat.savingRoute : copy.chat.saveRoute}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => handleRequireAuthToSave("signup")}
                  className="w-full sm:w-auto"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {copy.chat.saveRouteSignUp}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRequireAuthToSave("login")}
                  className="w-full sm:w-auto"
                >
                  {copy.chat.saveRouteLogin}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderRegenerationTools = () => {
    if (!routeGenerated) {
      return null;
    }

    return (
      <Card className="border-border/70 p-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {copy.chat.regenerationToolsTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {copy.chat.regenerationToolsDescription}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant={isPreferencesRegenerationOpen ? "default" : "outline"}
                onClick={() => {
                  setIsPreferencesRegenerationOpen((current) => !current);
                  setIsPointReplacementOpen(false);
                }}
                className="w-full sm:w-auto"
              >
                {copy.chat.regenerationPreferencesButton}
              </Button>

              <Button
                type="button"
                variant={isPointReplacementOpen ? "default" : "outline"}
                onClick={() => {
                  setIsPointReplacementOpen((current) => !current);
                  setIsPreferencesRegenerationOpen(false);
                }}
                className="w-full sm:w-auto"
                disabled={routeQueries.length === 0}
              >
                {copy.chat.regenerationPointsButton}
              </Button>
            </div>
          </div>

          {isPreferencesRegenerationOpen ? (
            <form onSubmit={handlePreferencesRegeneration} className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label htmlFor="route-regeneration-preferences">
                  {copy.chat.regenerationPreferencesTitle}
                </Label>
                <Textarea
                  id="route-regeneration-preferences"
                  value={regenerationPreferencesText}
                  onChange={(event) => setRegenerationPreferencesText(event.target.value)}
                  placeholder={copy.chat.regenerationPreferencesPlaceholder}
                  className="min-h-[120px] resize-y rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-regeneration-added-points">
                  {copy.chat.regenerationAddedPointsLabel}
                </Label>
                <Textarea
                  id="route-regeneration-added-points"
                  value={regenerationAddedPointsText}
                  onChange={(event) => setRegenerationAddedPointsText(event.target.value)}
                  placeholder={copy.chat.regenerationAddedPointsPlaceholder}
                  className="min-h-[100px] resize-y rounded-2xl"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {copy.chat.regenerationPreferencesSubmit}
                </Button>
              </div>
            </form>
          ) : null}

          {isPointReplacementOpen ? (
            <form onSubmit={handleRoutePointReplacement} className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{copy.chat.regenerationPointsTitle}</Label>
                <p className="text-sm text-muted-foreground">
                  {copy.chat.regenerationPointsDescription}
                </p>

                <div className="flex flex-wrap gap-2">
                  {routeQueries.length > 0 ? (
                    routeQueries.map((point) => {
                      const isSelected = routePointsToReplace.some(
                        (value) => value.toLocaleLowerCase() === point.toLocaleLowerCase(),
                      );

                      return (
                        <Button
                          key={point}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleRoutePointReplacement(point)}
                          className="h-auto min-h-10 whitespace-normal text-left"
                        >
                          {point}
                        </Button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {copy.chat.regenerationPointsEmpty}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-replacement-notes">
                  {copy.chat.regenerationReplacementLabel}
                </Label>
                <Textarea
                  id="route-replacement-notes"
                  value={replacementNotesText}
                  onChange={(event) => setReplacementNotesText(event.target.value)}
                  placeholder={copy.chat.regenerationReplacementPlaceholder}
                  className="min-h-[100px] resize-y rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="route-replacement-points">
                  {copy.chat.regenerationReplacementPointsLabel}
                </Label>
                <Textarea
                  id="route-replacement-points"
                  value={replacementPointsText}
                  onChange={(event) => setReplacementPointsText(event.target.value)}
                  placeholder={copy.chat.regenerationReplacementPointsPlaceholder}
                  className="min-h-[100px] resize-y rounded-2xl"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {copy.chat.regenerationPointsSubmit}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </Card>
    );
  };

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
                <Label htmlFor="planner-route-description" className="text-base font-medium">
                  {copy.chat.routeDetailsLabel}
                </Label>
                <Textarea
                  id="planner-route-description"
                  value={routeDescription}
                  onChange={(event) => setRouteDescription(event.target.value)}
                  placeholder={copy.chat.routeDetailsPlaceholder}
                  className="min-h-[120px] resize-y rounded-2xl"
                />
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
                    <div className="h-[360px] overflow-hidden rounded-2xl border">
                      <YandexMap
                        routeQueries={[]}
                        routeBuildingText={copy.chat.routeBuilding}
                        routeReadyText={copy.chat.routeReady}
                        routeFailedText={copy.chat.routeFailed}
                      />
                    </div>
                  </Card>
                ) : null}
              </div>

              {!isAuth ? (
                <p className="text-sm text-muted-foreground">{copy.chat.guestPlanningHint}</p>
              ) : null}

              <Button type="submit" className="w-full sm:w-auto">
                {copy.chat.setupSubmit}
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <>
          {/* Toggle Buttons */}
          <div className="container mx-auto space-y-3 px-4 py-2 sm:px-6 sm:py-3">
            {renderRouteSaveCallout()}
            {renderRegenerationTools()}
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

          <form onSubmit={handleGenerateFromChat} className="space-y-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder={copy.chat.inputPlaceholder}
              disabled={loading}
              className="w-full"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                editingMessageId !== null ||
                (!userMessage.trim() && messages.filter((message) => message.isUser).length === 0)
              }
            >
              <Send className="w-4 h-4" />
              {userMessage.trim() ? copy.chat.sendAndGenerateRoute : copy.chat.generateRoute}
            </Button>
          </form>
        </div>
        ) : (
          /* Map */
          <div className="bg-white rounded-lg shadow-sm border max-w-full h-[calc(100vh-170px)] md:h-[calc(100vh-185px)]">
            <YandexMap
              routeQueries={routeQueries}
              routeBuildingText={copy.chat.routeBuilding}
              routeReadyText={copy.chat.routeReady}
              routeFailedText={copy.chat.routeFailed}
            />
        </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
