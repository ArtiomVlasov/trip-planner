import { Navigate, useNavigate } from "react-router-dom";

import {
  PartnerPlacesPage,
  type PartnerCabinetView,
} from "./PartnerPlacesPage";

interface PartnerCabinetPageProps {
  view: PartnerCabinetView;
}

export function PartnerCabinetPage({ view }: PartnerCabinetPageProps) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const accountType = localStorage.getItem("accountType");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("accountType");
    localStorage.removeItem("partnerId");
    navigate("/");
  };

  if (!token || accountType !== "partner") {
    return <Navigate to="/planner" replace />;
  }

  return <PartnerPlacesPage view={view} onLogout={handleLogout} />;
}
