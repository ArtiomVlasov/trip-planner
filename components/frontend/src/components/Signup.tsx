import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, MapPin, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

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

const preferredTypes = [
  "Museums & Culture",
  "Entertainment & Leisure",
  "Nature & Outdoors",
  "Nightlife & Bars",
  "Restaurants – Fine dining",
  "Restaurants – Casual dining",
  "Coffee & Sweets",
  "Food on the Go",
  "Wellness & Relaxation",
  "Sports & Active leisure",
  "Shopping – Essentials",
  "Shopping – Lifestyle & Malls",
  "Events & Venues",
  "Hotels & Accommodation",
];

const transportModes = ["DRIVING", "WALKING", "BICYCLING", "TRANSIT"];

const budgetLevels = [
  { value: "1", label: "1 · Very low" },
  { value: "2", label: "2 · Low" },
  { value: "3", label: "3 · Moderate" },
  { value: "4", label: "4 · High" },
  { value: "5", label: "5 · Premium" },
];

const toBackendTransportMode = (mode: string) => {
  switch (mode) {
    case "DRIVING":
      return "DRIVE";
    case "WALKING":
      return "WALK";
    case "BICYCLING":
      return "BICYCLE";
    default:
      return "TRANSIT";
  }
};

const timeStringToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 100 + minutes;
};

export function Signup({ onBack, onSuccess }: SignupProps) {
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
    transportMode: "DRIVING",
    availabilityStartTime: "09:00",
    availabilityEndTime: "18:00",
  });

  const handleNext = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Please fill in all basic fields");
      return;
    }

    if (!formData.email.includes("@") || !formData.email.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setStep(2);
  };

  const togglePreferredType = (type: string) => {
    setFormData((state) => ({
      ...state,
      preferredTypes: state.preferredTypes.includes(type)
        ? state.preferredTypes.filter((item) => item !== type)
        : [...state.preferredTypes, type],
    }));
  };

  const handleSubmit = async () => {
    if (!formData.preferredTypes.length) {
      toast.error("Choose at least one preferred type");
      return;
    }

    setLoading(true);

    const payload = {
      username: formData.name,
      email: formData.email,
      password: formData.password,
      accountType: "user",
      partner: null,
      preferences: {
        maxWalkingDistanceMeters: formData.maxWalkingDistanceMeters,
        budgetLevel: Number(formData.budgetLevel),
        ratingThreshold: Number(formData.ratingThreshold),
        likesBreakfastOutside: formData.likesBreakfastOutside,
        transportMode: toBackendTransportMode(formData.transportMode),
      },
      startingPoint: {
        name: "Home",
        location: {
          latitude: 43.585472,
          longitude: 39.723098,
        },
        city: "Sochi",
        country: "Russia",
      },
      availability: {
        startTime: timeStringToMinutes(formData.availabilityStartTime),
        endTime: timeStringToMinutes(formData.availabilityEndTime),
      },
      preferredTypes: formData.preferredTypes,
    };

    try {
      const response = await fetch(buildApiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        toast.error("Registration failed. Please try again.");
        return;
      }

      const data = await response.json();
      if (data?.token) {
        localStorage.setItem("token", data.token);
      }
      localStorage.setItem("username", formData.name);
      localStorage.setItem("accountType", "user");
      toast.success("Account created successfully");
      onSuccess();
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/75 backdrop-blur sm:items-center sm:justify-center">
      <div className="absolute inset-0" onClick={onBack} />
      <Card className="relative z-10 w-full rounded-t-[2rem] border-none bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-[2rem] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={step === 1 ? onBack : () => setStep(1)} className="-ml-2 rounded-xl px-2 text-slate-500 hover:text-slate-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "Back" : "Preferences"}
          </Button>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Step {step} of 2
          </Badge>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Create your account</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {step === 1 ? "Start with the essentials." : "Now shape how the planner should build your day."}
            </p>
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={(event) => setFormData((state) => ({ ...state, name: event.target.value }))} placeholder="Kirill" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(event) => setFormData((state) => ({ ...state, email: event.target.value }))} placeholder="name@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={formData.password} onChange={(event) => setFormData((state) => ({ ...state, password: event.target.value }))} placeholder="At least 8 characters" />
            </div>
            <Button onClick={handleNext} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Max walking distance</Label>
                <Input
                  type="number"
                  min="100"
                  max="5000"
                  value={formData.maxWalkingDistanceMeters}
                  onChange={(event) => setFormData((state) => ({ ...state, maxWalkingDistanceMeters: Number(event.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Budget</Label>
                <Select value={formData.budgetLevel} onValueChange={(value) => setFormData((state) => ({ ...state, budgetLevel: value }))}>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rating threshold</Label>
                <Select value={formData.ratingThreshold} onValueChange={(value) => setFormData((state) => ({ ...state, ratingThreshold: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["3.0", "3.5", "4.0", "4.5"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}+ stars
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transport mode</Label>
                <Select value={formData.transportMode} onValueChange={(value) => setFormData((state) => ({ ...state, transportMode: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {transportModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Available from</Label>
                <Input type="time" value={formData.availabilityStartTime} onChange={(event) => setFormData((state) => ({ ...state, availabilityStartTime: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Available until</Label>
                <Input type="time" value={formData.availabilityEndTime} onChange={(event) => setFormData((state) => ({ ...state, availabilityEndTime: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
                <MapPin className="h-4 w-4 text-cyan-600" />
                Preferred place types
              </div>
              <div className="flex flex-wrap gap-2">
                {preferredTypes.map((type) => {
                  const isSelected = formData.preferredTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePreferredType(type)}
                      className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={formData.likesBreakfastOutside}
                onChange={(event) => setFormData((state) => ({ ...state, likesBreakfastOutside: event.target.checked }))}
              />
              I like having breakfast outside.
            </label>

            <Button onClick={handleSubmit} disabled={loading} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
              {loading ? "Creating account..." : "Finish setup"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
