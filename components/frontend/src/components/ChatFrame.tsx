import { useState, useEffect, useRef } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ImageOff,
  MapPin,
  Pencil,
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

interface RouteGenerationOptions {
  isRegeneration?: boolean;
  currentRouteQueries?: string[];
  removedRouteQueries?: string[];
  addedRouteQueries?: string[];
  latestUserMessage?: string;
}

interface RouteGenerationResult {
  routeQueries: string[];
  routeDescription: string;
}

interface RouteRenderPointCard {
  query: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  source?: string;
  displayName?: string;
  googleMapsUri?: string;
  photoUrl?: string;
  placeId?: string;
}

function normalizeRoutePoint(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
}

function isAiChoiceInstruction(value: string) {
  const normalized = normalizeRoutePoint(value).toLocaleLowerCase();

  return [
    "на тво",
    "на твое",
    "на ваше",
    "your choice",
    "as you see fit",
    "up to you",
  ].some((marker) => normalized.includes(marker));
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
    .filter(Boolean)
    .filter((line) => !isAiChoiceInstruction(line));
}

const COORDINATE_QUERY_PATTERN = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;
const GENERIC_ROUTE_TITLE_PARTS = new Set([
  "сочи",
  "адлер",
  "сириус",
  "хоста",
  "мацеста",
  "красная поляна",
  "россия",
  "краснодарский край",
  "sochi",
  "adler",
  "sirius",
  "hosta",
  "russia",
]);

const PLACE_DESCRIPTION_RULES = [
  {
    markers: [
      "hotel",
      "lodging",
      "отел",
      "гостиниц",
      "санатор",
      "пансионат",
      "апартамент",
      "хостел",
      "resort",
    ],
    ru: "удобная точка для ночлега или начала дневной прогулки.",
    en: "a convenient lodging stop or a calm place to start the day.",
  },
  {
    markers: [
      "кафе",
      "ресторан",
      "кофе",
      "сыровар",
      "столов",
      "кухн",
      "бар",
      "cafe",
      "coffee",
      "restaurant",
      "bar",
      "food",
    ],
    ru: "хорошая пауза на еду, кофе и отдых между прогулками.",
    en: "a good pause for food, coffee, and a reset between walks.",
  },
  {
    markers: [
      "парк",
      "дендрар",
      "сад",
      "рощ",
      "сквер",
      "алле",
      "зелен",
      "park",
      "garden",
      "grove",
      "arboretum",
    ],
    ru: "зелёная прогулочная зона для спокойной части маршрута.",
    en: "a green walking area for the calmer part of the route.",
  },
  {
    markers: [
      "море",
      "пляж",
      "набереж",
      "морпорт",
      "морской вокзал",
      "порт",
      "sea",
      "beach",
      "embankment",
      "seaport",
      "marine",
    ],
    ru: "точка у воды для видов, прогулки и короткой остановки на фото.",
    en: "a waterside stop for views, a walk, and a quick photo break.",
  },
  {
    markers: [
      "музей",
      "театр",
      "галере",
      "истор",
      "культур",
      "museum",
      "theater",
      "theatre",
      "gallery",
      "historic",
      "culture",
    ],
    ru: "культурная остановка, чтобы добавить истории и локального контекста.",
    en: "a cultural stop that adds history and local context.",
  },
  {
    markers: [
      "ахун",
      "гора",
      "смотров",
      "видов",
      "башн",
      "водопад",
      "скал",
      "mount",
      "mountain",
      "viewpoint",
      "lookout",
      "tower",
      "waterfall",
      "rocks",
    ],
    ru: "видовая точка с панорамой города, моря или гор.",
    en: "a scenic stop with a panorama of the city, sea, or mountains.",
  },
  {
    markers: [
      "skypark",
      "скайпарк",
      "аквапарк",
      "развлеч",
      "экстрим",
      "аттракцион",
      "adventure",
      "amusement",
      "waterpark",
    ],
    ru: "активная остановка с развлечениями и более яркими впечатлениями.",
    en: "an active stop with entertainment and brighter impressions.",
  },
  {
    markers: [
      "олимп",
      "сириус",
      "имерет",
      "адлер",
      "olympic",
      "sirius",
      "imereti",
      "adler",
    ],
    ru: "просторная зона для прогулки, современных объектов и вечерней атмосферы.",
    en: "a spacious area for walking, modern venues, and an evening atmosphere.",
  },
  {
    markers: [
      "вокзал",
      "аэропорт",
      "станция",
      "ж/д",
      "жд",
      "station",
      "airport",
      "railway",
      "train",
    ],
    ru: "логичная транспортная точка, откуда удобно начать или завершить путь.",
    en: "a practical transport point for starting or finishing the route.",
  },
] as const;

