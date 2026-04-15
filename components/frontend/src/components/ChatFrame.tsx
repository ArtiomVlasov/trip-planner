import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MapPin, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { GoogleMap } from "./GoogleMap";
import { useNavigate } from "react-router-dom";

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

const PARIS_PROMPTS = [
  "Plan a one-day sightseeing route in Paris including top landmarks and cafes",
  "Create a walking route with museums and historical places in Paris",
  "Build a food-focused route in Paris with local restaurants",
  "Explore hidden gems in Paris: charming streets, local cafés, and boutique shops",
  "Plan a romantic evening route in Paris with sunset spots and cozy restaurants",
  "Create a family-friendly Paris itinerary including parks, museums, and fun activities",
  "Design a photography-focused route in Paris covering iconic landmarks and scenic viewpoints",
  "Plan a cultural route in Paris with theaters, galleries, and historical monuments",
  "Build a shopping-focused route in Paris including markets and designer boutiques",
  "Create a relaxed day in Paris with cafes, parks, and scenic river walks"
];

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
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(getRandomPrompts(PARIS_PROMPTS));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isAuth = Boolean(token);

  useEffect(() => {
    fetch("http://43.245.224.126:8000/api/maps-key")
      .then((res) => res.json())
      .then((data) => setApiKey(data.apiKey))
      .catch(() => toast.error("Failed to load maps"));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const messageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: messageId, text, isUser: true, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      await fetch("http://43.245.224.126:8000/prompt/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: text }),
      });

      const response = await fetch("http://43.245.224.126:8000/route/", {
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

      setSuggestedPrompts(getRandomPrompts(PARIS_PROMPTS));
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-white p-3 shadow-sm sm:p-4">
        <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold sm:text-xl">AI Trip Planner</h1>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {isAuth && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/profile")}
                  className="flex-1 sm:flex-none"
                >
                  <User className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Profile</span>
                </Button>

                <Button onClick={onLogout} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto grid flex-1 gap-4 p-3 sm:gap-6 sm:p-4 lg:grid-cols-2">
        <div className="flex min-h-[22rem] flex-col lg:h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.isUser ? "justify-end" : "justify-start"}`}>
                <Card className={`max-w-[85%] break-words p-3 sm:max-w-[80%] ${m.isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="text-sm">{m.text}</p>
                </Card>
              </div>
            ))}
            {loading && <Card className="p-3 bg-muted">Planning your trip…</Card>}
            <div ref={messagesEndRef} />
          </div>

          <div className="mb-3 grid gap-2 sm:flex sm:flex-wrap">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => sendMessage(prompt)}
                className="h-auto whitespace-normal justify-start px-3 py-2 text-left"
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

        <div className="min-h-[18rem] overflow-hidden rounded-lg border bg-white shadow-sm lg:h-[calc(100vh-120px)]">
          {apiKey ? (
            <GoogleMap apiKey={apiKey} routeData={routeData} />
          ) : (
            <div className="h-full flex items-center justify-center">Loading map…</div>
          )}
        </div>
      </div>
    </div>
  );
}
