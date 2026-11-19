"use client";

/**
 * LIGA-REITER DER DRAFT-SEITE (19.11.): links die eigene Kaderstärke in den 20 Disziplinen mit Liga-Rang (live nach jedem
 * Pick) und je eigenem Spieler seine besten Ränge ligaweit; rechts die Teams-Übersicht (Wappen, Picks, Ablöse, Gehalt,
 * Kader-Marktwert, Kasse), sortierbar, das eigene Team hervorgehoben. Rechenquellen: `draft-liga.ts` (nutzt
 * `transfermarkt-kaderstaerke.ts`) und die Draft-Sicht `/api/draft`.
 *
 * SCOUTING-NEBEL: Marktwert, Ablöse und Gehalt sind im Draft immer exakt sichtbar (Chris 18.11.), eigene Spieler sind
 * ohnehin bekannt. Eignungswerte FREMDER Spieler (frei oder bei anderen Teams) zeigt diese Seite nie einzeln — nur die
 * Kaderstärke je Team, wie sie der Transfermarkt für alle Teams offenlegt. Bei eingeschaltetem Nebel entfällt zusätzlich der
 * Einzelwert je Spieler-Rang bei fremden Teams (es gibt dort keinen).
 */
import { useMemo, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { officialDisciplineWeightLabels, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import type { DraftKontext } from "./draft-kontext";
import { baueDraftKaderSicht, baueSpielerRaenge } from "./draft-liga";
import { betragC, de } from "./draft-format";

const DISZIPLINEN = [...officialDisciplineWeightOrder];
const NAMEN = officialDisciplineWeightLabels as Record<string, string>;

type SpaltenSchluessel = "name" | "picks" | "abloese" | "gehalt" | "mw" | "kasse";

export function DraftLiga({ k, gameState }: { k: DraftKontext; gameState: GameState }) {
  const a = k.ansicht;
  const meinTeamId = a.mein?.teamId ?? null;
  const [sort, setSort] = useState<{ spalte: SpaltenSchluessel; auf: boolean }>({ spalte: "mw", auf: false });

  const sicht = useMemo(
    () => (meinTeamId ? baueDraftKaderSicht({ gameState, ansicht: a, teamId: meinTeamId, disziplinIds: DISZIPLINEN }) : null),
    [gameState, a, meinTeamId],
  );
  const meineIds = useMemo(
    () => a.verlauf.filter((e) => e.art === "pick" && e.teamId === meinTeamId && e.playerId).map((e) => e.playerId as string),
    [a.verlauf, meinTeamId],
  );
  const kaderIds = useMemo(() => {
    const ids = new Set(gameState.rosters.filter((r) => r.teamId === meinTeamId).map((r) => r.playerId));
    for (const id of meineIds) ids.add(id);
    return [...ids];
  }, [gameState.rosters, meinTeamId, meineIds]);
  const raenge = useMemo(
    () => baueSpielerRaenge({ players: gameState.players, playerIds: kaderIds, disziplinIds: DISZIPLINEN, anzahl: 3 }),
    [gameState.players, kaderIds],
  );

  const zeilen = useMemo(() => {
    const kopie = [...a.teams];
    const wert = (t: (typeof kopie)[number]): number | string => {
      switch (sort.spalte) {
        case "name": return t.name;
        case "picks": return t.picks;
        case "abloese": return t.abloeseSumme;
        case "gehalt": return t.gehaltSumme;
        case "mw": return t.kaderMarktwert;
        case "kasse": return t.kasse;
      }
    };
    kopie.sort((x, y) => {
      const vx = wert(x);
      const vy = wert(y);
      const c = typeof vx === "string" ? vx.localeCompare(String(vy), "de") : (vx as number) - (vy as number);
      return sort.auf ? c : -c;
    });
    return kopie;
  }, [a.teams, sort]);

  const kopf = (spalte: SpaltenSchluessel, text: string) => (
    <button type="button" className={`drl-th${sort.spalte === spalte ? " an" : ""}`} onClick={() => setSort((s) => ({ spalte, auf: s.spalte === spalte ? !s.auf : spalte === "name" }))} data-testid={`draft-liga-sort-${spalte}`}>
      {text}{sort.spalte === spalte ? (sort.auf ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div className="drl" data-testid="draft-liga">
      <section className="pan drl-links">
        <div className="pk"><h2>Meine Kaderstärke in der Liga</h2><small>Rang unter {a.teams.length} Teams · live nach jedem Pick</small></div>
        <div className="fb">
          {sicht ? (
            <div className="drl-disz" data-testid="draft-liga-raenge">
              {sicht.zeilen.map((z) => {
                const anteil = Math.max(4, Math.min(100, ((z.ligaGroesse - z.rang + 1) / z.ligaGroesse) * 100));
                const klasse = z.rang <= 5 ? "top" : z.rang > z.ligaGroesse * 0.66 ? "tief" : "";
                return (
                  <div key={z.disziplinId} className={`drl-dz ${klasse}`} title={`${NAMEN[z.disziplinId] ?? z.disziplinId}: Ø der besten sechs ${de(z.staerke, 1)}`}>
                    <span>{NAMEN[z.disziplinId] ?? z.disziplinId}</span>
                    <i><b style={{ width: `${anteil}%` }} /></i>
                    <em className="t">{de(z.staerke, 1)}</em>
                    <strong className="t">{z.rang}.</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="hin">Dieses Team ist nicht im Draft — keine eigene Kaderstärke.</div>
          )}
          <h4>Meine Spieler — ligaweit beste Ränge</h4>
          <div className="drl-sp" data-testid="draft-liga-spieler">
            {kaderIds.length === 0 ? <div className="hin">Noch kein Spieler im Kader. Nach deinem ersten Pick erscheint er hier.</div> : null}
            {kaderIds.map((id) => {
              const r = raenge.get(id);
              const bild = k.portrait(id);
              return (
                <div key={id} className="drl-s">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {bild ? <img src={bild} alt="" /> : <span className="ph" />}
                  <button type="button" className="drl-name" onClick={() => k.profil(id)} data-testid="draft-liga-spieler-name">{k.spielerName(id)}</button>
                  <span className="drl-top">
                    {(r?.beste ?? []).map((b) => (
                      <em key={b.disziplinId} className={b.rang <= 10 ? "gut" : ""} title={`${NAMEN[b.disziplinId]}: Rang ${b.rang} unter allen Spielern der Liga`}>{NAMEN[b.disziplinId] ?? b.disziplinId} #{b.rang}</em>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="pan drl-rechts">
        <div className="pk"><h2>Teams der Liga</h2><small>Ablösen, Gehalt und Kader-Marktwert exakt (kein Nebel) · Klick auf Kopf sortiert</small></div>
        <div className="fb">
          <div className="drl-tab" data-testid="draft-liga-teams">
            <div className="drl-tr kopf">
              {kopf("name", "Team")}{kopf("picks", "Picks")}{kopf("abloese", "Ablösen")}{kopf("gehalt", "Gehälter")}{kopf("mw", "Kader-MW")}{kopf("kasse", "Kasse")}
            </div>
            {zeilen.map((t) => (
              <div key={t.teamId} className={`drl-tr${t.teamId === meinTeamId ? " ich" : ""}`} data-testid="draft-liga-team" data-team-id={t.teamId}>
                <span className="n">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {k.wappen(t.teamId) ? <img src={k.wappen(t.teamId) as string} alt="" /> : <i />}
                  <b>{t.name}</b>
                  {t.art === "mensch" ? <small>Mensch</small> : null}
                </span>
                <span className="t">{t.picks}</span>
                <span className="t">{betragC(t.abloeseSumme)}</span>
                <span className="t">{betragC(t.gehaltSumme)}</span>
                <span className="t">{betragC(t.kaderMarktwert)}</span>
                <span className="t">{betragC(t.kasse)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
