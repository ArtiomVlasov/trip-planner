import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ProfilePage } from "./pages/ProfilePage";
import { PlannerPage } from "./pages/PlannerPage";
import { PartnerCabinetPage } from "./pages/PartnerCabinetPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/partner" element={<PartnerCabinetPage view="places" />} />
            <Route path="/partner/profile" element={<PartnerCabinetPage view="profile" />} />
            <Route path="/partner/places" element={<PartnerCabinetPage view="places" />} />
            <Route path="/partner/statistics" element={<PartnerCabinetPage view="statistics" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
