import { useState, useEffect, useRef } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Send, MapPin, LogOut } from "lucide-react";
import { toast } from "sonner";
import { GoogleMap } from "./GoogleMap";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import { buildApiUrl } from "@/lib/api";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface PlaceInfo {
  name?: string;
  address?: string;
  rating?: number;
  price_level?: number;
  photo_url?: string;
}

interface RouteWaypoint {
  lat: number;
  lng: number;
  placeInfo?: PlaceInfo;
}

interface RouteData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  intermediates: RouteWaypoint[];
  polyline: string;
  optimizedOrder: number[];
}

interface ChatFrameProps {
  onLogout: () => void;
}

// Функция для случайного выбора N промптов
const getRandomPrompts = (prompts: string[], count: number = 3) => {
  const shuffled = [...prompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export function ChatFrame({ onLogout }: ChatFrameProps) {
  const { language, copy } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  const browserMapsApiKey = import.meta.env.DEV
    ? (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "")
    : "";

  useEffect(() => {
    if (!isAuth) {
      setApiKey("");
      return;
    }

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
        console.error("Failed to load Google Maps API key:", error);
        toast.error(copy.chat.mapsLoadError);
      });
  }, [browserMapsApiKey, copy.chat.mapsLoadError, isAuth, token]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setSuggestedPrompts(getRandomPrompts(copy.chat.suggestedPrompts));
  }, [copy.chat.suggestedPrompts, language]);

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

  // Унифицированная функция отправки сообщений
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const messageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: messageId, text, isUser: true, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      // Отправка prompt на backend
      await fetch(buildApiUrl("/prompt/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: text }),
      });

      // Получение маршрута
      const response = await fetch(buildApiUrl("/route/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await response.json();

      if (!data?.routes) {
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

      const intermediates: RouteWaypoint[] = (data.routes.intermediates || []).map((wp: any) => ({
        lat: wp.lat,
        lng: wp.lng,
        placeInfo: {
          name: wp.name,
          address: wp.formatted_address,
          rating: wp.rating,
          price_level: wp.price_level,
          photo_url: wp.photo_url,
        },
      }));

      setRouteData([
        {
          origin: data.routes.origin,
          destination: data.routes.destination,
          intermediates,
          polyline: data.routes.polyline,
          optimizedOrder: data.routes.optimizedOrder,
        },
      ]);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: isAuth ? copy.chat.routeReady : copy.chat.guestModeMessage,
          isUser: false,
          timestamp: new Date(),
        },
      ]);

      // Обновляем подсказки случайными 3 промптами
      setSuggestedPrompts(getRandomPrompts(copy.chat.suggestedPrompts));
    } catch (err) {
      console.error(err);
      toast.error(copy.chat.serverError);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 3).toString(),
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
    const text = userMessage;
    setUserMessage("");
    sendMessage(text);
  };

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

  return (
    <div className="bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-3 md:p-4">
        <div className="container mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold sm:text-xl">{copy.chat.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {isAuth && (
              <>
                <LanguageToggle />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                >
                  <User className="w-4 h-4 mr-2" />
                  {copy.chat.profile}
                </Button>

                <Button onClick={onLogout} variant="outline" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  {copy.chat.logout}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Buttons */}
      <div className="container mx-auto px-4 py-4 sm:px-6">
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

      <div className="flex-1 container mx-auto p-2 md:p-4">
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
                <Card className={`max-w-[90%] md:max-w-[80%] p-3 ${m.isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-sm">{m.text}</p>
                </Card>
              </div>
            ))}
            {loading && <Card className="p-3 bg-muted">{copy.chat.planning}</Card>}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => sendMessage(prompt)}
                className="text-xs whitespace-normal max-w-full"
              >
                {prompt}
              </Button>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder={copy.chat.inputPlaceholder}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading} size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
        ) : (
          /* Map */
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden max-w-full h-[calc(100vh-200px)]">
          {!isAuth ? (
            <div className="h-full min-h-[400px] flex items-center justify-center px-6 text-center text-muted-foreground">
              {copy.chat.mapSignIn}
            </div>
          ) : apiKey ? (
            <GoogleMap apiKey={apiKey} routeData={routeData} />
          ) : (
            <div className="h-full flex items-center justify-center">{copy.chat.mapLoading}</div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
