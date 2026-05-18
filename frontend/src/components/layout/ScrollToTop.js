import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the top of the page whenever the route changes.
 * Renders nothing; mount once near the router root.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    // Use 'auto' (instant) on first paint of a new route to feel snappy.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);
  return null;
}
