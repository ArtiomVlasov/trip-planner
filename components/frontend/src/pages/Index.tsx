import { useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import Chat from "./Chat";
import { PartnerPlacesPage } from "./PartnerPlacesPage";

type ModalState = "none" | "login" | "signup" | "partner-login";

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("accountType");
  localStorage.removeItem("partnerId");
};

const Index = () => {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [authVersion, setAuthVersion] = useState(0);

  const isAuth = useMemo(() => Boolean(localStorage.getItem("token")), [authVersion]);
  const accountType = useMemo(() => localStorage.getItem("accountType"), [authVersion]);

  const handleAuthSuccess = () => {
    setModalState("none");
    setAuthVersion((value) => value + 1);
  };

  const handleLogout = () => {
    clearSession();
    setAuthVersion((value) => value + 1);
  };

  if (isAuth) {
    return accountType === "partner" ? (
      <PartnerPlacesPage onLogout={handleLogout} />
    ) : (
      <Chat onLogout={handleLogout} />
    );
  }

  return (
    <>
      <Hero
        onLogin={() => setModalState("login")}
        onSignup={() => setModalState("signup")}
        onPartnerLogin={() => setModalState("partner-login")}
      />

      {modalState === "login" && <Login onBack={() => setModalState("none")} onSuccess={handleAuthSuccess} mode="user" />}
      {modalState === "partner-login" && <Login onBack={() => setModalState("none")} onSuccess={handleAuthSuccess} mode="partner" />}
      {modalState === "signup" && <Signup onBack={() => setModalState("none")} onSuccess={handleAuthSuccess} />}
    </>
  );
};

export default Index;
