import { useState, useEffect, useRef } from "react";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Check, MapPin, Pencil, Send, Trash2, LogOut, UserPlus } from "lucide-react";
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

// Функция для случайного выбора N промптов
const getRandomPrompts = (prompts: string[], count: number = 3) => {
  const shuffled = [...prompts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export function ChatFrame({ onLogout, onLogin, onSignup, onPartnerLogin }: ChatFrameProps) {
  const { language, copy } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(true);
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
        console.error("Failed to load Yandex Maps API key:", error);
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

  const generateRoute = async () => {
    const pendingMessages = messages.filter((message) => message.isUser && !message.isSent);

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

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "затычка",
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
    const text = userMessage;
    setUserMessage("");
    addUserMessage(text);
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

      setShowChat(true);
      toast.success(copy.chat.routePointAdded);
      addUserMessage(`Добавь в маршрут точку: ${address}.`);
    };

    window.addEventListener("map-add-to-route", handleAddToRoute);

    return () => {
      window.removeEventListener("map-add-to-route", handleAddToRoute);
    };
  }, [copy.chat.routePointAdded]);

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
                      <p className="text-sm">{m.text}</p>
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

          {/* Suggested prompts */}
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => addUserMessage(prompt)}
                className="text-xs whitespace-normal max-w-full"
              >
                {prompt}
              </Button>
            ))}
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
            <YandexMap apiKey={apiKey} />
          ) : (
            <div className="h-full flex items-center justify-center">{copy.chat.mapLoading}</div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
