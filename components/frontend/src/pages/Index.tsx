import { useState, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import { PartnerAccess } from "@/components/PartnerAccess";
import Chat from "./Chat";

type ModalState = "none" | "login" | "signup" | "partner";

const Index = () => {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [isAuth, setIsAuth] = useState<boolean>(Boolean(localStorage.getItem("token")));

  // Открытие модальных окон
  const handleLogin = () => setModalState("login");
  const handleSignup = () => setModalState("signup");
  const handlePartner = () => setModalState("partner");
  const handleCloseModal = () => setModalState("none");

  // После успешной авторизации
  const handleAuthSuccess = () => {
    setModalState("none");
    setIsAuth(true);
  };

  // Выход из чата
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuth(false);
  };

  // Подписка на глобальные события открытия модалок
  useEffect(() => {
    const openLogin = () => setModalState("login");
    const openSignup = () => setModalState("signup");
    const openPartner = () => setModalState("partner");

    window.addEventListener("open-login", openLogin);
    window.addEventListener("open-signup", openSignup);
    window.addEventListener("open-partner", openPartner);

    return () => {
      window.removeEventListener("open-login", openLogin);
      window.removeEventListener("open-signup", openSignup);
      window.removeEventListener("open-partner", openPartner);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Показываем Hero только если пользователь не авторизован */}
      {!isAuth && (
        <Hero onLogin={handleLogin} onSignup={handleSignup} onPartner={handlePartner} />
      )}

      {/* Чат доступен всегда */}
      <Chat onLogout={handleLogout} />

      {modalState === "login" && (
        <Login onBack={handleCloseModal} onSuccess={handleAuthSuccess} />
      )}
      {modalState === "signup" && (
        <Signup onBack={handleCloseModal} onSuccess={handleAuthSuccess} />
      )}
      {modalState === "partner" && (
        <PartnerAccess onBack={handleCloseModal} onLogin={handleLogin} />
      )}
    </div>
  );
};

export default Index;
