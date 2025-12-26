import { useState, useEffect } from "react";
import { Hero } from "@/components/Hero";
import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import Chat from "./Chat";

type ModalState = "none" | "login" | "signup";

const Index = () => {
  const [modalState, setModalState] = useState<ModalState>("none");
  const [isAuth, setIsAuth] = useState<boolean>(Boolean(localStorage.getItem("token")));

  // Открытие модальных окон
  const handleLogin = () => setModalState("login");
  const handleSignup = () => setModalState("signup");
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

    window.addEventListener("open-login", openLogin);
    window.addEventListener("open-signup", openSignup);

    return () => {
      window.removeEventListener("open-login", openLogin);
      window.removeEventListener("open-signup", openSignup);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Показываем Hero только если пользователь не авторизован */}
      {!isAuth && <Hero onLogin={handleLogin} onSignup={handleSignup} />}

      {/* Чат доступен всегда */}
      <Chat onLogout={handleLogout} />

      {/* Модальные окна логина/регистрации */}
      {modalState !== "none" && (
        <div className="modal-overlay">
          <div className="modal-content">
            {modalState === "login" ? (
              <Login onBack={handleCloseModal} onSuccess={handleAuthSuccess} />
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