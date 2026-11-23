"use client";

/**
 * ARENA & FANS (22.11., Mockup public/mockups/finanzen-modern-18-11.html, Runde 3 bis 5; Bau docs/design/arena-tickets-medaillen-22-11.md).
 * Eigene Komponente, die FinanzenModern nur einhaengt. Alle Zahlen kommen aus `lib/arena/*` und `lib/medaillen/*` (dieselbe Rechnung wie die
 * Buchung, gezeigt = gebucht); geschrieben wird nur ueber `POST /api/arena` (Server, `authorizeServerRoomWrite`).
 * Karten: Fans & Auslastung, Dauerkarten, Arena-Ausbau von Hand (Schritt-Auswahl je Bereich, "kostet / bringt ca. / bezahlt nach"),
 * Medaillen, Ausbau-Leiter je Bereich.
 */

import { useMemo, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { ArenaAktionFn } from "@/lib/arena/arena-aktion-typen";
import { ausbauErlaubt, BEREICH_NAME } from "@/lib/arena/arena-ausbau";
import { bewerteKiArena } from "@/lib/arena/arena-ki-bewertung";
import {
  BAU_STAFFEL,
  DAUERKARTEN_ANTEIL,
  DAUERKARTEN_LABEL,
  DAUERKARTEN_RABATT,
  DAUERKARTEN_STUFEN,
  OBERGRENZE,
  SCHRITT_GROESSE,
  ausbauVorschau,
  dauerkartenGeld,
  fanMaximum,
  gesamtPlaetze,
  leiterZeile,
  maxSchritte,
  preisJePlatz,
  rechneHeimspiel,
  schritteGebaut,
  volleHausSaison,
} from "@/lib/arena/arena-modell";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import {
  heimSpieltage,
  heimspieleDerSaison,
  holeArenaStand,
  istLiga1,
  letzteDreiSchnitt,
  ligaTabellenAnteil,
  nachfrageHeute,
  sponsorStufen,
} from "@/lib/arena/arena-stand";
import { ARENA_BEREICHE, type ArenaBereich, type DauerkartenStufe } from "@/lib/arena/arena-typen";
import { FARBE_LABEL, medaillenGeldDerSaison } from "@/lib/medaillen/medaillen-modell";
import { gueltigerMedaillenStempel, medaillenAktiv } from "@/lib/medaillen/medaillen-regel";

import "./arena-ansicht.css";

const zahl = (v: number, st = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: st, maximumFractionDigits: st });
const ganz = (v: number) => Math.round(v).toLocaleString("de-DE");
const C = (v: number, st = 2) => `${zahl(v, st)} C`;
const pct = (v: number) => `${Math.round(v * 100)} %`;
const saisons = (v: number | null) => (v == null ? "nie" : `${zahl(v, 1)} Saisons`);

export type ArenaAnsichtProps = {
  gameState: GameState;
  teamId: string;
  onAktion?: ArenaAktionFn;
  kannSchreiben: boolean;
};

