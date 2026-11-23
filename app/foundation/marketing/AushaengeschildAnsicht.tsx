"use client";

/**
 * AUSHAENGESCHILD (23.11., Mockup public/mockups/marketing-werbeklausel-aushaengeschild-23-11.html, Ansichten „Marketing-Seite“ und
 * „Mehrspieler“). Die sechs besten Spieler mit Marketability, Werbegeld und Team-Anteil jetzt und als Gesicht (+25 %, +8 Punkte), die Wirkung
 * auf das Team (Netz und 65 % gelten weiter), Marken KI-WAHL und VORSAISON, Bestaetigen sperrt bis Saisonende, Kachel „Vorlieben wachsen“.
 * Alle Zahlen kommen aus `gesichtKandidaten` (dieselbe Rechnung wie die KI-Wahl und die Buchung). Geschrieben wird nur ueber den Server
 * (`POST /api/marketing`, Schreibpruefung am Team); andere Menschen sehen die Seite des aktiven Teams nur, wenn es ihr eigenes ist.
 */
import { useMemo, useState, type CSSProperties } from "react";

import { gespielteSpieltage } from "@/lib/contracts/verlaengerung-in-saison";
import type { GameState } from "@/lib/data/olyDataTypes";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { gesichtKandidaten, gewaehltesAushaengeschild, kaderEinesTeams, kiAushaengeschild } from "@/lib/marketing/marketing-kontext";
import { pruefeAushaengeschildWahl } from "@/lib/marketing/marketing-aushaengeschild";
import { KLASSEN_FARBE } from "@/lib/marketing/marketing-daten";
import { gueltigerMarketingStempel, werbeklauselAktiv } from "@/lib/marketing/marketing-regel";
import { MARKETING_KONFIG } from "@/lib/marketing/marketing-modell";
import { marketingTeamUebersicht } from "@/lib/marketing/marketing-team";
import { moralOhneWerbung } from "@/lib/morale/player-morale-service";
import type { MarketingAktionFn } from "@/lib/marketing/marketing-aktion-typen";

const MINUS = "−";
const FARB_VAR = ["var(--bc-p1)", "var(--bc-p4)", "var(--bc-p5)", "var(--bc-p6)"];

