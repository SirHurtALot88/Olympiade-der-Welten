"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(
          res.status === 503
            ? "Login ist nicht konfiguriert (LEC_PASSWORD/LEC_AUTH_SECRET fehlen)."
            : "Falsches Passwort."
        );
        setLoading(false);
        return;
      }
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          boxShadow: "var(--shadow)",
          padding: "28px 26px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flex: "none",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(150deg, #e7c877, #b8862a 60%, #8a6416)",
              color: "#2a1e08",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.5,
            }}
          >
            LE
          </div>
          <div>
            <b style={{ fontSize: "14.5px", fontWeight: 700, display: "block" }}>Lord Enterich</b>
            <span style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.3px" }}>
              Cards · Cockpit
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            style={{ fontSize: "12.5px", color: "var(--muted)", fontWeight: 600 }}
          >
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              marginTop: 6,
              width: "100%",
              background: "var(--panel2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              padding: "9px 11px",
              color: "var(--ink)",
              font: "inherit",
              fontSize: "13.5px",
              outline: "none",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--crit)",
              background: "var(--crit-bg)",
              borderRadius: "var(--r-sm)",
              padding: "8px 10px",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          style={{
            border: 0,
            background: "var(--accent-soft)",
            color: "var(--accent-ink)",
            fontWeight: 700,
            fontSize: "13.5px",
            padding: "10px 12px",
            borderRadius: "var(--r-sm)",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Prüfe …" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
