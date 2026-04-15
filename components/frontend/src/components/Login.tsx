import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, KeyRound, LogIn, Store, User } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

interface LoginProps {
  onBack: () => void;
  onSuccess: () => void;
  mode?: "user" | "partner";
}

export function Login({ onBack, onSuccess, mode = "user" }: LoginProps) {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const endpoint = mode === "partner" ? buildApiUrl("/api/v1/crm/partners/login") : buildApiUrl("/login");
      const payload = mode === "partner" ? { login: formData.username, password: formData.password } : formData;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        toast.error("Invalid credentials. Please try again.");
        return;
      }

      const data = await response.json();

      if (!data?.access_token) {
        toast.error("Login failed: no token returned");
        return;
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", mode === "partner" ? data.login || formData.username : formData.username);
      localStorage.setItem("accountType", mode);

      if (mode === "partner" && data.partner_id) {
        localStorage.setItem("partnerId", String(data.partner_id));
      }

      toast.success(mode === "partner" ? "Partner account connected" : "Welcome back");
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
      <Card className="relative z-10 w-full rounded-t-[2rem] border-none bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-[2rem] sm:p-6">
        <Button variant="ghost" onClick={onBack} className="mb-4 -ml-2 w-fit rounded-xl px-2 text-slate-500 hover:text-slate-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="mb-6 space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-50 text-cyan-600">
            {mode === "partner" ? <Store className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">{mode === "partner" ? "Partner sign in" : "Sign in"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {mode === "partner" ? "Use the credentials issued by your team." : "Continue planning routes and keep your profile in sync."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">{mode === "partner" ? "Login" : "Username"}</Label>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-100">
              <User className="h-4 w-4 text-slate-400" />
              <Input
                id="username"
                className="border-0 px-0 shadow-none focus-visible:ring-0"
                value={formData.username}
                onChange={(event) => setFormData((state) => ({ ...state, username: event.target.value }))}
                placeholder={mode === "partner" ? "partner login" : "your username"}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-100">
              <KeyRound className="h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                className="border-0 px-0 shadow-none focus-visible:ring-0"
                value={formData.password}
                onChange={(event) => setFormData((state) => ({ ...state, password: event.target.value }))}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
            {loading ? "Signing in..." : mode === "partner" ? "Open partner panel" : "Open planner"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
