"use client";

import { useMemo, useState } from "react";

import "./arena-vorstellung.css";
import { getClassColorToken, getClassIconSrc } from "@/app/foundation/classVisuals";
import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import { BcMoralGesicht } from "@/components/foundation/broadcast/BcMoralGesicht";
import { figurPoseUrl, getFigurSpriteBySlug } from "@/lib/data/figurenSprites";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { LadeSchritt, VorraumTeam } from "@/lib/foundation/battle-arena/arena-vorraum";
import { punkteSchema } from "@/lib/foundation/battle-arena/arena-vorraum";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { baueVorstellungsTafel, kulisseFuerVorstellung } from "@/lib/foundation/battle-arena/arena-vorstellung-tafel";
import type {
  VorstellungFeldplan,
  VorstellungSlot,
  VorstellungTafel,
  VorstellungTeam,
  VorstellungVergleich,
  VorstellungZelle,
} from "@/lib/foundation/battle-arena/arena-vorstellung-tafel";

/**
 * VORRAUM DER SPIELTAGS-ARENA (18.11., Mockup `public/mockups/arena-spieltag-modern-18-11.html`):
 *  - Screen 1 "Laden": Disziplin x von y, Paarung bzw. Gruppe mit dem eigenen Team, vier echte Ladeschritte,
 *    drei Fakten statt Fliesstext, Ausblick auf Disziplin 2.
 *  - Screen 2a/2b "Vorstellung" (Rework 22.11., Mockup `public/mockups/arena-vorstellung-rework-22-11.html`):
 *    EINE ZEILE = EIN SLOT. Duell: Teamtafeln aussen, eigene Spieler | Slot-Spalte | Gegner. Vierergruppe:
 *    Slot-Spalte links, vier Team-Spalten, eigenes Team zuerst (KEIN "A gegen B"). Die Zahlen der Gegner sind
 *    exakt (roh + Slot-Bonus), aber ohne Form, Moral und Karte; die gegnerische Formkarte bleibt verdeckt.
 * Reine Darstellung; alle Zahlen kommen aus `baueVorstellungsTafel` (lib/foundation/battle-arena/arena-vorstellung-tafel.ts)
 * bzw. `baueVorraumTeams` (gebuchter Stand), nichts ist erfunden.
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


/* ================================================================================================
 * VORSTELLUNG (Rework 22.11.)
 * ============================================================================================== */

const ICO: Record<string, string> = {
  l: "M15 5l-7 7 7 7",
  r: "M9 5l7 7-7 7",
  gleich: "M6 9h12M6 15h12",
  auf: "M6 14l6-6 6 6",
  ab: "M6 10l6 6 6-6",
  kreuz: "M12 5v14M5 12h14",
  vor: "M4 5l8 7-8 7zM13 5l8 7-8 7z",
  play: "M7 4l13 8-13 8z",
  schloss: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3",
  ort: "M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
};

function Ico({ n }: { n: keyof typeof ICO }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden>
      <path d={ICO[n]} fill={n === "play" || n === "vor" ? "currentColor" : "none"} />
    </svg>
  );
}

const KLASSEN_FARBE_VAR: Record<string, string> = {
  red: "var(--k-red)",
  green: "var(--k-green)",
  blue: "var(--k-blue)",
  yellow: "var(--k-yellow)",
};

const MARKE_WORT = ["", "schwach", "unter Schnitt", "Schnitt", "stark", "sehr stark"];

function Logo({ team }: { team: VorraumTeam }) {
  const url = getStaticTeamLogoUrl(team.teamId);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt="" />;
  return (
    <span className="lgf" aria-hidden>
      {team.kuerzel.slice(0, 3)}
    </span>
  );
}

function ManagerMarke({ team }: { team: VorstellungTeam }) {
  return team.manager.art === "mensch" ? (
    <span className="mg">{team.manager.name ?? "Mensch"}</span>
  ) : (
    <span className="mg ki">KI</span>
  );
}

function Balken({ marke }: { marke: number }) {
  return (
    <span className="balken" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= marke ? undefined : "o"} />
      ))}
    </span>
  );
}

