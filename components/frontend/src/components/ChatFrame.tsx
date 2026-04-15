import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GoogleMap } from "./GoogleMap";
import { buildApiUrl } from "@/lib/api";
import { LogOut, Map, MapPin, MessageSquareText, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

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

const sochiPrompts = [
  "Build a walkable Sochi day with sea views, coffee, and one museum.",
  "Plan a romantic Sochi evening with sunset spots and dinner.",
  "Create a family route in Sochi with parks, snacks, and easy walking.",
  "Make a food-focused Sochi route with breakfast, lunch, and dessert.",
  "Plan an active Sochi day with nature, viewpoints, and local places.",
  "Create a relaxed Sochi route with promenade walks and hidden cafes.",
];

const pickPrompts = (count = 3) => [...sochiPrompts].sort(() => Math.random() - 0.5).slice(0, count);

export function ChatFrame({ onLogout }: ChatFrameProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(pickPrompts());
  const [activeView, setActiveView] = useState<"planner" | "map">("planner");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username") || "Traveler";
  const browserMapsApiKey = import.meta.env.DEV ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "" : "";

  const routeStops = useMemo(() => {
    const currentRoute = routeData[0];
    return currentRoute ? currentRoute.intermediates.length + 2 : 0;
  }, [routeData]);

  useEffect(() => {
    if (browserMapsApiKey) {
      setApiKey(browserMapsApiKey);
      return;
    }

    fetch(buildApiUrl("/api/maps-key"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Maps key request failed with status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data?.apiKey) {
          throw new Error("Maps key is missing in response");
        }
        setApiKey(data.apiKey);
      })
      .catch(() => {
        toast.error("Failed to load Google Maps key");
      });
  }, [browserMapsApiKey, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pushAssistantMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-assistant`,
        text,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-user`,
        text,
        isUser: true,
        timestamp: new Date(),
      },
    ]);
    setLoading(true);
    setActiveView("planner");

    try {
      await fetch(buildApiUrl("/prompt/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: text }),
      });

      const response = await fetch(buildApiUrl("/route/"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (!data?.routes) {
        pushAssistantMessage("I could not generate a route yet. Try adding mood, budget, or walking preference.");
        return;
      }

      const intermediates: RouteWaypoint[] = (data.routes.intermediates || []).map((waypoint: any) => ({
        lat: waypoint.lat,
        lng: waypoint.lng,
        placeInfo: {
          name: waypoint.name,
          address: waypoint.formatted_address,
          rating: waypoint.rating,
          price_level: waypoint.price_level,
          photo_url: waypoint.photo_url,
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
      pushAssistantMessage("Route ready. Open the map tab to inspect stops and tap markers for details.");
      setSuggestedPrompts(pickPrompts());
    } catch {
      pushAssistantMessage("Connection error. Please try again in a moment.");
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = userMessage;
    setUserMessage("");
    await sendMessage(text);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-600">Trip Planner</p>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold text-slate-950">Hi, {username}</h1>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">User</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => navigate("/profile")}>
                <User className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-2xl" onClick={onLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="rounded-3xl border-none bg-slate-950 p-4 text-white shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Planner state</p>
              <p className="mt-2 text-2xl font-semibold">{loading ? "Working" : routeData.length ? "Ready" : "Idle"}</p>
              <p className="mt-1 text-sm text-slate-300">Send a prompt and the route will appear here.</p>
            </Card>
            <Card className="rounded-3xl border-none bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current route</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{routeStops || 0}</p>
              <p className="mt-1 text-sm text-slate-500">Stops including origin and destination.</p>
            </Card>
            <Card className="rounded-3xl border-none bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Maps</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{apiKey ? "Ready" : "Loading"}</p>
              <p className="mt-1 text-sm text-slate-500">Backend key fallback stays intact in production.</p>
            </Card>
          </div>

          <div className="mb-4 flex rounded-3xl bg-white p-1 shadow-sm lg:hidden">
            <button
              type="button"
              onClick={() => setActiveView("planner")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-medium transition ${
                activeView === "planner" ? "bg-slate-950 text-white" : "text-slate-500"
              }`}
            >
              <MessageSquareText className="h-4 w-4" />
              Planner
            </button>
            <button
              type="button"
              onClick={() => setActiveView("map")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-medium transition ${
                activeView === "map" ? "bg-slate-950 text-white" : "text-slate-500"
              }`}
            >
              <Map className="h-4 w-4" />
              Map
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <section className={`${activeView === "planner" ? "block" : "hidden"} space-y-4 lg:block`}>
              <Card className="rounded-[2rem] border-none bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Describe your day</p>
                    <p className="mt-1 text-sm text-slate-500">Be specific about pace, vibe, budget, or must-see places.</p>
                  </div>
                  <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 sm:flex">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>

                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {suggestedPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => sendMessage(prompt)}
                      className="h-auto shrink-0 whitespace-normal rounded-2xl px-3 py-2 text-left text-xs leading-5"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <textarea
                    value={userMessage}
                    onChange={(event) => setUserMessage(event.target.value)}
                    placeholder="Plan a half-day route in Sochi with coffee, sea views, and one museum."
                    className="min-h-[120px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                    disabled={loading}
                  />
                  <Button type="submit" disabled={loading || !userMessage.trim()} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                    <Send className="mr-2 h-4 w-4" />
                    {loading ? "Planning route..." : "Generate route"}
                  </Button>
                </form>
              </Card>

              <Card className="rounded-[2rem] border-none bg-white p-0 shadow-sm">
                <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
                  <p className="text-sm font-semibold text-slate-950">Conversation</p>
                  <p className="mt-1 text-sm text-slate-500">Prompt history stays compact on mobile and expands naturally on desktop.</p>
                </div>
                <ScrollArea className="h-[28rem] sm:h-[32rem]">
                  <div className="space-y-3 px-4 py-4 sm:px-5">
                    {!messages.length && !loading && (
                      <div className="rounded-3xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
                        Start with a simple request. For example: “Create a relaxed Sochi evening with a promenade walk and dinner.”
                      </div>
                    )}

                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[90%] rounded-[1.5rem] px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${
                            message.isUser ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}

                    {loading && <div className="rounded-[1.5rem] bg-cyan-50 px-4 py-3 text-sm text-cyan-700">Planning your route now...</div>}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </Card>
            </section>

            <section className={`${activeView === "map" ? "block" : "hidden"} lg:block`}>
              <Card className="flex min-h-[32rem] flex-col overflow-hidden rounded-[2rem] border-none bg-white shadow-sm lg:min-h-[calc(100vh-15rem)]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Map preview</p>
                    <p className="mt-1 text-sm text-slate-500">Tap markers to inspect individual places.</p>
                  </div>
                  <MapPin className="h-5 w-5 text-cyan-600" />
                </div>

                <div className="flex-1 bg-slate-50">
                  {apiKey ? (
                    <GoogleMap apiKey={apiKey} routeData={routeData} />
                  ) : (
                    <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center text-sm text-slate-500">Loading map services...</div>
                  )}
                </div>
              </Card>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
