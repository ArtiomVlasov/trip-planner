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
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem("token");

  // Get Google Maps API key
  useEffect(() => {
    fetch('http://43.245.224.126:8000/api/maps-key')
      .then((res) => res.json())
      .then((data) => setApiKey(data.apiKey))
      .catch(() => toast.error("Failed to load maps"));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim()) return;

    const messageId = Date.now().toString();
    const newMessage: Message = {
      id: messageId,
      text: userMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setLoading(true);
    setUserMessage("");

    try {
      await fetch('http://43.245.224.126:8000/prompt/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ prompt: userMessage }),
      });

      const response = await fetch('http://43.245.224.126:8000/route/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn('No routes in response');
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "I couldn't generate a route for that request. Please try with a different destination or be more specific about your travel plans.",
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        return;
      }

      const route = data;

      setRouteData([{
        origin: route.routes.origin,
        destination: route.routes.destination,
        intermediates: route.routes.intermediates,
        polyline: route.routes.polyline, 
        optimizedOrder: route.routes.optimizedOrder,
      }]);
      setExpanded(prev => ({ ...prev, [messageId]: true }));

      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I've planned your route! Check out the map below to see your personalized itinerary.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      console.error('Error communicating with server:', err);
      toast.error("Failed to process your request. Please try again.");

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting to the server. Please check your connection and try again.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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
          <Button onClick={onLogout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex-1 container mx-auto p-4 grid lg:grid-cols-2 gap-6">
        {/* Chat Section */}
        <div className="flex flex-col h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 && (
              <Card className="p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Welcome to your AI Trip Planner!</h3>
                <p className="text-muted-foreground">
                  Tell me where you'd like to go and I'll help plan your perfect trip.
                  For example: "Plan a day trip to Paris with museums and restaurants"
                </p>
              </Card>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <Card className={`max-w-[80%] p-3 ${message.isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
                  }`}>
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-xs mt-1 opacity-70`}>
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </Card>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <Card className="max-w-[80%] p-3 bg-muted">
                  <p className="text-sm">Planning your trip...</p>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Describe your trip plans..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !userMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Map Section */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {apiKey ? (
            <GoogleMap
              apiKey={apiKey}
              routeData={routeData}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Loading map...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}