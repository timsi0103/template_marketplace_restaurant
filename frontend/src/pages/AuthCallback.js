import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const { exchangeGoogleSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef to prevent double processing under StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const sessionId = params.get("session_id");

    if (sessionId) {
      exchangeGoogleSession(sessionId).then((result) => {
        if (result.success) {
          // Clean the URL and navigate to home
          window.history.replaceState(null, "", "/");
          navigate("/", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      });
    } else {
      navigate("/login", { replace: true });
    }
  }, []);

  return (
    <div data-testid="auth-callback" className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-sm text-brand-text-secondary">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
