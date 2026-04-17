import { useEffect, useState } from "react";

import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import Chat from "./Chat";
import { PartnerPlacesPage } from "./PartnerPlacesPage";

type ModalState = "none" | "login" | "signup" | "partner-login";

export function PlannerPage() {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [isAuth, setIsAuth] = useState<boolean>(Boolean(localStorage.getItem("token")));
  const accountType = localStorage.getItem("accountType");

  const handleLogin = () => setModalState("login");
  const handleSignup = () => setModalState("signup");
  const handlePartnerLogin = () => setModalState("partner-login");
  const handleCloseModal = () => setModalState("none");

  const handleAuthSuccess = () => {
    setModalState("none");
    setIsAuth(Boolean(localStorage.getItem("token")));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    setIsAuth(false);
  };

  useEffect(() => {
    const openLogin = () => setModalState("login");
    const openSignup = () => setModalState("signup");

    window.addEventListener("open-login", openLogin);
    window.addEventListener("open-signup", openSignup);

    return () => {
      window.removeEventListener("open-login", openLogin);
      window.removeEventListener("open-signup", openSignup);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      {isAuth && accountType === "partner" ? (
        <PartnerPlacesPage onLogout={handleLogout} />
      ) : (
        <Chat
          onLogout={handleLogout}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onPartnerLogin={handlePartnerLogin}
        />
      )}

      {modalState !== "none" && (
        <div className="modal-overlay">
          <div className="modal-content">
            {modalState === "login" ? (
              <Login onBack={handleCloseModal} onSuccess={handleAuthSuccess} mode="user" />
            ) : modalState === "partner-login" ? (
              <Login onBack={handleCloseModal} onSuccess={handleAuthSuccess} mode="partner" />
            ) : (
              <Signup onBack={handleCloseModal} onSuccess={handleAuthSuccess} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
