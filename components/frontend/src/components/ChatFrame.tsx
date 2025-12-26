import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MapPin, LogOut } from "lucide-react";
import { toast } from "sonner";
import { GoogleMap } from "./GoogleMap";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface RouteData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  intermediates: { lat: number; lng: number }[];
  polyline: string;
  optimizedOrder: number[];
}

interface ChatFrameProps {
  onLogout: () => void;
}

export function ChatFrame({ onLogout }: ChatFrameProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Авторизация
  const token = localStorage.getItem("token");
  const isAuth = Boolean(token);

  // Получаем ключ Google Maps
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim()) return;

    const messageId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      { id: messageId, text: userMessage, isUser: true, timestamp: new Date() },
    ]);

    setLoading(true);
    setUserMessage("");

    try {
      // Отправляем prompt
      await fetch("http://43.245.224.126:8000/prompt/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: userMessage }),
      });

      // Получаем маршрут
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

      setRouteData([
        {
          origin: data.routes.origin,
          destination: data.routes.destination,
          intermediates: data.routes.intermediates,
          polyline: data.routes.polyline,
          optimizedOrder: data.routes.optimizedOrder,
        },
      ]);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          text: isAuth
            ? "I've planned your route! Check the map below 🗺️"
            : "You're in guest mode. Sign in to unlock personalized routes 🚀",
          isUser: false,
          timestamp: new Date(),
        },
      ]);
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">AI Trip Planner</h1>
          </div>

          <div className="flex gap-2">
            {isAuth ? (
              <Button onClick={onLogout} variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-4 grid lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="flex flex-col h-[calc(100vh-120px)]">
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
          {apiKey ? <GoogleMap apiKey={apiKey} routeData={routeData} /> : <div className="h-full flex items-center justify-center">Loading map…</div>}
        </div>
      </div>
    </div>
  );
}