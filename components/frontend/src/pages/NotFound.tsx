import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { copy } = useLanguage();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center px-4">
        <div className="mb-6 flex justify-center">
          <LanguageToggle />
        </div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">{copy.notFound.title}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {copy.notFound.action}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
