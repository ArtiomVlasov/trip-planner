import { useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { buildApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    availabilityEndTime: "18:00",
  });

  const validateEmail = (email: string) => {
    return email.includes("@") && email.includes(".");
  };

  const validatePassword = (password: string) => {
    return password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*.]/.test(password);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        toast.error("Please fill in all fields");
        return;
      }
      if (!validateEmail(formData.email)) {
        toast.error("Please enter a valid email address with @ symbol");
        return;
      }
      if (!validatePassword(formData.password)) {
        toast.error("Password must be at least 8 characters with uppercase, lowercase, number and special character");
        return;
      }
    }

    setStep(step + 1);
  };

  const handlePreferredTypeToggle = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredTypes: prev.preferredTypes.includes(type)
        ? prev.preferredTypes.filter((currentType) => currentType !== type)
        : [...prev.preferredTypes, type],
    }));
  };

  const handleSubmit = async () => {
    if (formData.preferredTypes.length === 0) {
      toast.error("Please select at least one preferred type");
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
        budgetLevel: parseInt(formData.budgetLevel, 10),
        ratingThreshold: parseFloat(formData.ratingThreshold),
        likesBreakfastOutside: formData.likesBreakfastOutside,
        transportMode: formData.transportMode,
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
        startTime: timeStringToStoredNumber(formData.availabilityStartTime),
        endTime: timeStringToStoredNumber(formData.availabilityEndTime),
      },
      preferredTypes: formData.preferredTypes,
    };

    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        toast.success("Account created successfully!");
        onSuccess();
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } catch (error) {
      toast.error("Connection error. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  const timeStringToStoredNumber = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 100 + minutes;
  };

  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="min-h-screen bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 flex items-center justify-center p-6 relative z-50">
        <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
          <div className="p-6 max-h-[90vh] overflow-y-auto">
            <Button
              onClick={onBack}
              variant="ghost"
              className="mb-6 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Create Your Account</h2>
              <p className="text-muted-foreground">
                Step {step} of 2 - {step === 1 ? "Basic Information" : "Preferred Place Types"}
              </p>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="Enter your email address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Create a secure password"
                  />
                </div>

                <Button onClick={handleNext} className="w-full" variant="hero">
                  Continue to Place Types
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Preferred Place Types
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pick the places you want us to prioritize first. Budget, transport, walking
                    distance, and availability can be changed later in Settings.
                  </p>
                 
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1"
                    variant="hero"
                    disabled={loading}
                  >
                    {loading ? "Creating Account..." : "Create Account"}
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
