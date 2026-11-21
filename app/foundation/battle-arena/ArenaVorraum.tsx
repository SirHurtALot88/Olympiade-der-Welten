"use client";

import type { LadeSchritt, VorraumTeam } from "@/lib/foundation/battle-arena/arena-vorraum";
import { punkteSchema } from "@/lib/foundation/battle-arena/arena-vorraum";

/**
 * VORRAUM DER SPIELTAGS-ARENA (18.11., Mockup `public/mockups/arena-spieltag-modern-18-11.html`):
 *  - Screen 1 "Laden": Disziplin x von y, Paarung bzw. Gruppe mit dem eigenen Team, vier echte Ladeschritte,
 *    drei Fakten statt Fliesstext, Ausblick auf Disziplin 2.
 *  - Screen 2a/2b "Vorstellung": zwei Teamkarten (Duell) oder vier (Vierergruppe, KEIN "A gegen B"), das
 *    Punkteschema und je Team Platz, Punkte und Kaderstaerke (beste 6). Der Gegner zeigt keine Eignung der
 *    Einsatzplaetze und keine Formkarte (kein Spoiler vor dem Anpfiff).
 * Reine Darstellung; alle Zahlen kommen aus `baueVorraumTeams` (gebuchter Stand), nichts ist erfunden.
 */
export type VorraumAusblick = { disziplinName: string; art: "duell" | "pod"; teams: VorraumTeam[] };

const CSS = `
.oly-vorraum{position:absolute;inset:0;z-index:1;overflow:auto;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:18px;padding:72px 32px 32px;color:#e8edf5;
  background:radial-gradient(120% 90% at 50% 30%,#18202c 0%,#0d1219 60%,#07090d 100%)}
.oly-arena-buehne[data-voll="0"] .oly-vorraum{position:relative;min-height:520px}
.oly-arena-buehne[data-voll="0"] .oly-vorraum ~ div{display:none}
.oly-podmarke{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:8px;border:1px solid #E8C26A;
  background:rgba(232,194,106,.12);color:#E8C26A;font-weight:900;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
.oly-podmarke i{display:inline-flex;gap:2px;font-style:normal}
.oly-podmarke i b{width:9px;height:9px;border-radius:2px;background:#E8C26A}
.oly-vorraum h2.oly-vorraum-titel{margin:0;font-size:clamp(28px,3.2vw,52px);letter-spacing:.02em;text-transform:uppercase}
.oly-vorraum .gk{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#9aa7ba}
.oly-vorraum .duo,.oly-vorraum .vier{display:flex;gap:14px;align-items:stretch;justify-content:center;flex-wrap:wrap;width:min(1500px,100%)}
.oly-vteam{--tf:#3CC8D6;flex:1 1 240px;min-width:220px;max-width:420px;padding:14px 16px;border-radius:12px;
  border:1px solid color-mix(in srgb,var(--tf) 55%,transparent);background:color-mix(in srgb,var(--tf) 8%,#0d1219);
  display:flex;flex-direction:column;gap:8px}
.oly-vorraum .vier .oly-vteam.eigen{flex-grow:1.35}
.oly-vteam.eigen{border:2px solid #E8C26A}
.oly-vteam .kopf{display:flex;align-items:center;gap:12px}
.oly-vteam .wappen{width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-weight:900;font-size:14px;
  background:var(--tf);color:#10151c}
.oly-vteam h2{margin:0;font-size:20px;line-height:1.1}
.oly-vteam .du{display:inline-block;margin-bottom:3px;padding:1px 8px;border-radius:6px;background:#E8C26A;color:#17120a;
  font-size:10.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
.oly-vteam dl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0}
.oly-vteam dd small{display:block;font-size:11px;font-weight:600;color:#9aa7ba;letter-spacing:0}
.oly-vteam dl div{display:flex;flex-direction:column}
.oly-vteam dt{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#9aa7ba}
.oly-vteam dd{margin:0;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.oly-vteam .marken{display:flex;gap:4px}
.oly-vteam .marken i{width:16px;height:6px;border-radius:2px;background:var(--tf)}
.oly-vteam .marken i.o{opacity:.22}
.oly-vteam .karte{font-size:12px;color:#9aa7ba}
.oly-vteam.eigen .karte{color:#c9d2e0}
.oly-vs{align-self:center;font-weight:900;color:#9aa7ba;letter-spacing:.12em}
.oly-schema{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.oly-schema div{padding:6px 14px;border:1px solid rgba(255,255,255,.14);border-radius:8px;text-align:center}
.oly-schema small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#9aa7ba}
.oly-schema b{font-size:20px}
.oly-lade-schritte{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.oly-lade-schritte div{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:8px;font-size:13px;
  border:1px solid rgba(255,255,255,.14);color:#7f8ca0}
.oly-lade-schritte .fertig{color:#5fd08a;border-color:rgba(95,208,138,.5)}
.oly-lade-schritte .laeuft{color:#F2A03D;border-color:#F2A03D}
.oly-lade-fakten{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;width:min(1200px,100%)}
.oly-lade-fakten div{flex:1 1 280px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.05)}
.oly-lade-fakten b{display:block;font-size:14px}
.oly-lade-fakten small{color:#9aa7ba;font-size:12px}
.oly-lade-danach{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;font-size:13px;color:#9aa7ba}
.oly-lade-danach .wappen{width:26px;height:26px;border-radius:6px;display:grid;place-items:center;font-weight:900;font-size:10px;
  background:var(--tf);color:#10151c}
.oly-vfuss{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center}
.oly-vfuss .hin{font-size:13px;color:#9aa7ba}
.oly-vfuss button{min-height:44px;padding:0 22px;border-radius:10px;cursor:pointer;font:inherit;font-weight:800;font-size:15px;
  border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:inherit}
.oly-vfuss button.haupt{border-color:#F2A03D;background:#F2A03D;color:#17120a}
.oly-vfuss button[disabled]{opacity:.5;cursor:progress}
.oly-dreh{width:14px;height:14px;flex:none;border-radius:50%;border:2px solid rgba(255,255,255,.18);border-top-color:#F2A03D;
  animation:olyArenaDrehen 800ms linear infinite}
@media (prefers-reduced-motion:reduce){.oly-dreh{animation:none}}
`;