function z1(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r < 0 ? MINUS : ""}${Math.abs(r).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}
function z2(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `${r < 0 ? MINUS : ""}${Math.abs(r).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const C1 = (v: number) => `${z1(v)} C`;
const SPT = 20;
function vz2(v: number): string {
  const r = Math.round(v * 100) / 100;
  return `${r > 0 ? "+" : r < 0 ? MINUS : "±"}${z2(Math.abs(r))}`;
}
const ton = (v: number) => (v > 0.004 ? "bc-plus" : v < -0.004 ? "bc-minus" : "bc-null");

function Gr({ gross, klein, klasse }: { gross: string; klein?: React.ReactNode; klasse?: string }) {
  return (
    <span className="ag-gr fin-re">
      <b className={`bc-t ${klasse ?? ""}`}>{gross}</b>
      {klein ? <small>{klein}</small> : null}
    </span>
  );
}

export type AushaengeschildAnsichtProps = {
  gameState: GameState;
  teamId: string;
  onAktion?: MarketingAktionFn;
  /** Darf der Aufrufer fuer dieses Team schreiben (eigener Manager)? Sonst nur lesen. */
  kannSchreiben: boolean;
  startWahl?: string | null;
};

export default function AushaengeschildAnsicht({ gameState, teamId, onAktion, kannSchreiben, startWahl = null }: AushaengeschildAnsichtProps) {
  const aktiv = werbeklauselAktiv(gameState);
  const stempel = gueltigerMarketingStempel(gameState);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const kandidaten = useMemo(
    () => (aktiv ? gesichtKandidaten(gameState, teamId, (id) => moralOhneWerbung(gameState, id, teamId)) : []),
    [aktiv, gameState, teamId],
  );
  const kader = useMemo(() => new Map(kaderEinesTeams(gameState, teamId).map((k) => [k.player.id, k.player] as const)), [gameState, teamId]);
  const ki = aktiv ? kiAushaengeschild(gameState, teamId) : null;
  const gewaehlt = aktiv ? gewaehltesAushaengeschild(gameState, teamId) : null;
  const gesperrt = Boolean(gewaehlt?.gesperrt);
  const settings = gameState.seasonState?.teamControlSettings?.[teamId];
  const delegiert = isBereichDelegiert(settings, "sponsor");
  const vorsaison = stempel?.gesichtVorsaison?.[teamId] ?? null;
  const pruefung = aktiv ? pruefeAushaengeschildWahl(gameState, teamId, null) : { ok: false as const, reason: "regel_aus", meldung: "" };
  const spieltage = gespielteSpieltage(gameState);
  const liste = [...kandidaten].sort((a, b) => b.jetzt.marketability - a.jetzt.marketability);
  const wirksam = gewaehlt?.playerId ?? ki;
  const [sel, setSel] = useState<string | null>(startWahl ?? wirksam);
  const aktuell = liste.find((k) => k.playerId === (sel ?? wirksam)) ?? liste[0] ?? null;
  const u = marketingTeamUebersicht(gameState, teamId);
  const vorlieben = stempel?.klassenVorliebe?.[teamId] ?? null;

  if (!aktiv) {
    return (
      <div className="fin-hinweis" data-testid="ag-nicht-aktiv">
        <span>
          <b>Das Aushängeschild gilt in dieser Saison noch nicht.</b> Die neue Marketing-Regel (Werbeklausel und Aushängeschild) startet mit dem nächsten Saisonwechsel, in einem neuen Spiel ab Saison 1.
        </span>
      </div>
    );
  }
  if (!aktuell) return <div className="fin-leer">Dein Kader ist leer.</div>;

  const spieler = kader.get(aktuell.playerId);
  const zweiteSaison = vorsaison === aktuell.playerId;
  const kannWaehlen = kannSchreiben && Boolean(onAktion) && pruefung.ok;
  const warum = !kannSchreiben
    ? "Nur lesen: das Aushängeschild setzt der Manager dieses Teams."
    : gesperrt
      ? "Gesperrt bis Saisonende."
      : !pruefung.ok
        ? pruefung.meldung
        : delegiert
          ? "Überschreibt die KI-Wahl. Danach gesperrt."
          : "Nach dem Bestätigen gesperrt.";
  const wirkungKasse = aktuell.alsGesicht.ansTeam - aktuell.jetzt.ansTeam;
  const wirkungMoral = aktuell.alsGesicht.moralZuschlag - aktuell.jetzt.moralZuschlag;

  async function bestaetigen() {
    if (!onAktion || !aktuell || laeuft) return;
    setLaeuft(true);
    const r = await onAktion({ aktion: "aushaengeschild", playerId: aktuell.playerId });
    setMeldung(r.meldung);
    setLaeuft(false);
  }

  return (
    <div className="fin-work ag" data-testid="aushaengeschild-ansicht">
      <section className="fin-pan" aria-label="Aushängeschild wählen">
        <div className="fin-pk">
          <h2>Aushängeschild der Saison</h2>
          <span className="fin-hin">eines unter deinen sechs besten Spielern · Zeile anklicken, rechts bestätigen</span>
          <span className="fin-sp" />
        </div>
        <div className="fin-kb">
          {gesperrt && gewaehlt ? (
            <div className="ag-banner is-gut" data-testid="ag-gesperrt">
              <b>{kader.get(gewaehlt.playerId)?.name ?? "Dein Aushängeschild"} ist das Gesicht der Saison.</b> Gesperrt bis Saisonende; ein Wechsel ist erst nach dem Saisonwechsel wieder möglich.
            </div>
          ) : (
            <div className="ag-banner" data-testid="ag-offen">
              <b>{delegiert ? "Delegiert: die KI wählt" : "Noch nicht gewählt."}</b>{" "}
              {delegiert ? "Solange du nichts wählst, gilt die KI-Wahl" : "Ohne Wahl setzt die KI-Regel zum ersten Spieltag"}{" "}
              <b>{ki ? (kader.get(ki)?.name ?? "") : ""}</b> (höchster Zusatzertrag fürs Team unter den besten sechs).{" "}
              {spieltage > 0 ? "Der erste Spieltag ist gespielt, die Wahl der KI gilt bis zum Saisonende." : "Du kannst bis zum ersten Spieltag überschreiben."}
            </div>
          )}
          <div className="ag-lupe">
            <div><small>Marketing in der Kasse</small><strong className="bc-t">{C1(u.ansKasse)}</strong><em>{z2(u.ansKasse / SPT)} C je Spieltag</em></div>
            <div><small>ans Team (Spieler)</small><strong className="bc-t">{C1(u.teamAnteile)}</strong><em>Teammarke {C1(u.teammarke)} extra</em></div>
            <div><small>an die Spieler</small><strong className="bc-t">{C1(u.spielerAnteile)}</strong><em>hebt die Moral</em></div>
            <div><small>Wahl: Zusatzertrag</small><strong className={`bc-t ${ton(wirkungKasse)}`}>{vz2(wirkungKasse)} C</strong><em>Moral {wirkungMoral > 0 ? `+${wirkungMoral}` : wirkungMoral === 0 ? "unverändert" : wirkungMoral}</em></div>
          </div>
          <div className="fin-tl ag-tabelle">
            <div className="fin-th ag-cols">
              <span>Spieler (beste sechs)</span>
              <span className="fin-re">Marketability</span>
              <span className="fin-re">Werbegeld jetzt<br />je Saison</span>
              <span className="fin-re">Team-Anteil</span>
              <span className="fin-re ag-g">Als Gesicht<br />Werbegeld +25 %</span>
              <span className="fin-re ag-g">Team-Anteil</span>
              <span className="fin-re ag-g">ans Team<br />je Saison</span>
              <span className="fin-re ag-g">Moral<br />Zuschlag</span>
            </div>
            {liste.map((k) => {
              const p = kader.get(k.playerId);
              const farbe = p ? KLASSEN_FARBE[p.className] : undefined;
              const istSel = aktuell.playerId === k.playerId;
              const fest = gesperrt && gewaehlt?.playerId === k.playerId;
              const zu = gesperrt && !fest;
              const dTeam = k.alsGesicht.ansTeam - k.jetzt.ansTeam;
              return (
                <button
                  key={k.playerId}
                  type="button"
                  className={`fin-tz ag-cols ag-zeile${istSel ? " is-gew" : ""}${fest ? " is-fest" : ""}${zu ? " is-zu" : ""}`}
                  style={{ "--pc": farbe == null ? "var(--bc-leise)" : FARB_VAR[farbe] } as CSSProperties}
                  onClick={() => !gesperrt && setSel(k.playerId)}
                  data-testid={`ag-zeile-${k.playerId}`}
                  aria-pressed={istSel}
                >
                  <span className="mk-name">
                    <b>{p?.name ?? k.playerId}</b>
                    <small>
                      <i className="mk-kl" />
                      {p?.className} · {p?.race}
                      {k.playerId === ki ? <span className="mk-marke is-neu">KI-WAHL</span> : null}
                      {k.playerId === vorsaison ? <span className="mk-marke">VORSAISON</span> : null}
                      {fest ? <span className="mk-marke is-po">{gewaehlt?.von === "ki" ? "KI" : "AUSHÄNGESCHILD"} · GESPERRT</span> : null}
                    </small>
                  </span>
                  <Gr gross={String(Math.round(k.jetzt.marketability))} />
                  <Gr gross={C1(k.jetzt.werbegeld)} klein={`${z2(k.jetzt.werbegeld / SPT)} C / Spieltag`} />
                  <Gr gross={`${k.jetzt.teamAnteilProzent} %`} klein={k.jetzt.netzGreift ? <span className="ag-netz">Netz greift</span> : undefined} />
                  <Gr gross={C1(k.alsGesicht.werbegeld)} klein={`${vz2(k.alsGesicht.werbegeld - k.jetzt.werbegeld)} C`} />
                  <Gr
                    gross={`${k.alsGesicht.teamAnteilProzent} %`}
                    klein={
                      k.alsGesicht.teamAnteilRoh > 65 && k.jetzt.teamAnteilRoh >= 65 ? (
                        <span className="ag-netz">Grenze 65 %: +8 ohne Wirkung</span>
                      ) : (
                        `${k.alsGesicht.teamAnteilProzent - k.jetzt.teamAnteilProzent >= 0 ? "+" : MINUS}${Math.abs(k.alsGesicht.teamAnteilProzent - k.jetzt.teamAnteilProzent)} Pkt`
                      )
                    }
                  />
                  <Gr
                    gross={C1(k.alsGesicht.ansTeam)}
                    klein={
                      <>
                        <span className={ton(dTeam)}>{vz2(dTeam)} C</span>
                        {k.alsGesicht.netzGreift ? <span className="ag-netz"> · Netz</span> : null}
                      </>
                    }
                  />
                  <Gr gross={`+${k.alsGesicht.moralZuschlag}`} klein={k.alsGesicht.moralZuschlag !== k.jetzt.moralZuschlag ? `vorher +${k.jetzt.moralZuschlag}` : "unverändert"} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="fin-kf">
          <span>„jetzt“ = ohne Gesicht, „als Gesicht“ = Werbegeld +25 % und Team-Anteil +8 Punkte. Spieltagswerte klein darunter.</span>
          <span className="fin-sp" />
          <span>Sicherheitsnetz (22 / 25 / 28 % des Gehalts je Klausel) und Grenze {MARKETING_KONFIG.teamAnteilMax} % gelten weiter.</span>
        </div>
      </section>
      <aside className="fin-pan" aria-label="Vorschau und Bestätigen">
        <div className="fin-pk">
          <h2>{spieler?.name ?? "Spieler"} als Gesicht</h2>
          <span className="fin-sp" />
          <span className="fin-hin">Vorschau</span>
        </div>
        <div className="fin-kb">
          <div className="mk-kb">
            <div className="mk-frage">
              <h4>{C1(aktuell.jetzt.werbegeld)} → {C1(aktuell.alsGesicht.werbegeld)} Werbegeld</h4>
              <p className="mk-klein">
                +25 % je Saison · Team-Anteil {aktuell.jetzt.teamAnteilProzent} → {aktuell.alsGesicht.teamAnteilProzent} %
                {dTeamText(aktuell.alsGesicht.ansTeam - aktuell.jetzt.ansTeam)}
              </p>
            </div>
            <div className="mk-frage">
              <h4>Team-Anteil mit Wahl</h4>
              <div className="mk-zl"><span>Ausgangswert</span><b className="bc-t">{MARKETING_KONFIG.teamAnteilBasis} %</b></div>
              {aktuell.alsGesicht.bausteine.map((b) => (
                <div className={`mk-zl${b.id === "gesicht" ? " ag-neu" : ""}`} key={b.id}>
                  <span>{b.label}: {b.text}</span>
                  <b className={`bc-t ${ton(b.punkte)}`}>{b.punkte === 0 ? "±0" : `${b.punkte > 0 ? "+" : MINUS}${Math.abs(b.punkte)}`}</b>
                </div>
              ))}
              <div className="mk-zl is-su"><span>Team-Anteil (begrenzt auf 15 bis 65 %)</span><b className="bc-t">{aktuell.alsGesicht.teamAnteilProzent} %</b></div>
            </div>
            <div className="mk-frage ag-kachel" data-testid="ag-vorlieben">
              <h4>Vorlieben wachsen</h4>
              <p className="mk-klein">
                {zweiteSaison
                  ? <>Zweite Saison in Folge. Nach dem Saisonwechsel zählt die Klasse <b>{spieler?.className}</b> zu den Vorlieben der Fans (ein Zugang je Team, nur Klassen; ein neuer ersetzt den früheren).</>
                  : vorsaison
                    ? <>Anderes Gesicht als in der Vorsaison ({kader.get(vorsaison)?.name ?? "früherer Spieler"}): der Zähler beginnt neu bei 1 von 2.</>
                    : <>Erste Wahl dieses Teams: Zähler 1 von 2.</>}
              </p>
              <div className="ag-zaehler">
                <i className={zweiteSaison ? "is-ok" : "is-an"} />
                <i className={zweiteSaison ? "is-an" : ""} />
                <span>{zweiteSaison ? "Saison 2 von 2" : "Saison 1 von 2"}</span>
                {vorlieben ? <span className="ag-hat">Gewachsen: {vorlieben.klasse} (seit {vorlieben.seitSaisonId.replace(/\D+/g, "") ? `S${vorlieben.seitSaisonId.replace(/\D+/g, "")}` : vorlieben.seitSaisonId})</span> : null}
              </div>
            </div>
            <div className="mk-frage ag-kachel">
              <h4>Regeln</h4>
              <p className="mk-klein">
                Einmal je Saison, nur unter den besten sechs, nur vor dem ersten Spieltag. <b>Verletzt:</b> der Zuschlag eines verletzten Gesichts ruht (Werbegeld zählt zur Hälfte). Andere Menschen sehen die Wahl, setzen kann sie nur der Manager des Teams.
              </p>
            </div>
          </div>
        </div>
        <div className="fin-kf ag-fuss">
          <span className="fin-hin" data-testid="ag-warum">{meldung ?? warum}</span>
          <span className="fin-sp" />
          <button type="button" className="fin-btn is-ja ag-knopf" disabled={!kannWaehlen || laeuft} onClick={() => void bestaetigen()} data-testid="ag-bestaetigen">
            {gesperrt ? "Gesperrt" : delegiert && aktuell.playerId === ki ? "KI-Wahl bestätigen" : "Bestätigen"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function dTeamText(d: number): string {
  return Math.abs(d) < 0.005 ? " · ans Team unverändert (Netz oder Grenze)" : ` · ans Team ${vz2(d)} C`;
}
