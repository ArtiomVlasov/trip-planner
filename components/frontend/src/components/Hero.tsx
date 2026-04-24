import { Button } from "@/components/ui/button";
import { AppSidebarMenu } from "@/components/AppSidebarMenu";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { Compass, MapPin, Clock, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface HeroProps {
  isAuth: boolean;
  isPartner?: boolean;
  onLogin: () => void;
  onSignup: () => void;
  onPartnerLogin: () => void;
  onOpenPlanner: () => void;
  onLogout: () => void;
}

export function Hero({
  isAuth,
  isPartner = false,
  onLogin,
  onSignup,
  onPartnerLogin,
  onOpenPlanner,
  onLogout,
}: HeroProps) {
  const featuresRef = useRef<HTMLDivElement>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const { copy } = useLanguage();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.scroll-fade');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary-glow)),transparent_50%)]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <AppSidebarMenu
                isAuth={isAuth}
                isPartner={isPartner}
                onLogin={onLogin}
                onSignup={onSignup}
                onPartnerLogin={onPartnerLogin}
                onLogout={onLogout}
              />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Compass className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground sm:text-2xl">{copy.common.brand}</span>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <LanguageToggle className="hidden shrink-0 lg:inline-flex" />
              {isAuth ? (
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:w-auto lg:items-center lg:gap-4">
                  <Button
                    onClick={onOpenPlanner}
                    className="min-w-0 w-full px-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm lg:w-auto lg:text-base"
                  >
                    {isPartner ? copy.sidebar.partnerCabinet : copy.sidebar.planner}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onLogout}
                    className="min-w-0 w-full px-2 text-xs border-muted-foreground/20 text-muted-foreground hover:bg-muted hover:border-muted-foreground/40 sm:px-4 sm:text-sm lg:w-auto lg:text-base"
                  >
                    {copy.sidebar.logout}
                  </Button>
                </div>
              ) : (
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:w-auto lg:items-center lg:gap-4">
                  <Button
                    variant="outline"
                    onClick={onPartnerLogin}
                    className="min-w-0 w-full px-2 text-xs text-foreground hover:bg-muted sm:px-4 sm:text-sm lg:w-auto lg:text-base"
                  >
                    {copy.hero.partnerButton}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onLogin}
                    className="min-w-0 w-full px-2 text-xs border-muted-foreground/20 text-muted-foreground hover:bg-muted hover:border-muted-foreground/40 sm:px-4 sm:text-sm lg:w-auto lg:text-base"
                  >
                    {copy.hero.loginButton}
                  </Button>
                  <Button
                    onClick={onSignup}
                    className="min-w-0 w-full px-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm lg:w-auto lg:text-base"
                  >
                    {copy.hero.signupButton}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <div className="text-sm text-primary font-medium mb-6">{copy.hero.aiBadge}</div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-foreground leading-tight">
                {copy.hero.titlePrefix}{" "}
                <span className="text-primary">{copy.hero.titleAccent}</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                {copy.hero.description}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button
                  onClick={onOpenPlanner}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8"
                >
                  {copy.hero.primaryAction}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsAboutOpen(true)}
                  className="text-foreground hover:bg-muted text-lg"
                >
                  {copy.hero.secondaryAction}
                </Button>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm">{copy.hero.travelersStat}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm">{copy.hero.ratingStat}</span>
                </div>
              </div>
            </div>

            {/* Right Content - Illustration */}
            <div className="relative">
              <img
                src="/images/mountains/pinal-jain-x-XwnC7FgFM-unsplash.jpg"
                alt={copy.hero.imageAlt}
                className="w-full max-w-lg mx-auto rounded-2xl shadow-lg"
              />
            </div>
          </div>

          {/* Features Section */}
          <section className="mt-20 sm:mt-24" ref={featuresRef}>
            <div className="mb-8 text-center scroll-fade sm:mb-10">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                {copy.hero.featuresTitle}
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <div className="scroll-fade rounded-2xl px-3 py-4 text-center sm:px-5 sm:py-5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 sm:h-14 sm:w-14">
                  <Compass className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground sm:text-lg">{copy.hero.smartPlanningTitle}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{copy.hero.smartPlanningDescription}</p>
              </div>

              <div className="scroll-fade rounded-2xl px-3 py-4 text-center sm:px-5 sm:py-5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 sm:h-14 sm:w-14">
                  <MapPin className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground sm:text-lg">{copy.hero.routeOptimizationTitle}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{copy.hero.routeOptimizationDescription}</p>
              </div>

              <div className="scroll-fade rounded-2xl px-3 py-4 text-center sm:px-5 sm:py-5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 sm:h-14 sm:w-14">
                  <Clock className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground sm:text-lg">{copy.hero.realtimeUpdatesTitle}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{copy.hero.realtimeUpdatesDescription}</p>
              </div>

              <div className="scroll-fade rounded-2xl px-3 py-4 text-center sm:px-5 sm:py-5">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 sm:h-14 sm:w-14">
                  <Star className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground sm:text-lg">{copy.hero.personalizedTitle}</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">{copy.hero.personalizedDescription}</p>
              </div>
            </div>
          </section>

          <section className="mt-12 scroll-fade sm:mt-14">
            <div className="rounded-[2rem] border border-border/70 bg-gradient-to-br from-primary/8 via-background to-primary-glow/10 p-8 shadow-sm sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
                <div>
                  <div className="mb-3 text-sm font-medium text-primary">{copy.sidebar.planner}</div>
                  <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                    {copy.hero.trialTitle}
                  </h2>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {copy.hero.trialDescription}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                  <Button
                    onClick={onOpenPlanner}
                    size="lg"
                    className="w-full sm:w-auto lg:min-w-[12rem]"
                  >
                    {copy.hero.trialButton}
                  </Button>
                  {!isAuth && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={onSignup}
                      className="w-full sm:w-auto lg:min-w-[12rem]"
                    >
                      {copy.hero.signupButton}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Затемнение */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAboutOpen(false)}
          />

          {/* Окно */}
          <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <Button
              onClick={() => setIsAboutOpen(false)}
              variant="ghost"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>

            <h3 className="text-2xl font-bold mb-4">
              {copy.hero.aboutTitle}
            </h3>

            <p className="text-muted-foreground text-sm leading-relaxed">
              {copy.hero.aboutDescription}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
