import { ChatFrame } from "@/components/ChatFrame";

interface ChatProps {
  onLogout: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
  onPartnerLogin?: () => void;
}

export default function Chat({ onLogout, onLogin, onSignup, onPartnerLogin }: ChatProps) {
  return (
    <ChatFrame
      onLogout={onLogout}
      onLogin={onLogin}
      onSignup={onSignup}
      onPartnerLogin={onPartnerLogin}
    />
  );
}
