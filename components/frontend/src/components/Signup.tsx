import { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserPlus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";
import {
  BUDGET_LEVELS,
  PREFERRED_PLACE_TYPES,
  RATING_THRESHOLDS,
  TRANSPORT_MODES,
} from "@/lib/travel-preferences";

interface SignupProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  maxWalkingDistanceMeters: number;
  preferredTypes: string[];
  budgetLevel: string;
  ratingThreshold: string;
  likesBreakfastOutside: boolean;
  transportMode: string;
  availabilityStartTime: string;
  availabilityEndTime: string;
}

export function Signup({ onBack, onSuccess }: SignupProps) {
  const { language, copy } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    maxWalkingDistanceMeters: 1000,
    preferredTypes: [],
    budgetLevel: "3",
    ratingThreshold: "4.0",
    likesBreakfastOutside: false,
    transportMode: "DRIVE",
    availabilityStartTime: "09:00",
    availabilityEndTime: "18:00"
  });

  const getOptionLabel = (
    option: { label?: string; labels?: Record<"ru" | "en", string> },
    fallback = ""
  ) => option.labels?.[language] ?? option.label ?? fallback;

  const budgetLevels = BUDGET_LEVELS.map((level) => ({
    value: level.value,
    label: getOptionLabel(level, String(level.value)),
  }));

  const transportModes = TRANSPORT_MODES.map((mode) => ({
    value: mode.value,
    label: getOptionLabel(mode, String(mode.value)),
  }));

  const ratingThresholds = RATING_THRESHOLDS.map((rating) => ({
    value: rating.value,
    label: getOptionLabel(rating, String(rating.value)),
  }));

  const preferredTypeOptions = PREFERRED_PLACE_TYPES.map((type) => ({
    value: type.value,
    label: getOptionLabel(type, String(type.value)),
  }));

  const validateEmail = (email: string) => {
    return email.includes('@') && email.includes('.');
  };

  const validatePassword = (password: string) => {
    return password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*.]/.test(password);
  };

  const getErrorMessage = async (res: Response) => {
    const fieldLabels: Record<string, string> = {
      username: copy.signup.nameLabel,
      email: copy.signup.emailLabel,
      password: copy.signup.passwordLabel,
      "preferences.maxWalkingDistanceMeters": copy.signup.maxWalkingDistanceLabel,
      "preferences.budgetLevel": copy.signup.budgetLevelLabel,
      "preferences.ratingThreshold": copy.signup.ratingThresholdLabel,
      "preferences.likesBreakfastOutside": copy.signup.breakfastLabel,
      "preferences.transportMode": copy.signup.transportModeLabel,
      "availability.startTime": copy.signup.availableFromLabel,
      "availability.endTime": copy.signup.availableUntilLabel,
      preferredTypes: copy.signup.preferredTypesLabel,
    };

    const formatDetailMessage = (detail: string) => {
      const normalized = detail.toLowerCase();

      if (normalized.includes("email") && (normalized.includes("exist") || normalized.includes("taken") || normalized.includes("already"))) {
        return copy.signup.duplicateEmail;
      }

      if (normalized.includes("username") && (normalized.includes("exist") || normalized.includes("taken") || normalized.includes("already"))) {
        return copy.signup.duplicateUsername;
      }

      return detail;
    };

    const formatValidationIssue = (issue: { loc?: Array<string | number>; msg?: string }) => {
      const path = (issue.loc ?? [])
        .filter((part) => part !== "body")
        .map(String);
      const fieldPath = path.join(".");
      const fieldLabel = fieldLabels[fieldPath] ?? fieldLabels[path[path.length - 1] ?? ""] ?? "";
      const message = (issue.msg ?? "").toLowerCase();

      if (fieldPath === "email" || message.includes("valid email")) {
        return copy.signup.invalidEmailServer;
      }
      if (fieldPath === "username") {
        return copy.signup.invalidNameServer;
      }
      if (fieldPath === "password") {
        return copy.signup.invalidPasswordServer;
      }
      if (fieldPath === "preferences.transportMode") {
        return copy.signup.invalidTransportModeServer;
      }
      if (fieldPath === "preferences.budgetLevel") {
        return copy.signup.invalidBudgetLevelServer;
      }
      if (fieldPath === "preferences.ratingThreshold") {
        return copy.signup.invalidRatingThresholdServer;
      }
      if (fieldPath === "preferredTypes") {
        return copy.signup.invalidPreferredTypesServer;
      }
      if (fieldPath === "availability.startTime" || fieldPath === "availability.endTime") {
        return copy.signup.invalidAvailabilityServer;
      }
      if (fieldPath.startsWith("startingPoint")) {
        return copy.signup.invalidStartingPointServer;
      }
      if (message.includes("field required")) {
        return fieldLabel ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.` : copy.signup.genericValidationError;
      }
      if (message.includes("input should be")) {
        return fieldLabel ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.` : copy.signup.genericValidationError;
      }

      return fieldLabel ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.` : copy.signup.genericValidationError;
    };

    try {
      const data = await res.json();
      const detail = data?.detail;

      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => formatValidationIssue(item))
          .filter(Boolean);

        return messages.length ? [...new Set(messages)].join(" ") : copy.signup.genericValidationError;
      }

      if (typeof detail === "string" && detail.trim()) {
        return formatDetailMessage(detail);
      }
    } catch {
      return copy.signup.failed;
    }

    return copy.signup.failed;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        toast.error(copy.signup.fillAllFields);
        return;
      }
      if (!validateEmail(formData.email)) {
        toast.error(copy.signup.invalidEmail);
        return;
      }
      if (!validatePassword(formData.password)) {
        toast.error(copy.signup.invalidPassword);
        return;
      }
    }
    setStep(step + 1);
  };

  const handlePreferredTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      preferredTypes: prev.preferredTypes.includes(type)
        ? prev.preferredTypes.filter(t => t !== type)
        : [...prev.preferredTypes, type]
    }));
  };

  const handleSubmit = async () => {
    if (formData.preferredTypes.length === 0) {
      toast.error(copy.signup.selectPreferredType);
      return;
    }

    const payload = {
      username: formData.name,
      email: formData.email,
      password: formData.password,
      accountType: "user",
      partner: null,
      preferences: {
        maxWalkingDistanceMeters: formData.maxWalkingDistanceMeters,
        budgetLevel: parseInt(formData.budgetLevel),
        ratingThreshold: parseFloat(formData.ratingThreshold),
        likesBreakfastOutside: formData.likesBreakfastOutside,
        transportMode: formData.transportMode
      },
      startingPoint: {
        name: "Home",
        location: {
          latitude: 43.585472,
          longitude: 39.723098
        },
        city: "Sochi",
        country: "Russia"
      },
      availability: {
        startTime: timeStringToMinutes(formData.availabilityStartTime),
        endTime: timeStringToMinutes(formData.availabilityEndTime)
      },
      preferredTypes: formData.preferredTypes,
    };
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/register"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        toast.success(copy.signup.success);
        onSuccess();
      } else {
        toast.error(await getErrorMessage(res));
      }
    } catch (error) {
      toast.error(copy.signup.connectionError);
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeStringToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 100 + minutes;
  };

  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="min-h-screen bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 flex items-center justify-center p-4 sm:p-6 relative z-50">
        <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={onBack}
                variant="ghost"
                className="justify-start px-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {copy.signup.backHome}
              </Button>
              <LanguageToggle className="self-start" />
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{copy.signup.title}</h2>
              <p className="text-muted-foreground">
                {copy.signup.stepLabel} {step} {copy.signup.ofLabel} 2 -{" "}
                {step === 1 ? copy.signup.basicInformation : copy.signup.travelPreferences}
              </p>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{copy.signup.nameLabel}</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={copy.signup.namePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{copy.signup.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder={copy.signup.emailPlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{copy.signup.passwordLabel}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder={copy.signup.passwordPlaceholder}
                  />
                </div>

                <Button onClick={handleNext} className="w-full" variant="hero">
                  {copy.signup.continue}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{copy.signup.maxWalkingDistanceLabel}</Label>
                    <Input
                      type="number"
                      value={formData.maxWalkingDistanceMeters}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxWalkingDistanceMeters: parseInt(e.target.value, 10),
                        })
                      }
                      min="100"
                      max="5000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{copy.signup.budgetLevelLabel}</Label>
                    <Select
                      value={formData.budgetLevel}
                      onValueChange={(value) => setFormData({ ...formData, budgetLevel: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {budgetLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{copy.signup.ratingThresholdLabel}</Label>
                    <Select
                      value={formData.ratingThreshold}
                      onValueChange={(value) => setFormData({ ...formData, ratingThreshold: value })}
                    >
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border border-border shadow-lg z-[60]">
                        {ratingThresholds.map((rating) => (
                          <SelectItem key={rating.value} value={rating.value}>
                            {rating.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{copy.signup.transportModeLabel}</Label>
                    <Select
                      value={formData.transportMode}
                      onValueChange={(value) => setFormData({ ...formData, transportMode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transportModes.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{copy.signup.availableFromLabel}</Label>
                    <Input
                      type="time"
                      value={formData.availabilityStartTime}
                      onChange={(e) => setFormData({ ...formData, availabilityStartTime: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{copy.signup.availableUntilLabel}</Label>
                    <Input
                      type="time"
                      value={formData.availabilityEndTime}
                      onChange={(e) => setFormData({ ...formData, availabilityEndTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {copy.signup.preferredTypesLabel}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {preferredTypeOptions.map((type) => (
                      <Button
                        key={type.value}
                        type="button"
                        variant={formData.preferredTypes.includes(type.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePreferredTypeToggle(type.value)}
                        className="h-auto min-h-10 whitespace-normal text-xs"
                      >
                        {type.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="breakfast"
                    checked={formData.likesBreakfastOutside}
                    onChange={(e) =>
                      setFormData({ ...formData, likesBreakfastOutside: e.target.checked })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="breakfast">{copy.signup.breakfastLabel}</Label>
                </div>

                <div className="flex flex-col-reverse gap-4 sm:flex-row">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {copy.signup.back}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1"
                    variant="hero"
                    disabled={loading}
                  >
                    {loading ? copy.signup.creatingAccount : copy.signup.createAccount}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
