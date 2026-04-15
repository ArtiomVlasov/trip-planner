import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Compass, LogIn, Map, Route, ShieldCheck, Sparkles, Store, Users } from "lucide-react";

interface HeroProps {
  onLogin: () => void;
  onSignup: () => void;
  onPartnerLogin: () => void;
}

const highlights = [
  { title: "Mobile-first planner", text: "Create routes, review stops, and tweak preferences from one thumb-friendly flow.", icon: Route },
  { title: "Live map context", text: "Watch the route appear on the map as soon as the backend finishes planning.", icon: Map },
  { title: "Partner-ready", text: "Partners can sign in separately and manage promoted places without touching the user flow.", icon: Store },
];

const steps = [
  "Describe the kind of day you want",
  "Get a generated route with stops",
  "Open profile and tune your travel preferences",
];

export function Hero({ onLogin, onSignup, onPartnerLogin }: HeroProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 mb-6 border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-cyan-300">Trip Planner</p>
                <p className="text-xs text-slate-400">AI itinerary assistant</p>
              </div>
            </div>
            <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onLogin}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
          <section className="space-y-6">
            <Badge className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-200 hover:bg-cyan-400/15">Mobile-first redesign</Badge>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Plan city days that feel effortless on a phone.
              </h1>
              <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Trip Planner turns a simple prompt into a route, keeps the map close, and gives travelers or partners a cleaner mobile experience from the first screen.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="h-12 rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={onSignup}>
                <Sparkles className="mr-2 h-4 w-4" />
                Create account
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={onPartnerLogin}>
                <Store className="mr-2 h-4 w-4" />
                Partner sign in
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map(({ title, text, icon: Icon }) => (
                <Card key={title} className="rounded-3xl border-white/10 bg-white/5 p-4 text-slate-50 shadow-none backdrop-blur">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mb-2 text-base font-semibold">{title}</h2>
                  <p className="text-sm leading-6 text-slate-300">{text}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-slate-900 p-4 shadow-[0_24px_80px_rgba(8,47,73,0.35)] sm:p-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-4">
                <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Route ready
                  </span>
                  <span>08:42</span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-3xl bg-cyan-400/10 p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-200">Prompt</p>
                    <p className="text-sm leading-6 text-slate-100">Build a walkable day in Sochi with sea views, coffee, and one cultural stop.</p>
                  </div>

                  <div className="rounded-3xl bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Generated plan</p>
                        <p className="text-xs text-slate-400">3 stops, 1 map, 1 profile</p>
                      </div>
                      <Users className="h-4 w-4 text-cyan-200" />
                    </div>
                    <div className="space-y-2 text-sm text-slate-300">
                      {steps.map((step, index) => (
                        <div key={step} className="flex items-start gap-3 rounded-2xl bg-white/5 px-3 py-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-200">
                            {index + 1}
                          </div>
                          <p className="leading-5">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    API traffic stays behind the reverse proxy, while the UI stays comfortable on narrow screens.
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
