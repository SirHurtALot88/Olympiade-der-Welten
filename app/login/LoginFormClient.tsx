"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LobbyCard } from "@/components/LobbyCard";

type AuthUsername = "chris" | "franky";

const USER_OPTIONS: Array<{ username: AuthUsername; label: string }> = [
  { username: "chris", label: "Chris" },
  { username: "franky", label: "Franky" },
];

export default function LoginFormClient() {
  const router = useRouter();
  const [username, setUsername] = useState<AuthUsername>("chris");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Falscher Benutzer oder falsches Passwort.");
        setIsBusy(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      setIsBusy(false);
    }
  }

  return (
    <main className="app-shell oly-login-shell">
      <header className="hero">
        <p className="eyebrow">Olympiade der Welten</p>
        <h1>Willkommen zurück</h1>
        <p>Wähle deinen Namen und gib dein Passwort ein, um weiterzuspielen.</p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="oly-login-grid">
        <LobbyCard title="Anmelden">
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="filter-field">
              <span>Wer bist du?</span>
              <div className="pill-toggle-group" role="radiogroup" aria-label="Benutzer">
                {USER_OPTIONS.map((option) => (
                  <button
                    key={option.username}
                    type="button"
                    role="radio"
                    aria-checked={username === option.username}
                    className={`pill-toggle${username === option.username ? " is-selected" : ""}`}
                    onClick={() => setUsername(option.username)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="filter-field">
              <span>Passwort</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </label>
            <button className="primary-button" type="submit" disabled={isBusy}>
              {isBusy ? "Anmelden ..." : "Anmelden"}
            </button>
          </form>
        </LobbyCard>
      </div>
    </main>
  );
}
