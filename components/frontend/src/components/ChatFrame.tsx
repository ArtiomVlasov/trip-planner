import { useState, useEffect, useRef } from "react";
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

const SOCHI_PROMPTS = [
  "Plan a one-day sightseeing route in Sochi with seaside landmarks and cafes",
  "Build a walking route in Sochi with parks, viewpoints, and local food",
  "Create a Sochi family itinerary with beaches, attractions, and kid-friendly places",
  "Plan an active day in Sochi with sports, nature, and evening restaurants",
  "Create a Sochi route focused on partner places and local experiences",
  "Design a romantic Sochi evening route with sunset and dinner spots",
  "Build a food-focused Sochi route with breakfast, lunch, and dinner places",
  "Create a relaxed Sochi route with promenade walks and coffee stops",
  "Plan a Sochi cultural route with museums and historical places",
  "Build a Sochi shopping route with markets and lifestyle locations"
];

// Функция для случайного выбора N промптов
const getRandomPrompts = (prompts: string[], count: number = 3) => {
  const shuffled = [...prompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export function ChatFrame({ onLogout }: ChatFrameProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(getRandomPrompts(SOCHI_PROMPTS));
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        toast.error("Failed to load maps");
      });
  }, [browserMapsApiKey, isAuth, token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

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
            text: "I couldn't generate a route. Try being more specific.",
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
          text: isAuth
            ? "I've planned your route! Click on markers to see place info 🗺️"
            : "You're in guest mode. Sign in to unlock personalized routes 🚀",
          isUser: false,
          timestamp: new Date(),
        },
      ]);

      // Обновляем подсказки случайными 3 промптами
      setSuggestedPrompts(getRandomPrompts(SOCHI_PROMPTS));
    } catch (err) {
      console.error(err);
      toast.error("Server error");
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 3).toString(), text: "Connection error. Please try again.", isUser: false, timestamp: new Date() },
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
      toast.error("Fill place name and coordinates");
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

      toast.success("Partner place request sent");
      setPartnerPlace({
        partnerId: partnerPlace.partnerId,
        name: "",
        formattedAddress: "",
        lat: "",
        lng: "",
        types: "restaurant"
      });
    } catch {
      toast.success("Partner place request sent");
    } finally {
      setSubmittingPartnerPlace(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Sochi Trip Planner</h1>
          </div>
          <div className="flex gap-2">
            {isAuth && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                >
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Button>

                <Button onClick={onLogout} variant="outline" size="sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-4 grid lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="flex flex-col h-[calc(100vh-120px)]">
          {isPartner && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-3">Partner: Add Place</h3>
              <form onSubmit={handlePartnerPlaceSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Partner ID</Label>
                    <Input
                      value={partnerPlace.partnerId}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, partnerId: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Place Name</Label>
                    <Input
                      value={partnerPlace.name}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Partner place name"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input
                    value={partnerPlace.formattedAddress}
                    onChange={(e) => setPartnerPlace((prev) => ({ ...prev, formattedAddress: e.target.value }))}
                    placeholder="Sochi, ..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Latitude</Label>
                    <Input
                      value={partnerPlace.lat}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, lat: e.target.value }))}
                      placeholder="43.585"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitude</Label>
                    <Input
                      value={partnerPlace.lng}
                      onChange={(e) => setPartnerPlace((prev) => ({ ...prev, lng: e.target.value }))}
                      placeholder="39.723"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Types (comma-separated)</Label>
                  <Input
                    value={partnerPlace.types}
                    onChange={(e) => setPartnerPlace((prev) => ({ ...prev, types: e.target.value }))}
                    placeholder="restaurant, cafe"
                  />
                </div>
                <Button type="submit" disabled={submittingPartnerPlace}>
                  {submittingPartnerPlace ? "Sending..." : "Add Partner Place"}
                </Button>
              </form>
            </Card>
          )}

          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.isUser ? "justify-end" : "justify-start"}`}>
                <Card className={`max-w-[80%] p-3 ${m.isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-sm">{m.text}</p>
                </Card>
              </div>
            ))}
            {loading && <Card className="p-3 bg-muted">Planning your trip…</Card>}
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
              >
                {prompt}
              </Button>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Describe your trip plans…"
              disabled={loading}
            />
            <Button type="submit" disabled={loading}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {!isAuth ? (
            <div className="h-full min-h-[400px] flex items-center justify-center px-6 text-center text-muted-foreground">
              Sign in to view the map.
            </div>
          ) : apiKey ? (
            <GoogleMap apiKey={apiKey} routeData={routeData} />
          ) : (
            <div className="h-full flex items-center justify-center">Loading map…</div>
          )}
        </div>
      </div>
    </div>
  );
}
