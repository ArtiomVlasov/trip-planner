import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl } from "@/lib/api";
import {
  getPlaceCategoryLabel,
  PLACE_CATEGORIES,
} from "@/constants/place-categories";
import {
  getStoredPreferredTypes,
  normalizePreferredTypes,
  storePreferredTypes,
} from "@/lib/preferred-types";

interface ProfileData {
  username: string;
  email: string;
  preferred_types?: string[];
}

export function ProfilePage() {
  const { language, copy } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editPreferredTypes, setEditPreferredTypes] = useState(false);
  const [preferredTypesDraft, setPreferredTypesDraft] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    navigate("/");
  };

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setLoadFailed(false);

    fetch(buildApiUrl("/users/me"), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error();
        }
        return res.json();
      })
      .then((data) => {
        if (isCancelled) {
          return;
        }

        const storedPreferredTypes = getStoredPreferredTypes();
        const nextPreferredTypes = normalizePreferredTypes(data?.preferred_types).length
          ? normalizePreferredTypes(data?.preferred_types)
          : storedPreferredTypes;

        setProfile({
          ...data,
          preferred_types: nextPreferredTypes,
        });
        setPreferredTypesDraft(nextPreferredTypes);
        setLoadFailed(false);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setLoadFailed(true);
        toast.error(copy.profile.loadError);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [copy.profile.loadError, reloadKey, token]);

  const togglePreferredType = (type: string) => {
    setPreferredTypesDraft((current) =>
      current.includes(type)
        ? current.filter((currentType) => currentType !== type)
        : [...current, type],
    );
  };

  const handleSavePreferredTypes = async () => {
    if (preferredTypesDraft.length === 0) {
      toast.error(copy.signup.selectPreferredType);
      return;
    }

    try {
      const payload = {
        user: {
          preferred_types: preferredTypesDraft,
        },
      };

      const res = await fetch(buildApiUrl("/users/me"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error();
      }

      const normalized = normalizePreferredTypes(preferredTypesDraft);
      storePreferredTypes(normalized);
      setProfile((current) =>
        current
          ? {
              ...current,
              preferred_types: normalized,
            }
          : current,
      );
      setPreferredTypesDraft(normalized);
      setEditPreferredTypes(false);
      toast.success(copy.profile.updateSuccess);
    } catch {
      toast.error(copy.profile.updateError);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AppSidebarMenu isAuth onLogout={handleLogout} />
            <Button variant="outline" onClick={() => navigate(-1)}>
              {copy.profile.back}
            </Button>
          </div>
          <LanguageToggle className="hidden self-start sm:inline-flex" />
        </div>
        <Card className="p-6">{copy.profile.loading}</Card>
      </div>
    );
  }

  if (loadFailed || !profile) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AppSidebarMenu isAuth onLogout={handleLogout} />
            <Button variant="outline" onClick={() => navigate(-1)}>
              {copy.profile.back}
            </Button>
          </div>
          <LanguageToggle className="hidden self-start sm:inline-flex" />
        </div>
        <Card className="space-y-4 p-6">
          <p>{copy.profile.loadError}</p>
          <Button onClick={() => setReloadKey((current) => current + 1)}>
            {copy.profile.retry}
          </Button>
        </Card>
      </div>
    );
  }

  const visiblePreferredTypes = normalizePreferredTypes(profile.preferred_types);

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AppSidebarMenu isAuth onLogout={handleLogout} />
          <Button variant="outline" onClick={() => navigate(-1)}>
            {copy.profile.back}
          </Button>
        </div>
        <LanguageToggle className="hidden self-start sm:inline-flex" />
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-2xl font-bold">{copy.profile.userInfo}</h2>
        <p>
          <b>{copy.profile.username}:</b> {profile.username}
        </p>
        <p>
          <b>{copy.profile.email}:</b> {profile.email}
        </p>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{copy.profile.preferences}</h2>
          {editPreferredTypes ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                setPreferredTypesDraft(visiblePreferredTypes);
                setEditPreferredTypes(false);
              }}>
                {copy.profile.cancel}
              </Button>
              <Button size="sm" onClick={handleSavePreferredTypes}>
                {copy.profile.apply}
              </Button>
            </div>
          ) : null}
        </div>

        {editPreferredTypes ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {PLACE_CATEGORIES.map((type) => (
              <Button
                key={type.value}
                type="button"
                variant={preferredTypesDraft.includes(type.value) ? "default" : "outline"}
                size="sm"
                onClick={() => togglePreferredType(type.value)}
                className="h-auto min-h-10 whitespace-normal text-xs"
              >
                {type.labels[language]}
              </Button>
            ))}
          </div>
        ) : visiblePreferredTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visiblePreferredTypes.map((type) => (
              <span
                key={type}
                className="rounded-full border border-border bg-muted px-3 py-1 text-sm"
              >
                {getPlaceCategoryLabel(type, language)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.profile.notSpecified}</p>
        )}

        {!editPreferredTypes ? (
          <Button size="sm" className="mt-4" onClick={() => setEditPreferredTypes(true)}>
            {copy.profile.edit}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
