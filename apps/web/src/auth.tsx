import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, readToken, storeToken, type User } from "./api";

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ pending: boolean }>;
  confirm: (email: string, code: string, remember?: boolean) => Promise<void>;
  sendCode: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setReady(true);
      return;
    }
    api<{ user: User }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    ready,
    async login(email, password, remember = true) {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      storeToken(data.token, remember);
      setUser(data.user);
    },
    async register(name, email, password) {
      const data = await api<{ pending?: boolean; token?: string; user?: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      if (data.pending || !data.token || !data.user) return { pending: true };
      storeToken(data.token, true);
      setUser(data.user);
      return { pending: false };
    },
    async confirm(email, code, remember = true) {
      const data = await api<{ token: string; user: User }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      storeToken(data.token, remember);
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
      clearToken();
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