function PodMarke() {
  return (
    <span className="oly-podmarke" data-testid="arena-podmarke" title="Vierergruppe: vier Teams gleichzeitig in einer Arena, Platz 1 bis 4">
      <i aria-hidden>
        <b />
        <b />
        <b />
        <b />
      </i>
      4 Teams · Pod
    </span>
  );
}

function Wappen({ team }: { team: VorraumTeam }) {
  return (
    <span className="wappen" style={{ ["--tf" as string]: team.farbe }} aria-hidden>
      {team.kuerzel.slice(0, 3)}
    </span>
  );
}

function Teamkarte({ team, disziplinName }: { team: VorraumTeam; disziplinName: string }) {
  return (
    <article
      className={`oly-vteam${team.eigen ? " eigen" : ""}`}
      style={{ ["--tf" as string]: team.farbe }}
      data-testid={team.eigen ? "arena-vorraum-team-eigen" : "arena-vorraum-team"}
      data-team-id={team.teamId}
    >
      <div className="kopf">
        <Wappen team={team} />
        <div style={{ minWidth: 0 }}>
          {team.eigen ? <span className="du">Dein Team</span> : null}
          <h2>{team.name}</h2>
        </div>
      </div>
      <dl>
        <div>
          <dt>Saison</dt>
          <dd>{team.rang != null ? `${team.rang}.` : "–"}</dd>
        </div>
        <div data-testid="arena-vorraum-diszrang">
          <dt>{disziplinName}-Rang</dt>
          <dd>
            {team.diszRang ? `${team.diszRang.liga ?? team.diszRang.gesamt}.` : "–"}
            {team.diszRang ? (
              <small title={team.diszRang.quelle === "saison" ? "Rang nach Teampunkten dieser Disziplin" : "Rang nach Kaderstärke (beste 6), noch keine Wertung"}>
                {team.diszRang.liga != null && team.diszRang.ligaName ? `${team.diszRang.ligaName} · ` : ""}
                {team.diszRang.gesamt}. von {team.diszRang.gesamtVon}
              </small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Punkte</dt>
          <dd>{team.punkte != null ? String(Math.round(team.punkte * 10) / 10).replace(".", ",") : "–"}</dd>
        </div>
        <div>
          <dt title={`Kaderstärke in ${disziplinName}: Mittel der besten 6`}>Stärke</dt>
          <dd>{team.kaderStaerke != null ? `≈ ${team.kaderStaerke}` : "–"}</dd>
        </div>
      </dl>
      {team.marke != null ? (
        <div className="marken" title="Grobe Stärke in dieser Gruppe">
          {[1, 2, 3, 4, 5].map((i) => (
            <i key={i} className={i <= team.marke! ? undefined : "o"} />
          ))}
        </div>
      ) : null}
      <div className="karte">
        {team.eigen
          ? "Deine Aufstellung steht in der Arena links; Formkarte und Captain wie gesetzt."
          : "Kader (beste 6) – Aufstellung und Formkarte bleiben bis zum Anpfiff verdeckt."}
      </div>
    </article>
  );
}

export function ArenaLadebild({
  disziplinName,
  disziplinNr,
  disziplinAnzahl,
  art,
  teams,
  schritte,
  ausblick,
}: {
  disziplinName: string;
  disziplinNr: number;
  disziplinAnzahl: number;
  art: "duell" | "pod";
  teams: VorraumTeam[];
  schritte: LadeSchritt[];
  ausblick: VorraumAusblick | null;
}) {
  return (
    <div className="oly-vorraum" data-testid="arena-laden" role="status" aria-live="polite">
      <style>{CSS}</style>
      <div className="gk">
        Disziplin {disziplinNr} von {disziplinAnzahl} · {disziplinName}
      </div>
      <h2 className="oly-vorraum-titel">Arena wird vorbereitet</h2>
      {art === "pod" ? <PodMarke /> : null}
      <div className={art === "pod" ? "vier" : "duo"}>
        {teams.map((team, index) => (
          <div key={team.teamId} style={{ display: "contents" }}>
            {art === "duell" && index === 1 ? <span className="oly-vs">GEGEN</span> : null}
            <Teamkarte team={team} disziplinName={disziplinName} />
          </div>
        ))}
      </div>
      <div className="oly-lade-schritte">
        {schritte.map((schritt) => (
          <div key={schritt.label} className={schritt.status}>
            {schritt.status === "fertig" ? "✓" : schritt.status === "laeuft" ? <i className="oly-dreh" /> : "·"} {schritt.label}
          </div>
        ))}
      </div>
      <div className="oly-lade-fakten">
        <div>
          <b>Gezeigt = gebucht</b>
          <small>Gleiche Kader, gleiche Aufstellung, gleiche Saat wie die Wertung im Hintergrund.</small>
        </div>
        <div>
          <b>Zuschauen oder Quick-Sim</b>
          <small>Derselbe Verlauf, nur schneller. Das Ergebnis ist identisch.</small>
        </div>
        <div>
          <b>Abpfiff bucht die Disziplin</b>
          <small>Erst mit dem Ende stehen Punkte und PP in der Spieltagswertung.</small>
        </div>
      </div>
      {ausblick ? (
        <div className="oly-lade-danach">
          <span>
            Danach · <b>Disziplin 2 von {disziplinAnzahl}: {ausblick.disziplinName}</b>
            {ausblick.art === "pod" ? " · deine Vierergruppe" : " · Duell"}
          </span>
          {ausblick.teams.map((team) => (
            <span key={team.teamId} className="wappen" style={{ ["--tf" as string]: team.farbe }} title={team.name}>
              {team.kuerzel.slice(0, 3)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArenaVorstellung({
  disziplinName,
  disziplinNr,
  disziplinAnzahl,
  art,
  teams,
  hinweis,
  onStart,
  onQuickSim,
  quickSimGesperrt,
}: {
  disziplinName: string;
  disziplinNr: number;
  disziplinAnzahl: number;
  art: "duell" | "pod";
  teams: VorraumTeam[];
  hinweis: string;
  onStart: () => void;
  onQuickSim: () => void;
  quickSimGesperrt: boolean;
}) {
  return (
    <div className="oly-vorraum" data-testid="arena-vorstellung" data-art={art}>
      <style>{CSS}</style>
      <div className="gk">
        Disziplin {disziplinNr} von {disziplinAnzahl} · {art === "pod" ? "Vierergruppe · jeder gegen jeden" : "Duell"}
      </div>
      <h2 className="oly-vorraum-titel">{disziplinName}</h2>
      {art === "pod" ? <PodMarke /> : null}
      <div className="oly-schema" data-testid="arena-vorstellung-schema">
        {punkteSchema(art).map((eintrag) => (
          <div key={eintrag.label}>
            <small>{eintrag.label}</small>
            <b>{eintrag.punkte} Pkt</b>
          </div>
        ))}
      </div>
      <div className={art === "pod" ? "vier" : "duo"}>
        {teams.map((team, index) => (
          <div key={team.teamId} style={{ display: "contents" }}>
            {art === "duell" && index === 1 ? <span className="oly-vs">VS</span> : null}
            <Teamkarte team={team} disziplinName={disziplinName} />
          </div>
        ))}
      </div>
      <div className="oly-vfuss">
        <span className="hin">{hinweis}</span>
        <button type="button" data-testid="arena-vorstellung-quicksim" onClick={onQuickSim} disabled={quickSimGesperrt}>
          ⏩ Quick-Sim
        </button>
        <button type="button" className="haupt" data-testid="arena-vorstellung-start" onClick={onStart}>
          ▶ Zur Arena
        </button>
      </div>
    </div>
  );
}
