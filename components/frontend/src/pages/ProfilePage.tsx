import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildApiUrl } from "@/lib/api";

interface ProfileData {
  username: string;
  email: string;
}

export function ProfilePage() {
  const { copy } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
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

        setProfile(data);
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
    </div>
  );
}
