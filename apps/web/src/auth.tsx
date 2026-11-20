import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, type User } from "./api";

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ pending: boolean }>;
  confirm: (email: string, code: string) => Promise<void>;
  sendCode: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("elibrary.token");
    if (!token) {
      setReady(true);
      return;
    }
    api<{ user: User }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("elibrary.token"))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    ready,
    async login(email, password) {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("elibrary.token", data.token);
      setUser(data.user);
    },
    async register(name, email, password) {
      const data = await api<{ pending?: boolean; token?: string; user?: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (data.pending || !data.token || !data.user) return { pending: true };
      localStorage.setItem("elibrary.token", data.token);
      setUser(data.user);
      return { pending: false };
    },
    async confirm(email, code) {
      const data = await api<{ token: string; user: User }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      localStorage.setItem("elibrary.token", data.token);
      setUser(data.user);
    },
    async sendCode(email, password) {
      await api("/api/auth/code", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    async logout() {
      await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      localStorage.removeItem("elibrary.token");
      setUser(null);
    },
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
