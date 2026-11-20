import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, type Quota } from "../api";
import { useAuth } from "../auth";
import { ChatDock } from "./ChatDock";

export function Layout() {
  const { user, logout } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaError, setQuotaError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const load = () => {
      api<Quota>("/api/downloads/quota")
        .then((value) => {
          if (cancelled) return;
          setQuota(value);
          setQuotaError("");
        })
        .catch(() => {
          if (cancelled) return;
          setQuotaError("The catalog could not be loaded. The API on port 4000 is not responding.");
          timer = window.setTimeout(load, 3000);
        });
    };

    load();
    window.addEventListener("elibrary-quota", load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("elibrary-quota", load);
    };
  }, [user]);

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <strong>The Emerald Archive</strong>
          <span>Public-domain reading room</span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>Catalog</NavLink>
          <NavLink to="/library">My Library</NavLink>
          <NavLink to="/favorites">Favorites</NavLink>
          {user?.role === "admin" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="account">
          {quota && <span className="quota">{quota.remaining} of {quota.limit} downloads left</span>}
          {!quota && quotaError && <span className="quota">{quotaError}</span>}
          {user ? (
            <>
              <span>{user.name}</span>
              <button className="ghost" onClick={() => logout()}>Log out</button>
            </>
          ) : (
            <NavLink to="/login" className="ghost">Sign in</NavLink>
          )}
        </div>
      </header>
      <div className="scroller">
        <main className="page">
          <Outlet />
        </main>
      </div>
      <ChatDock />
    </div>
  );
}
