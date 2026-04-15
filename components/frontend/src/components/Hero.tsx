import { Button } from "@/components/ui/button";
import { Compass, MapPin, Clock, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HeroProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function Hero({ onLogin, onSignup }: HeroProps) {
  const featuresRef = useRef<HTMLDivElement>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary-glow)),transparent_50%)]" />
      </div>

      <div className="relative z-10">
        <header className="container mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Compass className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground sm:text-2xl">AI Trip Planner</span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-4">
            <Button variant="ghost" onClick={onLogin} className="flex-1 text-foreground hover:bg-muted sm:flex-none">
              Log In
            </Button>
            <Button onClick={onSignup} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none">
              Sign Up
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-10 sm:px-6 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="text-sm text-primary font-medium mb-6">Powered by AI</div>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Plan Your Perfect{" "}
                <span className="text-primary">Adventure</span>
              </h1>
              <p className="mb-8 text-base leading-relaxed text-muted-foreground sm:text-xl">
                Let our AI create personalized travel itineraries that match your interests, budget, and schedule. Discover amazing places you'll love.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button
                  onClick={onSignup}
                  size="lg"
                  className="w-full bg-primary px-8 text-base text-primary-foreground hover:bg-primary/90 sm:w-auto sm:text-lg"
                >
                  Start Planning Now
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsAboutOpen(true)}
                  className="w-full text-base text-foreground hover:bg-muted sm:w-auto sm:text-lg"
                >
                  About us
                </Button>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm">10,000+ Happy Travelers</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm">4.9/5 Rating</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <img
                src="/images/mountains/pinal-jain-x-XwnC7FgFM-unsplash.jpg"
                alt="Mountain landscape hit by sun rays"
                className="mx-auto w-full max-w-sm rounded-2xl shadow-lg sm:max-w-lg"
              />
            </div>
          </div>

          <section className="mt-16 sm:mt-24 lg:mt-32" ref={featuresRef}>
            <div className="text-center mb-16 scroll-fade">
              <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
                Why Choose AI Trip Planner?
              </h2>
              <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-xl">
                Experience the future of travel planning with our intelligent system
              </p>
            </div>

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="text-center p-6 scroll-fade">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Compass className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Smart Planning</h3>
                <p className="text-muted-foreground text-sm">AI-powered itineraries tailored to your preferences</p>
              </div>

              <div className="text-center p-6 scroll-fade">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Route Optimization</h3>
                <p className="text-muted-foreground text-sm">Efficient routes that maximize your travel time</p>
              </div>

              <div className="text-center p-6 scroll-fade">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Real-time Updates</h3>
                <p className="text-muted-foreground text-sm">Live information and dynamic schedule adjustments</p>
              </div>

              <div className="text-center p-6 scroll-fade">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Personalized</h3>
                <p className="text-muted-foreground text-sm">Recommendations based on your unique travel style</p>
              </div>
            </div>
          </section>
        </main>
      </div>
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAboutOpen(false)}
          />

          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-background p-5 shadow-xl sm:p-6">
            <Button
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>

            <h3 className="text-2xl font-bold mb-4">
              About AI Trip Planner
            </h3>

            <p className="text-muted-foreground text-sm leading-relaxed">
              AI Trip Planner creates personalized itineraries using AI,
              optimizing routes, time, and preferences.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}