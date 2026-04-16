import { Button } from "@/components/ui/button";
import { Compass, MapPin, Clock, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface HeroProps {
  onLogin: () => void;
  onSignup: () => void;
  onPartnerLogin: () => void;
}

export function Hero({ onLogin, onSignup, onPartnerLogin }: HeroProps) {
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
        <header className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Compass className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">AI Trip Planner</span>
            </div>
            <div className="w-full md:w-auto flex justify-between items-center mt-4 md:mt-0">
              <Button variant="outline" onClick={onPartnerLogin} className="text-foreground hover:bg-muted">
                For Partners
              </Button>
              <div className="flex items-center gap-4 ml-4">
                <Button variant="outline" onClick={onLogin} className="border-muted-foreground/20 text-muted-foreground hover:bg-muted hover:border-muted-foreground/40 pl-4">
                  Log In
                </Button>
                <Button onClick={onSignup} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Sign Up
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <div className="text-sm text-primary font-medium mb-6">Powered by AI</div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-foreground leading-tight">
                Plan Your Perfect{" "}
                <span className="text-primary">Adventure</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Let our AI create personalized travel itineraries that match your interests, budget, and schedule. Discover amazing places you'll love.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button
                  onClick={onSignup}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8"
                >
                  Start Planning Now
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsAboutOpen(true)}
                  className="text-foreground hover:bg-muted text-lg"
                >
                  About us
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8">
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

            {/* Right Content - Illustration */}
            <div className="relative">
              <img
                src="/images/mountains/pinal-jain-x-XwnC7FgFM-unsplash.jpg"
                alt="Mountain landscape hit by sun rays"
                className="w-full max-w-lg mx-auto rounded-2xl shadow-lg"
              />
            </div>
          </div>

          {/* Features Section */}
          <section className="mt-32" ref={featuresRef}>
            <div className="text-center mb-16 scroll-fade">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                Why Choose AI Trip Planner?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Experience the future of travel planning with our intelligent system
              </p>
            </div>

            <div className="grid md:grid-cols-4 gap-8">
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
          {/* Затемнение */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAboutOpen(false)}
          />

          {/* Окно */}
          <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
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