function getPointWord(count: number, language: Language) {
  if (language === "en") {
    return count === 1 ? "stop" : "stops";
  }

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "точка";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "точки";
  }

  return "точек";
}

function formatShortList(items: string[], language: Language) {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  const lastItem = items[items.length - 1];
  const leadingItems = items.slice(0, -1).join(", ");
  const joiner = language === "en" ? "and" : "и";

  return `${leadingItems} ${joiner} ${lastItem}`;
}

function getRoutePointTitle(query: string, language: Language) {
  const normalized = normalizeRoutePoint(query);

  if (!normalized) {
    return language === "en" ? "Route point" : "Точка маршрута";
  }

  if (COORDINATE_QUERY_PATTERN.test(normalized)) {
    return language === "en" ? "Point on the map" : "Точка на карте";
  }

  const firstPart = normalized
    .split(",")
    .map((part) => part.trim())
    .find((part) => {
      const lowerPart = part.toLocaleLowerCase();

      return part && !GENERIC_ROUTE_TITLE_PARTS.has(lowerPart);
    });

  return firstPart || normalized;
}

function getRoutePointDescription(
  query: string,
  index: number,
  total: number,
  language: Language,
) {
  const normalized = normalizeRoutePoint(query).toLocaleLowerCase();

  if (COORDINATE_QUERY_PATTERN.test(normalized)) {
    return language === "en"
      ? "a manually selected point on the map; check the address before you go."
      : "точка, выбранная на карте вручную; перед поездкой стоит проверить адрес.";
  }

  const matchedRule = PLACE_DESCRIPTION_RULES.find((rule) =>
    rule.markers.some((marker) => normalized.includes(marker)),
  );

  if (matchedRule) {
    return matchedRule[language];
  }

  if (index === 0 && total > 1) {
    return language === "en"
      ? "the first stop of the route; it sets the direction for the day."
      : "первая остановка маршрута; от неё удобно выстроить темп дня.";
  }

  if (index === total - 1 && total > 1) {
    return language === "en"
      ? "the final stop, useful as a calm endpoint for the route."
      : "финальная остановка, удобная как спокойная точка завершения маршрута.";
  }

  return language === "en"
    ? "an interesting stop on the route; use the map to check the exact address."
    : "интересная остановка маршрута; точный адрес удобно проверить на карте.";
}

function buildRouteFlowSentence(pointTitles: string[], language: Language) {
  if (pointTitles.length === 0) {
    return "";
  }

  if (pointTitles.length === 1) {
    return language === "en"
      ? `Main stop: ${pointTitles[0]}.`
      : `Главная точка: ${pointTitles[0]}.`;
  }

  if (pointTitles.length === 2) {
    return language === "en"
      ? `Start at ${pointTitles[0]}, then finish at ${pointTitles[1]}.`
      : `Начинаем с ${pointTitles[0]}, затем завершаем в ${pointTitles[1]}.`;
  }

  const middlePoints = pointTitles.slice(1, -1);
  const visibleMiddlePoints = middlePoints.slice(0, 3);
  const hiddenMiddleCount = middlePoints.length - visibleMiddlePoints.length;
  const middleText = formatShortList(visibleMiddlePoints, language);
  const extraText =
    hiddenMiddleCount > 0
      ? language === "en"
        ? ` and ${hiddenMiddleCount} more`
        : ` и ещё ${hiddenMiddleCount}`
      : "";

  return language === "en"
    ? `Start at ${pointTitles[0]}, continue through ${middleText}${extraText}, and finish at ${pointTitles[pointTitles.length - 1]}.`
    : `Начинаем с ${pointTitles[0]}, дальше ${middleText}${extraText}, финальная точка: ${pointTitles[pointTitles.length - 1]}.`;
}

function buildRouteDescriptionMessage(
  routeQueries: string[],
  language: Language,
  isRegeneration?: boolean,
) {
  const pointTitles = routeQueries.map((query) => getRoutePointTitle(query, language));
  const countText = `${pointTitles.length} ${getPointWord(pointTitles.length, language)}`;
  const intro =
    language === "en"
      ? isRegeneration
        ? `Done, I updated the route: ${countText}.`
        : `Done, I built the route: ${countText}.`
      : isRegeneration
        ? `Готово, обновил маршрут: ${countText}.`
        : `Готово, собрал маршрут: ${countText}.`;
  const placesTitle = language === "en" ? "Briefly about the stops:" : "Кратко по местам:";
  const mapHint =
    language === "en"
      ? "The map is updated too: open the markers there to check addresses and details."
      : "Карта тоже обновлена: откройте метки, чтобы проверить адреса и детали.";
  const pointLines = routeQueries.map((query, index) => {
    const title = pointTitles[index];
    const description = getRoutePointDescription(query, index, routeQueries.length, language);

    return `${index + 1}. ${title} - ${description}`;
  });

  return [
    `${intro} ${buildRouteFlowSentence(pointTitles, language)}`.trim(),
    placesTitle,
    ...pointLines,
    mapHint,
  ].join("\n");
}

