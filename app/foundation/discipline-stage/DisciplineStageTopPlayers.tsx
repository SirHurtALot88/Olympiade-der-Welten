"use client";

import PlayerStarFrame from "@/components/foundation/player-portrait-card/PlayerStarFrame";
import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";

import { SPIELTAGS_TOPSPIELER_SPALTENHOEHE } from "@/lib/foundation/discipline-stage/discipline-stage-matchday-top-players";

import { PlayerAwardStrip } from "@/components/foundation/player-awards/PlayerAwardStrip";
import type { PlayerSeasonAward } from "@/lib/foundation/player-season-awards";

import { fmt1 } from "./stage-format";

export type DisciplineStageTopPlayer = {
  rank: number;
  name: string;
  teamCode: string;
  logoUrl: string | null;
  portraitUrl: string | null;
  score: number;
  /**
   * GESAMTE gutgeschriebene Player-Points: Anteil an den Team-Punkten PLUS
   * Mutator-Aufschlag — dieselbe Zahl, die der Saison-Ledger bucht (siehe
   * `resolveAwardedPlayerPoints`). Nicht `pointsAwarded` allein.
   */
  points: number | null;
  /** Darin ENTHALTENER Mutator-Aufschlag, nur zur Aufschluesselung. */
  mutatorPoints: number | null;
  isMvp: boolean;
  isOwn: boolean;
  /** Ligaweiter OVR-Rang — einzige Grundlage des Star-Tier-Rahmens, NICHT `rank` (der PP-Rang dieser Liste). */
  ovrRank: number | null;
  /**
   * Auszeichnungen aus abgeschlossenen Saisons — Ticket #41, Chris: „auch in den drawern der
   * arena sollen die awards dann auftauchen". Hier nur als Zeichen: eine ganze Marke wuerde die
   * Zeile sprengen. Leer, solange keine Saison abgeschlossen ist.
   */
  awards?: readonly PlayerSeasonAward[] | null;
};

