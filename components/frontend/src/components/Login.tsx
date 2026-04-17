import { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { copy } = useLanguage();
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
        toast.error(copy.login.invalidCredentials);
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

        toast.success(mode === "partner" ? copy.login.partnerSuccess : copy.login.userSuccess);
        onSuccess();
      } else {
        toast.error(copy.login.noToken);
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(copy.login.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="min-h-screen bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 flex items-center justify-center p-4 sm:p-6 relative z-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-500">
          <div className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={onBack}
                variant="ghost"
                className="justify-start px-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {copy.login.backHome}
              </Button>
              <LanguageToggle className="self-start" />
            </div>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                {mode === "partner" ? copy.login.partnerTitle : copy.login.userTitle}
              </h2>
              <p className="text-muted-foreground">
                {mode === "partner" ? copy.login.partnerDescription : copy.login.userDescription}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{copy.login.usernameLabel}</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  placeholder={copy.login.usernamePlaceholder}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">{copy.login.passwordLabel}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder={copy.login.passwordPlaceholder}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full mt-6" 
                disabled={loading}
              >
                {loading ? copy.login.submitting : copy.login.submit}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
