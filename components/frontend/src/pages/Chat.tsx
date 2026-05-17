import { ChatFrame } from "@/components/ChatFrame";

interface ChatProps {
  onLogout: () => void;
  onLogin?: (options?: { intent?: "save-route" }) => void;
  onSignup?: (options?: { intent?: "save-route" }) => void;
  onPartnerLogin?: () => void;
  authIntent?: "none" | "save-route";
  onAuthIntentHandled?: () => void;
}

export default function Chat({
  onLogout,
  onLogin,
  onSignup,
  onPartnerLogin,
  authIntent = "none",
  onAuthIntentHandled,
}: ChatProps) {
  return (
    <ChatFrame
      onLogout={onLogout}
      onLogin={onLogin}
      onSignup={onSignup}
      onPartnerLogin={onPartnerLogin}
      authIntent={authIntent}
      onAuthIntentHandled={onAuthIntentHandled}
    />
  );
}
