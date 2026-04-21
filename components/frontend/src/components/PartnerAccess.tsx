import { useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, FileText, LogIn, Mail } from "lucide-react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface PartnerAccessProps {
  onBack: () => void;
  onLogin: () => void;
}

type PartnerAccessStep = "choice" | "request";

const PARTNER_EMAIL = "Chxir@yandex.ru";

export function PartnerAccess({ onBack, onLogin }: PartnerAccessProps) {
  const { copy } = useLanguage();
  const [step, setStep] = useState<PartnerAccessStep>("choice");

  const mailtoHref = useMemo(
    () =>
      `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(copy.partnerAccess.emailSubject)}`,
    [copy.partnerAccess.emailSubject]
  );

  const handleBack = () => {
    if (step === "request") {
      setStep("choice");
      return;
    }

    onBack();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-primary/20 backdrop-blur-sm" onClick={handleBack} />
      <div className="relative z-50 flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/80 via-primary-glow/70 to-primary/90 p-4 sm:p-6">
        <div className="w-full max-w-3xl animate-in overflow-hidden rounded-xl bg-white shadow-2xl slide-in-from-bottom-10 fade-in duration-500">
          <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={handleBack}
                variant="ghost"
                className="justify-start px-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {step === "request" ? copy.partnerAccess.backToOptions : copy.partnerAccess.backHome}
              </Button>
              <LanguageToggle className="self-start" />
            </div>

            {step === "choice" ? (
              <>
                <div className="mx-auto mb-8 max-w-2xl text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <BriefcaseBusiness className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
                    {copy.partnerAccess.title}
                  </h2>
                  <p className="text-muted-foreground">{copy.partnerAccess.description}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-3xl border border-border bg-background p-6 text-left shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                      <LogIn className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      {copy.partnerAccess.loginTitle}
                    </h3>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      {copy.partnerAccess.loginDescription}
                    </p>
                    <Button onClick={onLogin} className="w-full">
                      {copy.partnerAccess.loginAction}
                    </Button>
                  </section>

                  <section className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-left shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      {copy.partnerAccess.requestTitle}
                    </h3>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                      {copy.partnerAccess.requestDescription}
                    </p>
                    <Button
                      onClick={() => setStep("request")}
                      variant="outline"
                      className="w-full border-primary/30 bg-white/80 hover:bg-white"
                    >
                      {copy.partnerAccess.requestAction}
                    </Button>
                  </section>
                </div>
              </>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <section className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
                  <div className="mb-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary shadow-sm">
                    {copy.partnerAccess.requestBadge}
                  </div>
                  <h2 className="mb-3 text-2xl font-bold text-foreground">
                    {copy.partnerAccess.requestDetailsTitle}
                  </h2>
                  <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                    {copy.partnerAccess.requestDetailsDescription}
                  </p>

                  <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {copy.partnerAccess.emailLabel}
                      </div>
                      <div className="overflow-x-auto pb-1 text-base font-medium text-foreground">
                        <span className="whitespace-nowrap">{PARTNER_EMAIL}</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {copy.partnerAccess.emailSubjectLabel}
                      </div>
                      <div className="text-sm text-foreground">
                        {copy.partnerAccess.emailSubject}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button asChild className="flex-1">
                      <a href={mailtoHref}>
                        <Mail className="h-4 w-4" />
                        {copy.partnerAccess.writeEmail}
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("choice")}
                      className="flex-1"
                    >
                      {copy.partnerAccess.chooseAnotherAction}
                    </Button>
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-background p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">
                        {copy.partnerAccess.checklistTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {copy.partnerAccess.checklistDescription}
                      </p>
                    </div>
                  </div>

                  <ol className="space-y-3">
                    {copy.partnerAccess.checklistItems.map((item, index) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <span className="text-sm leading-relaxed text-foreground">{item}</span>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-5 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
                    {copy.partnerAccess.note}
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
