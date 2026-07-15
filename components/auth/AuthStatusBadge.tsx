"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SessionUser = { username: string; displayName: string; ownerId: string } | null;

/**
 * Zeigt "Angemeldet als {Name} · Abmelden" in der oberen Ecke, sobald eine
 * Session existiert. `authEnabled` kommt vom Server (isAuthEnabled()) - ist
 * Phase-1-Login deaktiviert, wird nicht einmal die Session-API abgefragt und
 * die Komponente rendert nichts, also keinerlei Effekt auf die bestehende UI.
 */
export function AuthStatusBadge({ authEnabled }: { authEnabled: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!authEnabled) {
      return undefined;
    }

    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((payload: { user: SessionUser }) => {
        if (!cancelled) {
          setUser(payload.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authEnabled]);

  if (!authEnabled || !user) {
    return null;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="oly-auth-status-badge">
      <span>Angemeldet als {user.displayName}</span>
      <span aria-hidden="true"> · </span>
      <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
        Abmelden
      </button>
    </div>
  );
}
