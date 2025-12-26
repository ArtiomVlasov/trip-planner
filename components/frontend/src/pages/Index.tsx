import { useState, useEffect } from "react"; // ← useEffect добавили
import { Hero } from "@/components/Hero";
import { Login } from "@/components/Login";
import { Signup } from "@/components/Signup";
import Chat from "./Chat";

type AppState = "home" | "chat";
type ModalState = "none" | "login" | "signup";

const Index = () => {
  const [currentState, setCurrentState] = useState<AppState>("home");
  const [modalState, setModalState] = useState<ModalState>("none");

  const handleLogin = () => setModalState("login");
  const handleSignup = () => setModalState("signup");
  const handleCloseModal = () => setModalState("none");
  const handleAuthSuccess = () => {
    setModalState("none");
    setCurrentState("chat");
  };
  const handleLogout = () => setCurrentState("home");

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

  if (currentState === "chat") {
    return <Chat onLogout={handleLogout} />;
  }

  return (
    <div className="relative">
      <Hero onLogin={handleLogin} onSignup={handleSignup} />

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