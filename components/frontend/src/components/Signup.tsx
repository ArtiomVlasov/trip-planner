import { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";

interface SignupProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
}

export function Signup({ onBack, onSuccess }: SignupProps) {
  const { copy } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
  });

  const validateEmail = (email: string) => {
    return email.includes("@") && email.includes(".");
  };

  const validatePassword = (password: string) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*.]/.test(password)
    );
  };

  const getErrorMessage = async (res: Response) => {
    const fieldLabels: Record<string, string> = {
      username: copy.signup.nameLabel,
      email: copy.signup.emailLabel,
      password: copy.signup.passwordLabel,
    };

    const formatDetailMessage = (detail: string) => {
      const normalized = detail.toLowerCase();

      if (
        normalized.includes("email") &&
        (normalized.includes("exist") ||
          normalized.includes("taken") ||
          normalized.includes("already"))
      ) {
        return copy.signup.duplicateEmail;
      }

      if (
        normalized.includes("username") &&
        (normalized.includes("exist") ||
          normalized.includes("taken") ||
          normalized.includes("already"))
      ) {
        return copy.signup.duplicateUsername;
      }

      return detail;
    };

    const formatValidationIssue = (issue: { loc?: Array<string | number>; msg?: string }) => {
      const path = (issue.loc ?? [])
        .filter((part) => part !== "body")
        .map(String);
      const fieldPath = path.join(".");
      const fieldLabel =
        fieldLabels[fieldPath] ?? fieldLabels[path[path.length - 1] ?? ""] ?? "";
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
      if (fieldPath.startsWith("startingPoint")) {
        return copy.signup.invalidStartingPointServer;
      }
      if (message.includes("field required")) {
        return fieldLabel
          ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.`
          : copy.signup.genericValidationError;
      }
      if (message.includes("input should be")) {
        return fieldLabel
          ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.`
          : copy.signup.genericValidationError;
      }

      return fieldLabel
        ? `${copy.signup.invalidFieldPrefix}: ${fieldLabel}.`
        : copy.signup.genericValidationError;
    };

    try {
      const data = await res.json();
      const detail = data?.detail;

      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => formatValidationIssue(item))
          .filter(Boolean);

        return messages.length
          ? [...new Set(messages)].join(" ")
          : copy.signup.genericValidationError;
      }

      if (typeof detail === "string" && detail.trim()) {
        return formatDetailMessage(detail);
      }
    } catch {
      return copy.signup.failed;
    }

    return copy.signup.failed;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(copy.signup.invalidNameServer);
      return;
    }
    if (!formData.email.trim()) {
      toast.error(copy.signup.invalidEmailServer);
      return;
    }
    if (!formData.password) {
      toast.error(copy.signup.invalidPasswordServer);
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

    setLoading(true);

    try {
      const payload = {
        username: formData.name,
        email: formData.email,
        password: formData.password,
        accountType: "user",
        partner: null,
      };

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
        toast.success(copy.signup.success);
        onSuccess();
      } else {
        toast.error(await getErrorMessage(res));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : copy.signup.connectionError;
      toast.error(message);
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-primary/20 backdrop-blur-sm" onClick={onBack} />
      <div className="relative z-50 flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 p-4 sm:p-6">
        <div className="max-h-[90vh] w-full max-w-2xl animate-in overflow-hidden rounded-xl bg-white shadow-2xl slide-in-from-bottom-10 fade-in duration-500">
          <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={onBack}
                variant="ghost"
                className="justify-start px-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {copy.signup.backHome}
              </Button>
              <LanguageToggle className="self-start" />
            </div>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{copy.signup.title}</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">{copy.signup.nameLabel}</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                  }
                  required
                  placeholder={copy.signup.passwordPlaceholder}
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full"
                variant="hero"
                disabled={loading}
              >
                {loading ? copy.signup.creatingAccount : copy.signup.createAccount}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
