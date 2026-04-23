import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Hero } from "@/components/Hero";
import { Login } from "@/components/Login";
import { PartnerAccess } from "@/components/PartnerAccess";
import { Signup } from "@/components/Signup";

type ModalState = "none" | "login" | "signup" | "partner-access" | "partner-login";

const Index = () => {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [isAuth, setIsAuth] = useState<boolean>(Boolean(localStorage.getItem("token")));
  const navigate = useNavigate();
  const accountType = localStorage.getItem("accountType");

  // Открытие модальных окон
  const handleLogin = () => setModalState("login");
  const handleSignup = () => setModalState("signup");
  const handlePartnerLogin = () => setModalState("partner-access");
  const handleCloseModal = () => setModalState("none");

  // После успешной авторизации
  const handleAuthSuccess = () => {
    setModalState("none");
    setIsAuth(true);
    navigate("/planner");
  };

  // Выход из чата
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    setIsAuth(false);
  };

  // Подписка на глобальные события открытия модалок
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
      <Hero
        isAuth={isAuth}
        isPartner={accountType === "partner"}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onPartnerLogin={handlePartnerLogin}
        onOpenPlanner={() => navigate("/planner")}
        onLogout={handleLogout}
      />

      {/* Модальные окна логина/регистрации */}
      {modalState !== "none" && (
        <div className="modal-overlay">
          <div className="modal-content">
            {modalState === "login" ? (
              <Login onBack={handleCloseModal} onSuccess={handleAuthSuccess} mode="user" />
            ) : modalState === "partner-access" ? (
              <PartnerAccess
                onBack={handleCloseModal}
                onLogin={() => setModalState("partner-login")}
              />
            ) : modalState === "partner-login" ? (
              <Login
                onBack={() => setModalState("partner-access")}
                onSuccess={handleAuthSuccess}
                mode="partner"
              />
            ) : (
              <Signup onBack={handleCloseModal} onSuccess={handleAuthSuccess} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
