import { createContext, useContext, useState, useEffect } from "react";

const StoreStatusContext = createContext(null);
const API_BASE = "/api";

export function StoreStatusProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const resp = await fetch(`${API_BASE}/store/status`);
      const data = await resp.json();
      setStatus(data);
    } catch {
      setStatus({ is_open: true, pause_ordering: false, close_time: "", next_open: "", active_holiday: null, upcoming_holidays: [], services: {}, day: "" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <StoreStatusContext.Provider value={{ status, loading, refetch: fetchStatus }}>
      {children}
    </StoreStatusContext.Provider>
  );
}

export function useStoreStatus() {
  const ctx = useContext(StoreStatusContext);
  if (!ctx) throw new Error("useStoreStatus must be used within StoreStatusProvider");
  return ctx;
}