function zahlDe(wert: number | null): string {
  return wert == null ? "–" : String(Math.round(wert * 10) / 10).replace(".", ",");
}

function einsatzText(einsatz: "schonen" | "normal" | "push"): string {
  return einsatz === "schonen" ? "Schonen" : einsatz === "push" ? "Push" : "Normal";
}

function Stat({ team, disziplinName, mitBeschriftung }: { team: VorstellungTeam; disziplinName: string; mitBeschriftung: boolean }) {
  const dr = team.diszRang;
  return (
    <>
      <div>
        <dt>Saison</dt>
        <dd className="t">
          {team.rang != null ? `${team.rang}.` : "–"}
          {mitBeschriftung ? <small>{zahlDe(team.punkte)} Punkte</small> : null}
        </dd>
      </div>
      <div data-testid="arena-vorraum-diszrang">
        <dt>{disziplinName}-Rang</dt>
        <dd className="t">
          {dr ? `${dr.liga ?? dr.gesamt}.` : "–"}
          {dr && mitBeschriftung ? (
            <small title={dr.quelle === "saison" ? "Rang nach Teampunkten dieser Disziplin" : "Rang nach Kaderstärke (beste 6), noch keine Wertung"}>
              {dr.liga != null && dr.ligaName ? `${dr.ligaName} · ` : ""}
              {dr.gesamt}. von {dr.gesamtVon}
            </small>
          ) : null}
        </dd>
      </div>
      {!mitBeschriftung ? (
        <div>
          <dt>Punkte</dt>
          <dd className="t">{zahlDe(team.punkte)}</dd>
        </div>
      ) : null}
      <div style={mitBeschriftung ? { gridColumn: "1 / -1" } : undefined}>
        <dt title={`Kaderstärke in ${disziplinName}: Mittel der besten 6`}>Stärke · beste 6</dt>
        {team.eigen ? (
          <dd className="t">{team.kaderStaerke != null ? team.kaderStaerke : "–"}</dd>
        ) : (
          <dd title="Fremde Kader nur als grobe Stufe">
            {team.marke != null ? (
              <>
                <Balken marke={team.marke} />
                <span className="st-tag">{MARKE_WORT[team.marke]}</span>
              </>
            ) : (
              "–"
            )}
          </dd>
        )}
      </div>
    </>
  );
}

function KartenBlock({ team }: { team: VorstellungTeam }) {
  const info = team.eigenInfo;
  if (!info) {
    return (
      <div className="fk">
        <div className="k zu">
          <Ico n="schloss" />
        </div>
        <p>
          <b>Formkarte verdeckt</b>
          wird mit dem Anpfiff aufgedeckt
        </p>
      </div>
    );
  }
  if (info.kartenGebucht && info.karten.length > 0) {
    const erste = info.karten[0]!;
    return (
      <div className="fk">
        <div className="k" style={{ ["--kf" as string]: KLASSEN_FARBE_VAR[erste.farbe] ?? "var(--stumm)" }}>
          <small>FORM</small>
          {erste.wert > 0 ? "+" : ""}
          {erste.wert}
        </div>
        <p>
          <b>Formkarte {info.karten.map((k) => k.name).join(" · ")}</b>
          steht je Spieler in der Zeile
        </p>
      </div>
    );
  }
  return (
    <div className="fk">
      <div className="k zu">–</div>
      <p>
        <b>{info.karten.length > 0 ? "Karte zählt hier nicht" : "Keine Formkarte gelegt"}</b>
        {info.kartenHinweis ?? ""}
      </p>
    </div>
  );
}

