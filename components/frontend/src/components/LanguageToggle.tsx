import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageToggleProps {
  className?: string;
}

const LANGUAGE_OPTIONS = [
  { value: "ru" as const, label: "RU" },
  { value: "en" as const, label: "EN" },
];

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { language, setLanguage, copy } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm",
        className
      )}
      aria-label={copy.common.languageSwitchLabel}
      role="group"
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const isActive = language === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            className={cn(
              "min-w-[3rem] rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
