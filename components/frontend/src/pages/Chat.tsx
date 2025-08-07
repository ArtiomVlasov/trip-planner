import { ChatFrame } from "@/components/ChatFrame";

interface ChatProps {
  onLogout: () => void;
}

export default function Chat({ onLogout }: ChatProps) {
  return <ChatFrame onLogout={onLogout} />;
}