export default function ArenaAnsicht({ gameState, teamId, onAktion, kannSchreiben }: ArenaAnsichtProps) {
  const aktiv = arenaAktiv(gameState);
  const [plan, setPlan] = useState<Record<ArenaBereich, number>>({ steh: 0, sitz: 0, loge: 0 });
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const stand = useMemo(() => holeArenaStand(gameState, teamId), [gameState, teamId]);
  const liga1 = istLiga1(gameState, teamId);
  const heim = heimspieleDerSaison(gameState, teamId);
  const sponsor = sponsorStufen(gameState).get(teamId) ?? 0.5;
  const tabelle = ligaTabellenAnteil(gameState, teamId);
  const schnitt = letzteDreiSchnitt(stand);
  const nachfrage = useMemo(() => nachfrageHeute(gameState, teamId), [gameState, teamId]);
  const nachfrageSchnitt = schnitt?.nachfrage ?? nachfrage;
  const auslastung = schnitt?.auslastung ?? rechneHeimspiel({ plaetze: stand.plaetze, fanbasis: stand.fanbasis, stimmung: stand.stimmung, liga1, sponsorStufe: sponsor, tabellenAnteil: tabelle }).auslastung;
  const vorschau = useMemo(
    () => ausbauVorschau({ plaetze: stand.plaetze, schritte: plan, fanbasis: stand.fanbasis, stimmung: stand.stimmung, liga1, sponsorStufe: sponsor, tabellenAnteil: tabelle, heimspiele: heim }),
    [stand, plan, liga1, sponsor, tabelle, heim],
  );
  const kasse = gameState.teams.find((t) => t.teamId === teamId)?.cash ?? 0;
  const gespielt = (gameState.seasonState.spieltagFinanzen ?? []).some((z) => z.seasonId === gameState.season.id && z.teamId === teamId);
  const dauer = stand.dauerkarten?.seasonId === stand.seasonId ? stand.dauerkarten : null;
  const kiHinweis = useMemo(() => bewerteKiArena(gameState, teamId), [gameState, teamId]);
  const kannBauen = kannSchreiben && Boolean(onAktion) && aktiv && ausbauErlaubt(gameState);
  const dauerKannWaehlen = kannSchreiben && Boolean(onAktion) && aktiv && !gespielt;
  const naechstesHeim = heimSpieltage(gameState, teamId).find((i) => i >= (gameState.season.currentMatchday ?? 1)) ?? null;
  const stempel = gueltigerMedaillenStempel(gameState);
  const medGeld = medaillenGeldDerSaison(gameState, teamId);
  const vergabe = gameState.seasonState.medaillenVergabe;
  const meineMedaillen = (vergabe?.medaillen ?? []).filter((z) => z.teamId === teamId);
  const meineFarben = (vergabe?.farbMeister ?? []).filter((z) => z.teamId === teamId);

  if (!aktiv) {
    return (
      <div className="fin-leer" data-testid="arena-aus">
        <b>Die neue Arena gilt ab der nächsten Saison.</b> In dieser Saison zählt noch das Gebäude „Arena Upgrade“; beim Saisonwechsel wird es auf Platzarten
        (Steh, Sitz, Loge) abgebildet. Das Gebäude liegt unter Gebäude.
      </div>
    );
  }

  const aendere = (b: ArenaBereich, d: number) => setPlan((p) => ({ ...p, [b]: Math.max(0, Math.min(maxSchritte(b) - schritteGebaut(b, stand.plaetze[b]), p[b] + d)) }));
  const absenden = async () => {
    if (!onAktion || laeuft) return;
    setLaeuft(true);
    const r = await onAktion({ aktion: "ausbau", schritte: plan });
    setLaeuft(false);
    setMeldung({ ok: r.ok, text: r.meldung });
    if (r.ok) setPlan({ steh: 0, sitz: 0, loge: 0 });
  };
  const waehleDauer = async (stufe: DauerkartenStufe) => {
    if (!onAktion || !dauerKannWaehlen) return;
    const r = await onAktion({ aktion: "dauerkarten", stufe });
    setMeldung({ ok: r.ok, text: r.meldung });
  };
  const wenigVoll = ARENA_BEREICHE.filter((b) => vorschau.zeilen.find((z) => z.bereich === b)?.schritte && vorschau.zeilen.find((z) => z.bereich === b)?.nichtVoll);
  const geplant = ARENA_BEREICHE.some((b) => plan[b] > 0);
  const empfohlen = kiHinweis ? ARENA_BEREICHE.filter((b) => (kiHinweis.schritte[b] ?? 0) > 0) : [];
  const dauerGeldStufen = DAUERKARTEN_STUFEN.map((s) => dauerkartenGeld(stand.plaetze, s, liga1, heim));
  const voll = volleHausSaison(stand.plaetze, liga1, heim);
  const letztes = stand.heimspiele[stand.heimspiele.length - 1] ?? null;

  return (
    <div className="arena-gr" data-testid="arena-ansicht">
      <div className="fin-rech is-gross is-voll arena-kopf" style={{ margin: 0 }}>
        <div>
          <small>Plätze</small>
          <strong className="bc-t">{ganz(gesamtPlaetze(stand.plaetze))}</strong>
        </div>
        <div>
          <small>Fanbasis · Maximum</small>
          <strong className="bc-t">{ganz(stand.fanbasis)} · {ganz(fanMaximum(stand.plaetze))}</strong>
        </div>
        <div>
          <small>Stimmung</small>
          <strong className="bc-t">{Math.round(stand.stimmung)}</strong>
        </div>
        <div className="is-su">
          <small>Volles Haus je Saison</small>
          <strong className="bc-t">{C(voll)}</strong>
        </div>
      </div>

      <div className="arena-zeile">
        <section className="fin-sd arena-ausbau" data-testid="arena-ausbau">
          <div className="fin-kopf">
            Arena · Ausbau von Hand<small>{ganz(gesamtPlaetze(stand.plaetze))} von {ganz(gesamtPlaetze(OBERGRENZE))} Plätzen</small>
          </div>
          <div className="fin-in">
            <div className="arena-hoch">
              <b className="bc-t">{schnitt ? Math.round((ARENA_BEREICHE.reduce((s, b) => s + auslastung[b] * stand.plaetze[b], 0) / Math.max(1, gesamtPlaetze(stand.plaetze))) * 100) : "–"}</b>
              <span>{schnitt ? `% · letzte ${schnitt.n} Heimspiele` : "% · noch kein Heimspiel"}</span>
              {naechstesHeim ? <span>nächstes Heimspiel: Spieltag {naechstesHeim}</span> : null}
            </div>
            {ARENA_BEREICHE.map((b) => {
              const z = vorschau.zeilen.find((x) => x.bereich === b)!;
              const a = auslastung[b] ?? 0;
              return (
                <div className="arena-bereich" key={b} data-testid={`arena-${b}`}>
                  <span className={`arena-punkt is-${b}`} />
                  <span className="arena-name">{BEREICH_NAME[b]}</span>
                  <span className="arena-pl bc-t">{ganz(stand.plaetze[b])}</span>
                  <span className="arena-balken" title={`Nachfrage ${ganz(nachfrageSchnitt[b])}`}>
                    <i className={`is-${b}`} style={{ width: `${Math.round(Math.min(1, a) * 100)}%` }} />
                    <u style={{ left: "90%" }} />
                  </span>
                  <span className="arena-prozent bc-t">{stand.plaetze[b] > 0 ? pct(a) : "–"}</span>
                  <span className="arena-regler">
                    <button type="button" aria-label={`${BEREICH_NAME[b]} weniger`} disabled={plan[b] <= 0} onClick={() => aendere(b, -1)}>−</button>
                    <b className="bc-t">+{ganz(plan[b] * SCHRITT_GROESSE[b])}</b>
                    <button type="button" aria-label={`${BEREICH_NAME[b]} mehr`} disabled={z.amLimit} onClick={() => aendere(b, 1)}>+</button>
                  </span>
                </div>
              );
            })}
            <div className="fin-rek"><span>Kostet <small>{ARENA_BEREICHE.filter((b) => plan[b] > 0).map((b) => `${plan[b]} × ${b === "steh" ? "Steh" : b === "sitz" ? "Sitz" : "Loge"}`).join(" · ") || "Schritte wählen · Investitionstopf"}</small></span><b className="bc-t minus">{geplant ? `−${zahl(vorschau.kosten)} C` : "–"}</b></div>
            <div className="fin-rek"><span>Bringt ca. <small>wenn die Fans kommen · volles Haus {geplant ? `+${zahl(vorschau.nettoVoll)} C` : "–"}</small></span><b className="bc-t plus">{geplant ? `${vorschau.nettoErwartet >= 0 ? "+" : "−"}${zahl(Math.abs(vorschau.nettoErwartet))} C je Saison` : "–"}</b></div>
            <div className="fin-rek"><span>Bezahlt nach <small>{geplant ? `volles Haus ${saisons(vorschau.bezahltVoll)}` : "erwartet / volles Haus"}</small></span><b className="bc-t">{geplant ? (vorschau.bezahltErwartet == null ? "nie" : `rund ${zahl(vorschau.bezahltErwartet, 1)} Saisons`) : "–"}</b></div>
          </div>
          <div className="fin-fuss arena-fuss">
            <span className="fin-txt" data-testid="arena-hinweis">
              {wenigVoll.length > 0
                ? `${wenigVoll.map((b) => BEREICH_NAME[b]).join(", ")} nicht voll: mehr Plätze bringen dort erst Geld, wenn die Nachfrage steigt.`
                : empfohlen.length > 0
                  ? `Vorstand empfiehlt: ${empfohlen.map((b) => BEREICH_NAME[b]).join(", ")} (zu 90 % voll, Nachfrage über den Plätzen).`
                  : `Kasse ${C(kasse, 1)} · Bau zahlt aus dem Investitionstopf, Unterhalt je Spieltag.`}
            </span>
            <button type="button" className="fin-btn is-ja" disabled={!kannBauen || !geplant || laeuft} onClick={absenden}>Ausbau beauftragen</button>
          </div>
          {meldung ? <div className={`fin-meldung ${meldung.ok ? "is-gut" : "is-acht"}`} role="status">{meldung.text}</div> : null}
        </section>

        <section className="fin-sd" data-testid="arena-dauerkarten">
          <div className="fin-kopf">Dauerkarten<small>einmal je Saison · vor Spieltag 1</small></div>
          <div className="fin-in">
            <div className="fin-seg" role="group" aria-label="Dauerkarten-Stufe">
              {DAUERKARTEN_STUFEN.map((s) => (
                <button key={s} type="button" aria-pressed={dauer?.stufe === s} disabled={!dauerKannWaehlen} onClick={() => waehleDauer(s)}>
                  {DAUERKARTEN_LABEL[s]} {Math.round(DAUERKARTEN_ANTEIL[s] * 100)} %
                </button>
              ))}
            </div>
            <div className="arena-hoch"><span><b>Rabatt {Math.round(DAUERKARTEN_RABATT * 100)} %</b> auf den Tagespreis</span></div>
            <div className="arena-hoch"><b className="bc-t plus">{dauer ? `+${zahl(dauer.geld)}` : "–"}</b><span>C {dauer ? "in die Kasse" : "noch nicht gewählt"}{dauer?.standard ? " (Standard)" : ""}</span></div>
            <div className="fin-rek"><span>Sofort-Geld der drei Stufen</span><b className="bc-t">{dauerGeldStufen.map((g) => zahl(g)).join(" · ")}</b></div>
            <div className="fin-rek"><span>Verkaufte Plätze</span><b className="bc-t">{dauer ? `${ganz(gesamtPlaetze(dauer.plaetze))} von ${ganz(gesamtPlaetze(stand.plaetze))}` : "–"}</b></div>
            <div className="fin-txt">Lohnt sich unter <b>75 % Auslastung</b>: darüber kostet der Rabatt, dafür ist das Geld sofort da und hängt nicht an der Stimmung. Gilt für Steh, Sitz und Logen gleich. {gespielt ? "Die Wahl ist für diese Saison geschlossen." : "Wählst du nicht, gilt „Wenig“."}</div>
          </div>
        </section>

        <section className="fin-sd" data-testid="arena-fans">
          <div className="fin-kopf">Fans &amp; Heimspiele<small>Stimmung {Math.round(stand.stimmung)} · Serie {stand.serie}</small></div>
          <div className="fin-in">
            <div className="fin-rek"><span>Tageskasse bisher</span><b className="bc-t plus">{C(stand.heimspiele.reduce((s, h) => s + h.tickets, 0))}</b></div>
            <div className="fin-rek"><span>Heimspiele gespielt</span><b className="bc-t">{stand.heimspiele.length} von {heim}</b></div>
            {letztes ? (
              <div className="fin-txt"><b>Spieltag {letztes.matchdayIndex}:</b> Steh {pct(letztes.auslastung.steh)}, Sitz {pct(letztes.auslastung.sitz)}, Loge {pct(letztes.auslastung.loge)} · {C(letztes.tickets)}
                {letztes.ereignisse.length > 0 ? <> · Anlass: {letztes.ereignisse.join(", ")}</> : null}</div>
            ) : (
              <div className="fin-txt">Noch kein Heimspiel gebucht. Die Nachfrage folgt der Fanbasis, der Stimmung und dem Anlass des Spiels (Derby, Spitzenspiel, Unwetter …).</div>
            )}
            <div className="fin-txt">Ausverkauft: der Überhang hebt die Tageskarten bis +25 % (Logen bis +50 %). Dauerkarten bleiben beim festen Preis.</div>
          </div>
        </section>

        <section className="fin-sd" data-testid="arena-medaillen">
          <div className="fin-kopf">Medaillen<small>Gold 0,3 · Silber 0,2 · Bronze 0,1 C (Liga 1: 0,5 · 0,3 · 0,2)</small></div>
          <div className="fin-in">
            {!medaillenAktiv(gameState) ? (
              <div className="fin-txt">Medaillen und Farb-Meister gelten ab der nächsten Saison.</div>
            ) : (
              <>
                <div className="fin-rek"><span>Disziplin-Medaillen <small>{meineMedaillen.length} Stück</small></span><b className="bc-t plus">{vergabe?.seasonId === gameState.season.id ? C(medGeld.medaillen) : "am Saisonende"}</b></div>
                <div className="fin-rek"><span>Farb-Meister <small>{meineFarben.map((f) => FARBE_LABEL[f.farbe]).join(", ") || "Liga 1: 3,0 · Liga 2: 2,0 C je Farbe"}</small></span><b className="bc-t plus">{vergabe?.seasonId === gameState.season.id ? C(medGeld.farbe) : "am Saisonende"}</b></div>
                <div className="fin-txt">Je Disziplin zählen die Ergebnispunkte aus <b>zwei Duellen</b> je Saison; die Vierer-Disziplinen werten nach dem Verhältnis. Das Geld kommt aus dem Rangprämien-Topf: jede Rangprämie sinkt um {zahl((stempel?.rangAbzug ?? 0) * 100, 1)} %. Spieler mit Ehrgeiz- oder Ruhm-Trait bekommen Moral (Gold +6, Silber +4, Bronze +2). Die Hochrechnung steht unter Leaders.</div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="fin-sd arena-leiter" data-testid="arena-leiter">
        <div className="fin-kopf">Ausbau-Leiter je Bereich<small>Liga {liga1 ? 1 : 2} · bezahlt nach, wenn die neuen Plätze voll werden</small></div>
        <div className="fin-in">
          <table className="arena-tab">
            <thead>
              <tr><th>Bereich</th><th>Ein Schritt</th><th>Bau je Schritt</th><th>Unterhalt</th><th>Volles Haus je Schritt</th><th>Netto je Schritt</th><th>Bezahlt nach</th><th>Gebaut · Obergrenze</th></tr>
            </thead>
            <tbody>
              {ARENA_BEREICHE.map((b) => {
                const erste = leiterZeile(b, 1, liga1, heim);
                const letzte = leiterZeile(b, maxSchritte(b), liga1, heim);
                const zweite = leiterZeile(b, BAU_STAFFEL[b].erste + 1, liga1, heim);
                return (
                  <tr key={b}>
                    <td>{BEREICH_NAME[b]}</td>
                    <td className="bc-t">+{ganz(SCHRITT_GROESSE[b])}</td>
                    <td className="bc-t">{zahl(erste.bau, 1)} · {zahl(letzte.bau, 1)} C</td>
                    <td className="bc-t">{zahl(erste.unterhalt, 2)} C</td>
                    <td className="bc-t">{zahl(SCHRITT_GROESSE[b] * preisJePlatz(b, liga1) * heim, 2)} C</td>
                    <td className="bc-t">{zahl(erste.nettoSchritt, 2)} C</td>
                    <td className="bc-t">{saisons(erste.bezahlt)} · {saisons(zweite.bezahlt)}</td>
                    <td className="bc-t">{ganz(stand.plaetze[b])} · {ganz(OBERGRENZE[b])}</td>
                  </tr>
                );
              })}
              <tr className="is-su">
                <td>Voll ausgebaut</td><td className="bc-t">{ganz(gesamtPlaetze(OBERGRENZE))}</td>
                <td className="bc-t" colSpan={2}>{C(ARENA_BEREICHE.reduce((s, b) => s + leiterZeile(b, maxSchritte(b), liga1, heim).bauGesamt, 0), 1)} gesamt</td>
                <td className="bc-t">{C(volleHausSaison(OBERGRENZE, liga1, heim), 1)}</td><td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
