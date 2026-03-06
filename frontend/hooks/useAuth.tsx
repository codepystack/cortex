"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextValue {
  /** null = not yet hydrated, "" = no token, string = valid JWT */
  token: string | null;
  userEmail: string | null;
  hydrated: boolean;
  setAuth: (token: string, email: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  userEmail: null,
  hydrated: false,
  setAuth: () => {},
  clearAuth: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cortex_token");
    const email = localStorage.getItem("cortex_email");
    if (stored) setToken(stored);
    if (email) setUserEmail(email);
    setHydrated(true);
  }, []);

  const setAuth = useCallback((t: string, e: string) => {
    localStorage.setItem("cortex_token", t);
    localStorage.setItem("cortex_email", e);
    setToken(t);
    setUserEmail(e);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem("cortex_token");
    localStorage.removeItem("cortex_email");
    setToken(null);
    setUserEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, userEmail, hydrated, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