export function ChatFrame({
  onLogout,
  onLogin,
  onSignup,
  onPartnerLogin,
  authIntent = "none",
  onAuthIntentHandled,
}: ChatFrameProps) {
  const { copy, language } = useLanguage();
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
  const [isRequiredPlacesMapOpen, setIsRequiredPlacesMapOpen] = useState(false);
  const [isStartingPointMapOpen, setIsStartingPointMapOpen] = useState(false);
  const [routeGenerated, setRouteGenerated] = useState(false);
  const [routeSaveLoading, setRouteSaveLoading] = useState(false);
  const [savedRouteId, setSavedRouteId] = useState<number | null>(null);
  const [isPreferencesRegenerationOpen, setIsPreferencesRegenerationOpen] = useState(false);
  const [regenerationPreferencesText, setRegenerationPreferencesText] = useState("");
  const [isPointReplacementOpen, setIsPointReplacementOpen] = useState(false);
  const [routePointCards, setRoutePointCards] = useState<RouteRenderPointCard[]>([]);
  const [routePointCardsLoading, setRoutePointCardsLoading] = useState(false);
  const [pointReplacementDialogOpen, setPointReplacementDialogOpen] = useState(false);
  const [pointToReplace, setPointToReplace] = useState<string | null>(null);
  const [pointReplacementPrompt, setPointReplacementPrompt] = useState("");
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
    if (
      pointToReplace
      && !routeQueries.some(
        (routePoint) => routePoint.toLocaleLowerCase() === pointToReplace.toLocaleLowerCase(),
      )
    ) {
      setPointReplacementDialogOpen(false);
      setPointToReplace(null);
      setPointReplacementPrompt("");
    }
  }, [pointToReplace, routeQueries]);

  useEffect(() => {
    if (!isPointReplacementOpen || routeQueries.length === 0) {
      return;
    }

    const abortController = new AbortController();
    setRoutePointCardsLoading(true);

    void fetch(buildApiUrl("/routes/render-data"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routeQueries,
      }),
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Route render request failed with status ${response.status}`);
        }

        return response.json();
      })
      .then((payload: { routePoints?: RouteRenderPointCard[] }) => {
        if (abortController.signal.aborted) {
          return;
        }

        setRoutePointCards(Array.isArray(payload?.routePoints) ? payload.routePoints : []);
      })
      .catch((error) => {
        if (abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load route point cards:", error);
        setRoutePointCards([]);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setRoutePointCardsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [isPointReplacementOpen, routeQueries]);

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
    options?: RouteGenerationOptions,
  ): Promise<RouteGenerationResult> => {
    const latestUserMessage =
      options?.latestUserMessage?.trim() ||
      [...sourceMessages]
        .reverse()
        .find((message) => message.isUser)?.text
        ?.trim() ||
      "";

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
        currentRouteQueries: options?.currentRouteQueries ?? routeQueries,
        removedRouteQueries: options?.removedRouteQueries ?? [],
        addedRouteQueries: options?.addedRouteQueries ?? [],
        accommodationPreference: accommodationPreference || undefined,
        contextMessages: sourceMessages
          .filter((message) => message.isUser)
          .map((message) => message.text.trim())
          .filter(Boolean),
        latestUserMessage,
      }),
    });

    if (!response.ok) {
      throw new Error(`Route generation request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      routeQueries: Array.isArray(data?.routeQueries)
        ? data.routeQueries
            .map((query: unknown) => String(query ?? "").trim())
            .filter(Boolean)
        : [],
      routeDescription: String(data?.routeDescription ?? "").trim(),
    };
  };

  const generateRoute = async (
    sourceMessages: Message[],
    options?: RouteGenerationOptions,
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
      let nextRouteDescription = "";

      try {
        const generatedRoute = await requestGeneratedRouteQueries(
          nextMessages,
          extractedRouteQueries,
          options,
        );

        if (generatedRoute.routeQueries.length > 0) {
          nextRouteQueries = generatedRoute.routeQueries;
        }
        nextRouteDescription = generatedRoute.routeDescription;
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
      setShowChat(true);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: nextRouteDescription || buildRouteDescriptionMessage(
            nextRouteQueries,
            language,
            options?.isRegeneration,
          ),
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

    void generateRoute(nextMessages, {
      isRegeneration: routeGenerated,
      currentRouteQueries: routeQueries,
      latestUserMessage: text,
    });
  };

  const handlePlannerStart = async (e: React.FormEvent) => {
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
    setIsStartingPointMapOpen(false);
    setIsRequiredPlacesMapOpen(false);
    setUserMessage("");
    await generateRoute(nextMessages, {
      currentRouteQueries: [],
      latestUserMessage: initialMessage,
    });
  };

  const openPointReplacementDialog = (point: string) => {
    setPointToReplace(point);
    setPointReplacementPrompt("");
    setPointReplacementDialogOpen(true);
  };

  const getRoutePointCard = (point: string) =>
    routePointCards.find(
      (item) => item.query.toLocaleLowerCase() === point.toLocaleLowerCase(),
    );

  const handlePreferencesRegeneration = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedPreferences = regenerationPreferencesText.trim();
    const latestUserMessage = normalizedPreferences;

    if (!normalizedPreferences) {
      toast.error(copy.chat.regenerationPreferencesError);
      return;
    }

    const messageParts = [`${copy.chat.regenerationPreferencePrefix} ${normalizedPreferences}`];

    setIsPreferencesRegenerationOpen(false);
    setRegenerationPreferencesText("");
    const nextMessageText = messageParts.join("\n");
    const nextMessage = createPendingUserMessage(nextMessageText);
    const nextMessages = [...messages, nextMessage];

    markRouteAsDirty();
    setMessages(nextMessages);
    setShowChat(true);

    await generateRoute(nextMessages, {
      isRegeneration: true,
      currentRouteQueries: routeQueries,
      latestUserMessage: latestUserMessage || nextMessageText,
    });
  };

  const handleRoutePointReplacement = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!pointToReplace) {
      return;
    }

    const normalizedNotes = pointReplacementPrompt.trim();
    const latestUserMessage = [
      normalizedNotes,
      pointToReplace,
    ]
      .filter(Boolean)
      .join("\n");

    const messageParts = [
      normalizedNotes
        ? `${copy.chat.regenerationReplacementPrefix} ${normalizedNotes}`
        : copy.chat.regenerationReplacementSingleFallback,
      `${copy.chat.regenerationRemovedPointsPrefix}\n1. ${pointToReplace}`,
    ].filter(Boolean);

    setPointReplacementDialogOpen(false);
    setPointReplacementPrompt("");
    const nextMessageText = messageParts.join("\n");
    const nextMessage = createPendingUserMessage(nextMessageText);
    const nextMessages = [...messages, nextMessage];
    const removedPoint = pointToReplace;
    setPointToReplace(null);

    markRouteAsDirty();
    setMessages(nextMessages);
    setShowChat(true);

    await generateRoute(nextMessages, {
      isRegeneration: true,
      currentRouteQueries: routeQueries,
      removedRouteQueries: [removedPoint],
      latestUserMessage: latestUserMessage || nextMessageText,
    });
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

      if (!plannerStarted && isStartingPointMapOpen) {
        setStartingPointFromMap(address);
        setIsStartingPointMapOpen(false);
        toast.success(copy.chat.startingPointAddedFromMap);
        return;
      }

      if (!plannerStarted && isRequiredPlacesMapOpen) {
        addRequiredPlaceFromMap(address);
        setIsRequiredPlacesMapOpen(false);
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
    copy.chat.startingPointAddedFromMap,
    isRequiredPlacesMapOpen,
    isStartingPointMapOpen,
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
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant={isPreferencesRegenerationOpen ? "default" : "outline"}
                onClick={() => {
                  const next = !isPreferencesRegenerationOpen;
                  setIsPreferencesRegenerationOpen(next);
                  setIsPointReplacementOpen(next);
                }}
                className="w-full sm:w-auto"
              >
                {language === "ru" ? "Редактировать маршрут" : "Edit route"}
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

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {copy.chat.regenerationPreferencesSubmit}
                </Button>
              </div>
            </form>
          ) : null}

          {isPointReplacementOpen ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{copy.chat.regenerationPointsTitle}</Label>
                <p className="text-sm text-muted-foreground">
                  {copy.chat.regenerationPointsDescription}
                </p>

                <div className="space-y-3">
                  {routeQueries.length > 0 ? (
                    routeQueries.map((point) => {
                      const pointCard = getRoutePointCard(point);
                      const cardTitle =
                        pointCard?.displayName?.trim() || point;
                      const cardAddress =
                        pointCard?.address?.trim() || point;
                      const googleMapsUri = pointCard?.googleMapsUri?.trim() || "";
                      const photoUrl = pointCard?.photoUrl?.trim() || "";

                      return (
                        <Card
                          key={point}
                          className="overflow-hidden border border-border/70 bg-background"
                        >
                          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                            <div className="relative h-24 overflow-hidden rounded-xl bg-muted sm:w-36 sm:shrink-0">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={cardTitle}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-sky-100 text-muted-foreground">
                                  <div className="flex items-center gap-2 text-sm">
                                    <ImageOff className="h-4 w-4" />
                                    <span>{copy.chat.routePointCardNoPhoto}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                              <div className="space-y-1">
                                <h4 className="text-base font-semibold text-foreground">
                                  {cardTitle}
                                </h4>
                                <p className="text-sm text-muted-foreground">{cardAddress}</p>
                              </div>

                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                {googleMapsUri ? (
                                  <a
                                    href={googleMapsUri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    {copy.chat.routePointCardOpenMaps}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {copy.chat.routePointCardNoMapsLink}
                                  </span>
                                )}

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPointReplacementDialog(point)}
                                  className="shrink-0 self-start sm:self-auto"
                                >
                                  {copy.chat.routePointCardReplace}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {copy.chat.regenerationPointsEmpty}
                    </p>
                  )}
                </div>
                {routePointCardsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {copy.chat.routePointCardsLoading}
                  </p>
                ) : null}
              </div>
            </div>
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

  const setStartingPointFromMap = (value: string) => {
    const normalized = normalizeRoutePoint(value);

    if (!normalized) {
      return;
    }

    setStartingPointAddress(normalized);
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
                <div className="flex items-center gap-3">
                  <Input
                    id="planner-starting-point"
                    value={startingPointAddress}
                    onChange={(event) => setStartingPointAddress(event.target.value)}
                    placeholder={copy.chat.startingPointPlaceholder}
                    className="rounded-2xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsStartingPointMapOpen((prev) => !prev);
                      setIsRequiredPlacesMapOpen(false);
                    }}
                    size="icon"
                    aria-label={
                      isStartingPointMapOpen
                        ? copy.chat.closeStartingPointMap
                        : copy.chat.openStartingPointMap
                    }
                    title={
                      isStartingPointMapOpen
                        ? copy.chat.closeStartingPointMap
                        : copy.chat.openStartingPointMap
                    }
                    className="h-10 w-10 shrink-0 rounded-2xl"
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                {isStartingPointMapOpen ? (
                  <Card className="overflow-hidden border-border/70 p-3">
                    <div className="mb-3 space-y-1">
                      <p className="text-sm font-medium">{copy.chat.startingPointMapTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {copy.chat.startingPointMapHint}
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
                    onClick={() => {
                      setIsRequiredPlacesMapOpen((prev) => !prev);
                      setIsStartingPointMapOpen(false);
                    }}
                    size="icon"
                    aria-label={
                      isRequiredPlacesMapOpen
                        ? copy.chat.closeRequiredPlaceMap
                        : copy.chat.openRequiredPlaceMap
                    }
                    title={
                      isRequiredPlacesMapOpen
                        ? copy.chat.closeRequiredPlaceMap
                        : copy.chat.openRequiredPlaceMap
                    }
                    className="h-10 w-10 shrink-0 rounded-2xl"
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>

                {isRequiredPlacesMapOpen ? (
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

              <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
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

      <Dialog
        open={pointReplacementDialogOpen}
        onOpenChange={(open) => {
          setPointReplacementDialogOpen(open);
          if (!open) {
            setPointReplacementPrompt("");
            setPointToReplace(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleRoutePointReplacement} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{copy.chat.regenerationReplacementDialogTitle}</DialogTitle>
              <DialogDescription>
                {pointToReplace
                  ? `${copy.chat.regenerationReplacementDialogDescription} ${pointToReplace}`
                  : copy.chat.regenerationReplacementDialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="route-replacement-prompt">
                {copy.chat.regenerationReplacementLabel}
              </Label>
              <Textarea
                id="route-replacement-prompt"
                value={pointReplacementPrompt}
                onChange={(event) => setPointReplacementPrompt(event.target.value)}
                placeholder={copy.chat.regenerationReplacementPlaceholder}
                className="min-h-[140px] resize-y rounded-2xl"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPointReplacementDialogOpen(false);
                  setPointReplacementPrompt("");
                  setPointToReplace(null);
                }}
              >
                {copy.chat.regenerationReplacementDialogCancel}
              </Button>
              <Button type="submit" disabled={loading}>
                {copy.chat.regenerationPointsSubmit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