/** Duell: Teamtafel am Rand, nutzt die Breite; die Zeilen bekommen die ganze Hoehe. */
function Teamtafel({ team, disziplinName }: { team: VorstellungTeam; disziplinName: string }) {
  const info = team.eigenInfo;
  return (
    <div
      className={`tp${team.eigen ? " eigen" : ""}`}
      style={{ ["--tf" as string]: team.farbe }}
      data-testid={team.eigen ? "arena-vorraum-team-eigen" : "arena-vorraum-team"}
      data-team-id={team.teamId}
    >
      <div className="wp">
        <Logo team={team} />
        <div>
          {team.eigen ? <span className="du">Dein Team</span> : null} <ManagerMarke team={team} />
          <h2>{team.name}</h2>
        </div>
      </div>
      <dl>
        <Stat team={team} disziplinName={disziplinName} mitBeschriftung />
      </dl>
      <KartenBlock team={team} />
      {info ? (
        <>
          <div className="lst">
            <span className="chip">Einsatz: {einsatzText(info.einsatz)}</span>
          </div>
          {info.nichtAufgestellt.length > 0 ? (
            <>
              <h3>Nicht aufgestellt</h3>
              <div className="bank">
                {info.nichtAufgestellt.slice(0, 5).map((b) => (
                  <div key={b.playerId} className={b.grund === "verletzt" ? "v" : undefined}>
                    {b.portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.portraitUrl} alt="" />
                    ) : null}
                    {b.name}
                    <small>{b.grund === "verletzt" ? "verletzt · nicht einsetzbar" : "Bank"}</small>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <div className="fussn">Deine Einsatzliste, wie abgegeben. Gezeigt = gebucht.</div>
        </>
      ) : (
        <>
          {team.ohneAufstellung ? <div className="ohne-aufst">Keine Aufstellung hinterlegt: der Motor stellt reihum auf.</div> : null}
          <div className="fussn">Eignung im Slot: rohe Eignung plus Slot-Bonus, exakt. Ohne Form, Moral und Karte.</div>
        </>
      )}
    </div>
  );
}

/** Vierergruppe: Kopf je Team-Spalte. */
function Teamkopf({ team, disziplinName }: { team: VorstellungTeam; disziplinName: string }) {
  const info = team.eigenInfo;
  return (
    <div
      className={`tk${team.eigen ? " eigen" : ""}`}
      style={{ ["--tf" as string]: team.farbe }}
      data-testid={team.eigen ? "arena-vorraum-team-eigen" : "arena-vorraum-team"}
      data-team-id={team.teamId}
    >
      <Logo team={team} />
      <div className="nm">
        {team.eigen ? <span className="du">Dein Team</span> : null}
        <h2>{team.name}</h2>
        <ManagerMarke team={team} />
      </div>
      <dl>
        <Stat team={team} disziplinName={disziplinName} mitBeschriftung={false} />
      </dl>
      <div className="zus">
        {info ? (
          <>
            {info.kartenGebucht && info.karten.length > 0 ? (
              <span className="chip karte" style={{ ["--kf" as string]: KLASSEN_FARBE_VAR[info.karten[0]!.farbe] ?? "var(--stumm)" }}>
                Formkarte {info.karten.map((k) => k.name).join(" · ")}
              </span>
            ) : (
              <span className="chip zu">{info.karten.length > 0 ? "Karte zählt hier nicht" : "Keine Formkarte gelegt"}</span>
            )}
            <span className="chip">Einsatz: {einsatzText(info.einsatz)}</span>
            {info.nichtAufgestellt
              .filter((b) => b.grund === "verletzt")
              .slice(0, 2)
              .map((b) => (
                <span key={b.playerId} className="chip aus">
                  <Ico n="kreuz" />
                  {b.name} · nicht einsetzbar
                </span>
              ))}
          </>
        ) : (
          <span className="chip zu">
            <Ico n="schloss" />
            Formkarte verdeckt bis zum Anpfiff
          </span>
        )}
        {team.ohneAufstellung ? <span className="ohne-aufst">keine Aufstellung hinterlegt</span> : null}
      </div>
    </div>
  );
}

function Feldplan({ plan }: { plan: VorstellungFeldplan }) {
  const hohl = plan.verbindlichkeit !== "motor";
  const titel = `${plan.label ?? "Platz"}${hohl ? " · nur Darstellung, der Motor liest diesen Platz nicht" : " · der Motor hält diesen Platz"}`;
  return (
    <span className="feld" role="img" aria-label={`Platz auf dem Feld: ${titel}`} title={titel}>
      <svg viewBox="0 0 128 50" preserveAspectRatio="none" aria-hidden>
        {plan.feld === "halbfeld" ? (
          <>
            <rect x="1" y="1" width="126" height="48" fill="none" stroke="rgba(244,230,196,.35)" />
            <path d="M64 1v48" stroke="rgba(244,230,196,.3)" fill="none" />
            <circle cx="64" cy="25" r="8" fill="none" stroke="rgba(244,230,196,.25)" />
            <path d="M1 12h26v26H1M1 5h14a34 20 0 010 40H1" fill="none" stroke="rgba(244,230,196,.3)" />
          </>
        ) : plan.feld === "eis" ? (
          <>
            <rect x="1" y="1" width="126" height="48" rx="12" fill="rgba(255,255,255,.05)" stroke="rgba(244,230,196,.35)" />
            <path d="M44 1v48" stroke="rgba(69,176,201,.55)" fill="none" />
            <path d="M64 1v48" stroke="rgba(244,230,196,.3)" fill="none" />
            <circle cx="64" cy="25" r="7" fill="none" stroke="rgba(244,230,196,.25)" />
            <path d="M5 21h5v8H5z" fill="none" stroke="rgba(242,160,61,.8)" />
          </>
        ) : (
          <>
            <rect x="1" y="1" width="126" height="48" fill="rgba(255,255,255,.04)" stroke="rgba(244,230,196,.35)" />
            <path d="M77 1v48" stroke="rgba(244,230,196,.5)" fill="none" />
            <path d="M20 1v48M40 1v48M60 1v48M97 1v48M117 1v48" stroke="rgba(244,230,196,.14)" fill="none" />
          </>
        )}
      </svg>
      <i className={`pt${hohl ? " hohl" : ""}`} style={{ left: `${plan.x * 100}%`, top: `${plan.y * 100}%` }} />
      {plan.gegner ? <i className={`pt g${hohl ? " hohl" : ""}`} style={{ left: `${plan.gegner.x * 100}%`, top: `${plan.gegner.y * 100}%` }} /> : null}
    </span>
  );
}

function VergleichMarke({ vergleich }: { vergleich: VorstellungVergleich | null }) {
  if (!vergleich) return null;
  if (vergleich.art === "pod") {
    return (
      <span className={`vgl${vergleich.vorn > 0 ? " vorn" : ""}`}>
        Du: vorn gegen {vergleich.vorn} von {vergleich.von}
      </span>
    );
  }
  const abstand = vergleich.abstand != null ? Math.abs(Math.round(vergleich.abstand)) : 0;
  if (vergleich.stand === "vorn")
    return (
      <span className="vgl vorn" title="Dein Wert in diesem Slot liegt über dem des Gegners">
        <Ico n="l" />
        vorn{abstand ? ` +${abstand}` : ""}
      </span>
    );
  if (vergleich.stand === "hinten")
    return (
      <span className="vgl hinten" title="Der Gegner liegt in diesem Slot vorn">
        vorn{abstand ? ` +${abstand}` : ""}
        <Ico n="r" />
      </span>
    );
  return (
    <span className="vgl" title="Gleiche Zahl auf beiden Seiten">
      <Ico n="gleich" />
      gleich
    </span>
  );
}

function SlotZelle({ slot, tafel, vergleich }: { slot: VorstellungSlot; tafel: VorstellungTafel; vergleich: VorstellungVergleich | null }) {
  return (
    <div className="slot" data-testid="arena-vorstellung-slot">
      <span className="nr">
        {tafel.zeilenName} {slot.nr}
      </span>
      <b>{slot.label}</b>
      {slot.schluesselAttribute.length > 0 ? (
        <div className="attr">
          {slot.schluesselAttribute.map((a) => (
            <i key={a}>{a}</i>
          ))}
        </div>
      ) : null}
      <div className="unten">
        {slot.feldplan && tafel.art === "duell" ? <Feldplan plan={slot.feldplan} /> : null}
        <VergleichMarke vergleich={vergleich} />
      </div>
    </div>
  );
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Figur({ zelle, blick, team }: { zelle: VorstellungZelle; blick: "east" | "west" | "south"; team: VorstellungTeam }) {
  const sprite = zelle.figurSlug ? getFigurSpriteBySlug(zelle.figurSlug) : null;
  // Ohne PixelLab-Figur: Porträt-Marke wie in der Arena; fehlt auch das Porträt (Datei 404), stehen die Initialen darunter.
  return (
    <div className={`fg${sprite ? "" : " ini"}`} data-ini={initialen(zelle.name)} style={{ ["--tf" as string]: team.farbe }}>
      {sprite ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="f" src={figurPoseUrl(sprite, blick)} alt="" />
      ) : zelle.portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="p"
          src={zelle.portraitUrl}
          alt=""
          title="Noch keine PixelLab-Figur: Porträt-Marke wie in der Arena"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
    </div>
  );
}

function bonusText(bonus: number): string {
  return `${bonus >= 0 ? "+" : "−"}${Math.abs(bonus).toFixed(1).replace(".", ",")}`;
}

function SpielerZelle({ zelle, team, seite }: { zelle: VorstellungZelle | null; team: VorstellungTeam; seite: "l" | "r" | "" }) {
  if (!zelle) {
    return (
      <div className="spz leer" data-testid="arena-vorstellung-leer">
        <span>
          Slot unbesetzt
          <small>Kader zu klein</small>
        </span>
      </div>
    );
  }
  const farbe = getClassColorToken(zelle.className);
  const klassenIcon = getClassIconSrc(zelle.className);
  const blick = seite === "l" ? "east" : seite === "r" ? "west" : "south";
  const eigen = team.eigen;
  const kartenFarbe = team.eigenInfo?.karten[0]?.farbe;
  return (
    <div
      className={`spz${seite ? ` ${seite}` : ""}${eigen ? " eigen" : ""}`}
      style={{ ["--kl" as string]: farbe ? KLASSEN_FARBE_VAR[farbe] : "var(--stumm)", ["--tf" as string]: team.farbe }}
      data-testid="arena-vorstellung-spieler"
      data-player-id={zelle.playerId}
    >
      <div className="info">
        <div className="n">{zelle.name}</div>
        <div className="kl">
          {klassenIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={klassenIcon} alt="" />
          ) : null}
          {zelle.className ?? "–"}
          {zelle.race ? <small>· {zelle.race}</small> : null}
        </div>
        {eigen && (zelle.captain || zelle.form || zelle.moral != null || zelle.karte) ? (
          <div className="chips">
            {zelle.captain ? (
              <span className="cap" title="Captain">
                C
              </span>
            ) : null}
            {zelle.form ? (
              <span
                className="form"
                title={`Form: ${zelle.form.wort}`}
                style={{ color: zelle.form.stufe > 0 ? "var(--gut)" : zelle.form.stufe < 0 ? "var(--warn)" : "var(--leise)" }}
              >
                <Ico n={zelle.form.stufe > 0 ? "auf" : zelle.form.stufe < 0 ? "ab" : "gleich"} />
                {zelle.form.wort}
              </span>
            ) : null}
            {zelle.moral != null ? <BcMoralGesicht wert={zelle.moral} groesse={18} /> : null}
            {zelle.karte ? (
              <span
                className="chip karte"
                style={{ ["--kf" as string]: kartenFarbe ? KLASSEN_FARBE_VAR[kartenFarbe] : "var(--gold)" }}
                title="Formkarte: Wert dieses Spielers aus calculateFormModifierForSide"
              >
                Karte {zelle.karte.wert > 0 ? "+" : ""}
                {zelle.karte.wert}
                {zelle.karte.farbbonus ? " · Farbbonus" : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <Figur zelle={zelle} blick={blick} team={team} />
      <div className="wert">
        <small>Eignung</small>
        <b className="t">{zelle.eignung ?? "–"}</b>
        <u title={zelle.slotBonus != null && zelle.roh != null ? `roh ${Math.round(zelle.roh)} ${bonusText(zelle.slotBonus)} Slot-Bonus` : undefined}>
          {zelle.slotBonus != null ? `im Slot · ${bonusText(zelle.slotBonus)}` : "im Slot"}
        </u>
      </div>
    </div>
  );
}

export function ArenaVorstellung({
  disziplinName,
  disziplinNr,
  disziplinAnzahl,
  tafel,
  kulisse,
  listenGesperrt = true,
  hinweis,
  onStart,
  onQuickSim,
  quickSimGesperrt,
}: {
  disziplinName: string;
  disziplinNr: number;
  disziplinAnzahl: number;
  tafel: VorstellungTafel;
  /** Kulissenbild der Disziplin (hinter der Tafel) und ihr Name. */
  kulisse?: { bild: string | null; label: string | null } | null;
  listenGesperrt?: boolean;
  /** Satz zur Herkunft ("gezeigt = gebucht"), steht als Tooltip am Hinweis im Fuss. */
  hinweis: string;
  onStart: () => void;
  onQuickSim: () => void;
  quickSimGesperrt: boolean;
}) {
  const art = tafel.art;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const icon = getDisciplineIconSrc(tafel.disciplineId, disziplinName);
  const k = Math.max(tafel.k, 1);
  const waehle = (nr: number) => setGewaehlt((alt) => (alt === nr ? null : nr));
  const slotText = gewaehlt != null ? tafel.slots[gewaehlt - 1] : null;
  const zeilen = tafel.slots.map((slot, i) => {
    const vergleich = tafel.vergleich[i] ?? null;
    return (
      <div
        key={slot.slotIndex}
        className={`zeile${gewaehlt === slot.nr ? " wahl" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={gewaehlt === slot.nr}
        data-slot={slot.nr}
        data-testid="arena-vorstellung-zeile"
        onClick={() => waehle(slot.nr)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            waehle(slot.nr);
          }
        }}
      >
        {art === "duell" ? (
          <>
            {tafel.teams[0] ? <SpielerZelle zelle={tafel.teams[0].zellen[i] ?? null} team={tafel.teams[0]} seite="l" /> : <div />}
            <SlotZelle slot={slot} tafel={tafel} vergleich={vergleich} />
            {tafel.teams[1] ? <SpielerZelle zelle={tafel.teams[1].zellen[i] ?? null} team={tafel.teams[1]} seite="r" /> : <div />}
          </>
        ) : (
          <>
            <SlotZelle slot={slot} tafel={tafel} vergleich={vergleich} />
            {tafel.teams.map((team) => (
              <SpielerZelle key={team.teamId} zelle={team.zellen[i] ?? null} team={team} seite="" />
            ))}
          </>
        )}
      </div>
    );
  });
  const standardHinweis =
    art === "pod"
      ? "Gleiche Zeile = gleicher Slot in allen vier Teams."
      : (tafel.zeilenHinweis ?? "Gleiche Zeile = gleicher Slot auf beiden Seiten.");
  return (
    <div className="oly-vst-huelle" data-testid="arena-vorstellung" data-art={art}>
      <div className="oly-vst" style={kulisse?.bild ? { ["--bild" as string]: `url(${kulisse.bild})` } : undefined}>
        <div className="bild" aria-hidden />
        <div className="kopf">
          <div className="dz">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" />
            ) : null}
            <div>
              <div className="gk">
                Disziplin {disziplinNr} von {disziplinAnzahl} · {art === "pod" ? "Vierergruppe · jeder gegen jeden" : "Duell"}
              </div>
              <h1>{disziplinName}</h1>
            </div>
          </div>
          <div className="schema" data-testid="arena-vorstellung-schema">
            {punkteSchema(art).map((eintrag) => (
              <div key={eintrag.label}>
                <small>{eintrag.label}</small>
                <b className="t">{eintrag.punkte} Pkt</b>
              </div>
            ))}
          </div>
          <div className="re">
            {art === "pod" ? (
              <span className="marke gold" data-testid="arena-podmarke" title="Vierergruppe: vier Teams gleichzeitig in einer Arena, Platz 1 bis 4">
                4 Teams · Pod
              </span>
            ) : null}
            {kulisse?.label ? (
              <span className="marke">
                <Ico n="ort" />
                {kulisse.label}
              </span>
            ) : null}
            {listenGesperrt ? (
              <span className="marke zu">
                <Ico n="schloss" />
                Einsatzlisten gesperrt
              </span>
            ) : null}
          </div>
        </div>
        {art === "pod" ? (
          <div className="tafel pod" data-testid="arena-vorstellung-tafel">
            <div className="kz">
              <div className="slot-kopf">
                <span className="gk">{k} Slots</span>
                <b>
                  Zeile = {tafel.zeilenName}
                  <br />
                  Spalte = Team
                </b>
              </div>
              {tafel.teams.map((team) => (
                <Teamkopf key={team.teamId} team={team} disziplinName={disziplinName} />
              ))}
            </div>
            <div className="zeilen" style={{ ["--k" as string]: k }}>
              {zeilen}
            </div>
          </div>
        ) : (
          <div className="tafel duell" data-testid="arena-vorstellung-tafel">
            {tafel.teams[0] ? <Teamtafel team={tafel.teams[0]} disziplinName={disziplinName} /> : <div />}
            <div className="zeilen" style={{ ["--k" as string]: k }}>
              {zeilen}
            </div>
            {tafel.teams[1] ? <Teamtafel team={tafel.teams[1]} disziplinName={disziplinName} /> : <div />}
          </div>
        )}
        <div className="fuss">
          <span className="hin" title={hinweis}>
            {slotText ? (
              <>
                <b>
                  {tafel.zeilenName} {slotText.nr} · {slotText.label}:
                </b>{" "}
                {slotText.text}
              </>
            ) : (
              <>
                <b>{standardHinweis}</b> Klick auf eine Zeile erklärt die Rolle.
              </>
            )}
          </span>
          <div className="leg">
            <span>
              <i style={{ background: "var(--k-red)" }} />
              POW
            </span>
            <span>
              <i style={{ background: "var(--k-green)" }} />
              SPE
            </span>
            <span>
              <i style={{ background: "var(--k-blue)" }} />
              MEN
            </span>
            <span>
              <i style={{ background: "var(--k-yellow)" }} />
              SOC
            </span>
            <span>Eignung: roh + Slot-Bonus, Gegner ohne Form, Moral, Karte</span>
          </div>
          <button type="button" className="btn neben" data-testid="arena-vorstellung-quicksim" onClick={onQuickSim} disabled={quickSimGesperrt}>
            <Ico n="vor" />
            Quick-Sim
          </button>
          <button type="button" className="btn haupt" data-testid="arena-vorstellung-start" onClick={onStart}>
            <Ico n="play" />
            Zur Arena
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Die Vorstellung aus dem Spielstand: baut die Tafel (`baueVorstellungsTafel`) einmal je Eingabe und reicht sie
 * an `ArenaVorstellung`. Eigenes Team = `ownTeamId` (aktives Team des Managers), nie ein fester Name.
 */
export function ArenaVorstellungAusSpielstand({
  gameState,
  teamIds,
  ownTeamId,
  disciplineId,
  matchdayId,
  art,
  attributeSheets,
  kulisseVarianteId,
  ...rest
}: {
  gameState: GameState;
  teamIds: readonly string[];
  ownTeamId: string | null | undefined;
  disciplineId: string;
  matchdayId: string | null | undefined;
  art: "duell" | "pod";
  attributeSheets?: ReadonlyMap<string, Player["attributeSheetStats"]> | null;
  kulisseVarianteId?: string | null;
  disziplinName: string;
  disziplinNr: number;
  disziplinAnzahl: number;
  hinweis: string;
  onStart: () => void;
  onQuickSim: () => void;
  quickSimGesperrt: boolean;
}) {
  const teamSchluessel = teamIds.join("|");
  const tafel = useMemo(
    () =>
      baueVorstellungsTafel({
        gameState,
        teamIds: teamSchluessel.split("|").filter(Boolean),
        ownTeamId,
        disciplineId,
        matchdayId,
        art,
        attributeSheets,
      }),
    [gameState, teamSchluessel, ownTeamId, disciplineId, matchdayId, art, attributeSheets],
  );
  const kulisse = kulisseFuerVorstellung(disciplineId, kulisseVarianteId);
  return <ArenaVorstellung {...rest} tafel={tafel} kulisse={kulisse} listenGesperrt={tafel.listenGesperrt} />;
}
