import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  Compass,
  Home,
  LogIn,
  LogOut,
  Menu,
  User,
  UserPlus,
} from "lucide-react";

import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface AppSidebarMenuProps {
  className?: string;
  isAuth: boolean;
  isPartner?: boolean;
  onLogin?: () => void;
  onSignup?: () => void;
  onPartnerLogin?: () => void;
  onLogout?: () => void;
}

export function AppSidebarMenu({
  className,
  isAuth,
  isPartner = false,
  onLogin,
  onSignup,
  onPartnerLogin,
  onLogout,
}: AppSidebarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { copy } = useLanguage();

  const username = useMemo(() => localStorage.getItem("username")?.trim() || "", [isAuth]);
  const canOpenProfile = isAuth && !isPartner;

  const navItems = [
    ...(!isPartner
      ? [
          {
            label: copy.sidebar.home,
            icon: Home,
            isActive: location.pathname === "/",
            onClick: () => navigate("/"),
          },
        ]
      : []),
    ...(canOpenProfile
      ? [
          {
            label: copy.sidebar.profile,
            icon: User,
            isActive: location.pathname === "/profile",
            onClick: () => navigate("/profile"),
          },
        ]
      : []),
    ...(isPartner
      ? [
          {
            label: copy.sidebar.partnerCabinet,
            icon: BriefcaseBusiness,
            isActive: location.pathname === "/",
            onClick: () => navigate("/"),
          },
        ]
      : []),
  ];

  const closeAndRun = (action?: () => void) => {
    setIsOpen(false);
    action?.();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("shrink-0 rounded-xl border border-border/70 bg-background/80", className)}
          aria-label={copy.common.menu}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="flex w-[min(22rem,calc(100vw-1rem))] flex-col gap-0 border-border/70 bg-background/95 p-0 backdrop-blur"
      >
        <SheetHeader className="border-b border-border/70 px-5 py-5 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Compass className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <SheetTitle>{copy.common.brand}</SheetTitle>
              <SheetDescription>
                {isAuth ? copy.sidebar.authDescription : copy.sidebar.guestDescription}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {copy.sidebar.navigation}
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Button
                    key={item.label}
                    variant="ghost"
                    className={cn(
                      "h-12 w-full justify-start rounded-2xl px-4 text-base",
                      item.isActive && "bg-muted text-foreground"
                    )}
                    onClick={() => closeAndRun(item.onClick)}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4 border-t border-border/70 bg-muted/30 px-4 py-4">
            <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.sidebar.language}
              </div>
              <LanguageToggle className="w-full justify-center" />
            </div>

            <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {copy.sidebar.account}
              </div>
              <p className="text-sm text-muted-foreground">
                {isAuth && username
                  ? `${copy.sidebar.signedInAs} ${username}`
                  : copy.sidebar.accountHint}
              </p>

              <div className="mt-4 grid gap-2">
                {canOpenProfile && (
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-xl"
                    onClick={() => closeAndRun(() => navigate("/profile"))}
                  >
                    <User className="mr-2 h-4 w-4" />
                    {copy.sidebar.profile}
                  </Button>
                )}

                {!isAuth && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-xl"
                      onClick={() => closeAndRun(onLogin)}
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {copy.sidebar.login}
                    </Button>

                    <Button
                      className="w-full justify-start rounded-xl"
                      onClick={() => closeAndRun(onSignup)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {copy.sidebar.signup}
                    </Button>

                    {onPartnerLogin && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start rounded-xl"
                        onClick={() => closeAndRun(onPartnerLogin)}
                      >
                        <BriefcaseBusiness className="mr-2 h-4 w-4" />
                        {copy.sidebar.partnerLogin}
                      </Button>
                    )}
                  </>
                )}

                {isAuth && onLogout && (
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-xl"
                    onClick={() => closeAndRun(onLogout)}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {copy.sidebar.logout}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
