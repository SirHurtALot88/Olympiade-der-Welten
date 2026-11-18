"use client";

import type { VorraumTeam } from "@/lib/foundation/battle-arena/arena-vorraum";

/**
 * WECHSEL DISZIPLIN 1 -> DISZIPLIN 2 (18.11., Mockup `arena-spieltag-modern-18-11.html`, Screen 6).
 * Links die gebuchte Disziplin 1, in der Mitte "gleiches Team, neues Spiel", rechts die eigene Gruppe bzw.
 * das eigene Duell von Disziplin 2. Der Weiter-Knopf oeffnet IMMER das Spiel des gesteuerten Teams
 * (`bestimmeArenaSpieltagAnsicht` stellt per Test sicher, dass das eigene Team im gezeigten Spiel sitzt).
 * Darunter die uebrigen Spiele der Disziplin, nur zur Orientierung; sie oeffnen nichts und buchen nichts.
 */
export default function ArenaWechsel({
  d1Name,
  d1Ergebnis,
  d2Name,
  d2Art,
  eigenesSpiel,
  andereSpiele,
  eigenesTeamName,
  gesperrt,
  onWeiter,
}: {
  d1Name: string;
  /** Gebuchtes Ergebnis von Disziplin 1 in Worten (`beschreibeGebuchtesArenaErgebnis`); `null` ohne Daten. */
  d1Ergebnis: string | null;
  d2Name: string;
  d2Art: "duell" | "pod" | null;
  eigenesSpiel: VorraumTeam[];
  andereSpiele: Array<{ id: string; teamNamen: string[] }>;
  eigenesTeamName: string | null;
  gesperrt: boolean;
  onWeiter: () => void;
}) {
  return (
    <section className="oly-wechsel" data-testid="arena-wechsel" aria-label="Wechsel zu Disziplin 2">
      <style>{`
        .oly-wechsel{display:flex;flex-direction:column;gap:14px;padding:16px 18px;border-radius:14px;
          border:1px solid rgba(255,255,255,.12);background:#0d1219;color:#e8edf5}
        .oly-wechsel .reihe{display:grid;grid-template-columns:1fr auto 1.4fr;gap:16px;align-items:stretch}
        @media (max-width:900px){.oly-wechsel .reihe{grid-template-columns:1fr}}
        .oly-wechsel .feld{padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
        .oly-wechsel .feld.neu{border:2px solid #E8C26A}
        .oly-wechsel small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#9aa7ba}
        .oly-wechsel h3{margin:2px 0 6px;font-size:20px}
        .oly-wechsel .mitte{align-self:center;text-align:center;color:#9aa7ba;font-size:12px;font-weight:700}
        .oly-wechsel .gruppe{display:flex;gap:8px;flex-wrap:wrap}
        .oly-wechsel .gruppe span{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;
          border:1px solid var(--tf);color:var(--tf)}
        .oly-wechsel .gruppe span.eigen{background:color-mix(in srgb,#F2A03D 22%,transparent)}
        .oly-wechsel .marke{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:6px;background:#E8C26A;color:#17120a;
          font-size:10.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;vertical-align:middle}
        .oly-wechsel ul{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9aa7ba}
        .oly-wechsel .fuss{display:flex;gap:12px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
        .oly-wechsel button{min-height:44px;padding:0 22px;border-radius:10px;border:0;cursor:pointer;font:inherit;font-weight:800;
          font-size:15px;background:#F2A03D;color:#17120a}
        .oly-wechsel button[disabled]{opacity:.45;cursor:not-allowed}
      `}</style>
      <div className="reihe">
        <div className="feld" data-testid="arena-wechsel-d1">
          <small>Disziplin 1 · gebucht ✓</small>
          <h3>{d1Name}</h3>
          <div>{d1Ergebnis ?? "Ergebnis steht in der Spieltagswertung."}</div>
        </div>
        <div className="mitte">
          gleiches Team,
          <br />
          neues Spiel →
        </div>
        <div className="feld neu" data-testid="arena-wechsel-d2">
          <small>
            Disziplin 2 · {d2Art === "pod" ? "deine Vierergruppe" : "dein Duell"}
            <span className="marke">Dein Spiel · Standard</span>
          </small>
          <h3>{d2Name}</h3>
          {eigenesSpiel.length > 0 ? (
            <div className="gruppe">
              {eigenesSpiel.map((team) => (
                <span key={team.teamId} className={team.eigen ? "eigen" : undefined} style={{ ["--tf" as string]: team.farbe }}>
                  {team.name}
                </span>
              ))}
            </div>
          ) : (
            <div>{eigenesTeamName ? `${eigenesTeamName} spielt in dieser Disziplin.` : "Dein Team spielt in dieser Disziplin."}</div>
          )}
          {andereSpiele.length > 0 ? (
            <ul aria-label="Weitere Spiele dieser Disziplin">
              {andereSpiele.map((spiel) => (
                <li key={spiel.id}>{spiel.teamNamen.join(" · ")}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="fuss">
        <span style={{ fontSize: 12, color: "#9aa7ba" }}>
          {gesperrt
            ? "Disziplin 1 abgeschlossen — der Host schaltet zur zweiten Disziplin weiter."
            : "Disziplin 1 abgeschlossen — weiter zum Spiel deines Teams in Disziplin 2."}
        </span>
        <button type="button" disabled={gesperrt} data-testid="arena-wechsel-weiter" onClick={onWeiter}>
          Weiter zu Disziplin 2: {d2Name} →
        </button>
      </div>
    </section>
  );
}
