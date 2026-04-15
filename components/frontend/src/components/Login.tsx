import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogIn } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

interface LoginProps {
  onBack: () => void;
  onSuccess: () => void;
  mode?: "user" | "partner";
}

export function Login({ onBack, onSuccess, mode = "user" }: LoginProps) {
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "partner"
        ? buildApiUrl("/api/v1/crm/partners/login")
        : buildApiUrl("/login");

      const payload = mode === "partner"
        ? { login: formData.username, password: formData.password }
        : formData;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        toast.error("Invalid credentials. Please try again.");
        return;
      }

      const data = await res.json();

      if (data?.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", mode === "partner" ? (data.login || formData.username) : formData.username);
        localStorage.setItem("accountType", mode);
        if (mode === "partner" && data.partner_id) {
          localStorage.setItem("partnerId", String(data.partner_id));
        }

        toast.success(mode === "partner" ? "Partner login successful!" : "Login successful!");
        onSuccess();
      } else {
        toast.error("Login failed: No token returned");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="relative z-50 flex min-h-[100dvh] items-start justify-center bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 px-4 py-4 sm:items-center sm:p-6">
        <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="p-6">
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
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{mode === "partner" ? "Partner Sign In" : "Welcome Back"}</h2>
              <p className="text-muted-foreground">
                {mode === "partner" ? "Sign in with the account issued by our team" : "Sign in to continue planning your trips"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  placeholder="Enter your name"
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
                  placeholder="Enter your password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full mt-6" 
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
