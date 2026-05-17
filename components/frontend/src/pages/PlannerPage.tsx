import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import Chat from "./Chat";

type ModalState = "none" | "login" | "signup" | "partner-login";
type AuthIntent = "none" | "save-route";

export function PlannerPage() {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [isAuth, setIsAuth] = useState<boolean>(Boolean(localStorage.getItem("token")));
  const [authIntent, setAuthIntent] = useState<AuthIntent>("none");
  const accountType = localStorage.getItem("accountType");

  const handleLogin = (options?: { intent?: Exclude<AuthIntent, "none"> }) => {
    setAuthIntent(options?.intent ?? "none");
    setModalState("login");
  };
  const handleSignup = (options?: { intent?: Exclude<AuthIntent, "none"> }) => {
    setAuthIntent(options?.intent ?? "none");
    setModalState("signup");
  };
  const handlePartnerLogin = () => {
    setAuthIntent("none");
    setModalState("partner-login");
  };
  const handleCloseModal = () => {
    setAuthIntent("none");
    setModalState("none");
  };

  const handleAuthSuccess = () => {
    setModalState("none");
    setIsAuth(Boolean(localStorage.getItem("token")));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    setAuthIntent("none");
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
        <Navigate to="/partner/places" replace />
      ) : (
        <Chat
          onLogout={handleLogout}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onPartnerLogin={handlePartnerLogin}
          authIntent={authIntent}
          onAuthIntentHandled={() => setAuthIntent("none")}
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