export type DisciplineStageTopPlayersProps = {
  players: DisciplineStageTopPlayer[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  playerIdByRow?: (string | null)[];
  /**
   * Namen der Disziplinen, die in dieser Liste STECKEN (aufgedeckte Seiten des Spieltags).
   * Steht in der Ueberschrift, weil die Zahl daneben eine SUMME ueber genau diese Disziplinen
   * ist — ohne die Namen laesst sich einer summierten Zahl nicht ansehen, worueber summiert
   * wurde. Genau das war Chris' wiederkehrende Frage („zeigt noch immer 1 Diszi").
   */
  disciplineNames?: readonly string[] | null;
};

export default function DisciplineStageTopPlayers({ players, onOpenPlayer, playerIdByRow, disciplineNames }: DisciplineStageTopPlayersProps) {
  const disziplinen = (disciplineNames ?? []).filter((name) => name.trim().length > 0);
  // Der urspruengliche Index wandert mit: `playerIdByRow` ist parallel zur UNGETEILTEN Liste,
  // und nach dem Schneiden waere der Spalten-Index ein anderer — der Klick oeffnete dann den
  // falschen Spieler.
  const spalten: Array<Array<{ spieler: DisciplineStageTopPlayer; index: number }>> = [];
  for (let start = 0; start < players.length; start += SPIELTAGS_TOPSPIELER_SPALTENHOEHE) {
    spalten.push(
      players
        .slice(start, start + SPIELTAGS_TOPSPIELER_SPALTENHOEHE)
        .map((spieler, versatz) => ({ spieler, index: start + versatz })),
    );
  }
  return (
    <div style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 12, position: "sticky", top: 12 }}>
      <div
        data-testid="stage-top-players-heading"
        data-disciplines={disziplinen.join(" + ")}
        style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}
      >
        Top-Spieler · Player-Points des Spieltags
        {disziplinen.length > 0 ? ` · ${disziplinen.join(" + ")}` : ""}
      </div>
      {players.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Noch keine Werte.</div>
      ) : (
        /**
         * ZWEI SPALTEN STATT EINER LANGEN LISTE — Ticket #42.
         *
         * CHRIS: „die Top Player Liste könnte man noch ausweiten, dass man nicht nur die top 12
         * sondern Top 24 hier sieht ohne dass man die Tabelle in der höhe größer macht, sondern
         * nebeneinander."
         *
         * Die Bedingung ist die Hoehe, nicht die Anzahl. Deshalb wird die Liste in Bloecke zu
         * `SPIELTAGS_TOPSPIELER_SPALTENHOEHE` geschnitten und nebeneinander gestellt: 24 Zeilen
         * belegen dieselbe Hoehe wie vorher 12.
         *
         * Ein `flex-wrap` und keine feste Zweispaltigkeit: auf schmalem Schirm rutschen die
         * Bloecke untereinander, statt die Zeilen unlesbar zusammenzuquetschen. Die Karte steht
         * `sticky` neben der Buehne — eine Liste, die dort horizontal ueberlaeuft, waere schlimmer
         * als eine, die hoeher wird.
         */
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          {spalten.map((spalte, spaltenIndex) => (
            <div
              key={`stage-top-players-col-${spaltenIndex}`}
              data-testid="stage-top-players-column"
              style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 240px", minWidth: 0 }}
            >
          {spalte.map(({ spieler: p, index }) => {
            const playerId = playerIdByRow?.[index] ?? null;
            const clickable = Boolean(onOpenPlayer && playerId);
            return (
              <div
                key={`${p.rank}-${p.name}-${p.teamCode}`}
                data-testid="stage-top-player-row"
                data-player-points={p.points == null ? "" : String(p.points)}
                onClick={clickable ? () => onOpenPlayer!(playerId!) : undefined}
                title={clickable ? "Spieler-Karte öffnen" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  borderRadius: 8,
                  fontVariantNumeric: "tabular-nums",
                  cursor: clickable ? "pointer" : "default",
                  background: p.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "transparent",
                  border: p.isOwn ? "1px solid var(--nl-accent)" : "1px solid transparent",
                }}
              >
                <span style={{ width: 20, textAlign: "right", fontWeight: 800, color: "var(--nl-mut)", fontSize: 12.5 }}>{p.rank}</span>
                <PlayerStarFrame tier={getPlayerStarTier(p.ovrRank)} shape="circle" size="sm">
                  {p.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }} />
                  ) : (
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }} />
                  )}
                </PlayerStarFrame>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.isMvp ? "⭐ " : ""}
                    {p.name}
                    <PlayerAwardStrip awards={p.awards} variant="icons" />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--nl-mut)", display: "flex", alignItems: "center", gap: 4 }}>
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logoUrl} alt="" width={12} height={12} style={{ width: 12, height: 12, borderRadius: 3, objectFit: "cover", flex: "none" }} />
                    ) : null}
                    {p.teamCode}
                  </div>
                </div>
                {/*
                  PP UND SCORE — BEIDE ueber BEIDE Disziplinen summiert, sortiert nach PP-Summe.

                  Chris' Praezisierung, nachdem ich ihn zuerst falsch verstanden hatte: „nein die
                  score darf da stehen bleiben mir ging es nur darum dass die PPs und Score aus der
                  anderen diszi beim spieler ergaenzt werden und dann die Summe da steht und nach
                  PPs Total geordnet ist."

                  Ich hatte sein vorheriges „brauch ich gar nicht die scores" als „Score raus"
                  gelesen. Gemeint war: der Score soll nicht das MASSGEBLICHE sein. Die Summierung
                  ueber beide Disziplinen und die Sortierung nach PP-Summe macht
                  `summiereSpieltagsTopSpieler` bereits (Score ist dort nur der Gleichstand-Brecher)
                  — gefehlt hat nur, dass beide Zahlen auch DASTEHEN.

                  Die PP fuehrt optisch, weil sie sortiert und gebucht wird; der Score steht als
                  zweite Zeile daneben. Ohne gebuchte Punkte steht „—" statt eines Ersatzwertes:
                  eine Zahl, die dann der Score waere, wuerde als PP gelesen.
                */}
                <div style={{ textAlign: "right" }}>
                  {p.points != null ? (
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(p.points)} PP</div>
                  ) : (
                    <div
                      title="Für diesen Spieler sind noch keine Player-Points gebucht."
                      style={{ fontSize: 14, fontWeight: 800, color: "var(--nl-mut)" }}
                    >
                      — PP
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "var(--nl-mut)" }}>(Score {fmt1(p.score)})</div>
                </div>
              </div>
            );
          })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
