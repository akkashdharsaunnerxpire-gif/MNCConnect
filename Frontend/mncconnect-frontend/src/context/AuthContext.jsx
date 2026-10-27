import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { socket } from "../utils/socket";

const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Identity comes ONLY from the HttpOnly cookie, via the server.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      setUser(data?.user || null);
      return data?.user || null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    if (socket.connected) socket.disconnect();
    setUser(null);
  }, []);

  // check the session once when the app opens
  useEffect(() => {
    refresh();
  }, [refresh]);

  // socket follows the session
  useEffect(() => {
    if (user && !socket.connected && !socket.active) socket.connect();
    if (!user && socket.connected) socket.disconnect();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, role: user?.role || null, loading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}