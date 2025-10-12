import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserPlus, MapPin } from "lucide-react";
import { toast } from "sonner";

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

const PREFERRED_TYPES = [
  "restaurant", "museum", "park", "shopping_mall", "tourist_attraction",
  "art_gallery", "church", "night_club", "movie_theater", "spa",
  "zoo", "aquarium", "amusement_park", "casino", "gym", "library",
  "stadium", "subway_station", "hospital", "pharmacy", "gas_station",
  "bakery", "cafe", "clothing_store", "electronics_store", "jewelry_store"
];

const TRANSPORT_MODES = [
  "DRIVING", "WALKING", "BICYCLING", "TRANSIT"
];

const BUDGET_LEVELS = [
  { value: "1", label: "1 - Very Low Budget" },
  { value: "2", label: "2 - Low Budget" },
  { value: "3", label: "3 - Moderate Budget" },
  { value: "4", label: "4 - High Budget" },
  { value: "5", label: "5 - Premium Budget" }
];

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
    transportMode: "Driving",
    availabilityStartTime: "09:00",
    availabilityEndTime: "18:00"
  });

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
    setFormData(prev => ({
      ...prev,
      preferredTypes: prev.preferredTypes.includes(type)
        ? prev.preferredTypes.filter(t => t !== type)
        : [...prev.preferredTypes, type]
    }));
  };

  const handleSubmit = async () => {
    if (formData.preferredTypes.length === 0) {
      toast.error("Please select at least one preferred type");
      return;
    }
    console.log("here")

    const payload = {
      username: formData.name,
      email: formData.email,
      password: formData.password,
      preferences: {
        maxWalkingDistanceMeters: formData.maxWalkingDistanceMeters,
        preferredTypes: formData.preferredTypes,
        budgetLevel: parseInt(formData.budgetLevel),
        ratingThreshold: formData.ratingThreshold,
        likesBreakfastOutside: formData.likesBreakfastOutside,
        transportMode: mapTransportMode(formData.transportMode)
      },
      startingPoint: {
        name: "Home",
        location: {
          latitude: 55.7558,
          longitude: 37.6173
        }
      },
      availability: {
        startTime: timeStringToMinutes(formData.availabilityStartTime),
        endTime: timeStringToMinutes(formData.availabilityEndTime)
      }
    };
    setLoading(true);
    try {
      const res = await fetch('http://43.245.224.126:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapTransportMode = (mode: string) => {
    switch (mode) {
      case 'Driving': return 'DRIVE';
      case 'Walking': return 'WALK';
      case 'Bicycling': return 'BICYCLE';
      case 'Transit': return 'TRANSIT';
      default: return 'DRIVE';
    }
  };

  const timeStringToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 100 + minutes;
  };
  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="min-h-screen bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 flex items-center justify-center p-6 relative z-50">        <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
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
              Step {step} of 2 - {step === 1 ? "Basic Information" : "Travel Preferences"}
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
                Continue to Preferences
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Walking Distance (meters)</Label>
                  <Input
                    type="number"
                    value={formData.maxWalkingDistanceMeters}
                    onChange={(e) => setFormData({ ...formData, maxWalkingDistanceMeters: parseInt(e.target.value) })}
                    min="100"
                    max="5000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Budget Level</Label>
                  <Select
                    value={formData.budgetLevel}
                    onValueChange={(value) => setFormData({ ...formData, budgetLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_LEVELS.map(level => (
                        <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rating Threshold</Label>
                  <Select
                    value={formData.ratingThreshold}
                    onValueChange={(value) => setFormData({ ...formData, ratingThreshold: value })}
                  >
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select rating threshold" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border border-border shadow-lg z-[60]">
                      <SelectItem value="3.0" className="text-card-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground">3.0+ Stars</SelectItem>
                      <SelectItem value="3.5" className="text-card-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground">3.5+ Stars</SelectItem>
                      <SelectItem value="4.0" className="text-card-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground">4.0+ Stars</SelectItem>
                      <SelectItem value="4.5" className="text-card-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground">4.5+ Stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Transport Mode</Label>
                  <Select
                    value={formData.transportMode}
                    onValueChange={(value) => setFormData({ ...formData, transportMode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_MODES.map(mode => (
                        <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Available From</Label>
                  <Input
                    type="time"
                    value={formData.availabilityStartTime}
                    onChange={(e) => setFormData({ ...formData, availabilityStartTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Until</Label>
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
                  Preferred Place Types
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PREFERRED_TYPES.map(type => (
                    <Button
                      key={type}
                      type="button"
                      variant={formData.preferredTypes.includes(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePreferredTypeToggle(type)}
                      className="text-xs"
                    >
                      {type.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="breakfast"
                  checked={formData.likesBreakfastOutside}
                  onChange={(e) => setFormData({ ...formData, likesBreakfastOutside: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="breakfast">I like having breakfast outside</Label>
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