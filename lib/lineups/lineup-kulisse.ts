import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import {
  KULISSEN_TENDENZ_TEXT,
  berechneOberflaechenwert,
  kulissenAttributLabel,
  kulissenTendenz,
  kulissenTendenzChips,
  waehleKulisseFuerFixture,
  ARENA_KULISSEN_PROFILE,
  type KulissenTendenz,
} from "@/lib/battle/arena-kulisse";
import { buildArenaMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { baueFixtureIndex, findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { isBattleModeSave } from "@/lib/season/game-mode";

/**
 * OBERFLAECHEN-EFFEKTE IN DER AUFSTELLUNG (08.11., docs/design/oberflaechen-effekte-konzept-08-11.md
 * Abschnitt 4.2 a/b). Fuer jede Disziplin des Spieltags mit Kulissen-Profil: auf welchem Platz
 * gespielt wird (dieselbe Wahl wie Host und Runner, `waehleKulisseFuerFixture`) und je Spieler des
 * eigenen Kaders die Tendenz `++ / + / 0 / - / --` mit den groessten Beitraegen.
 *
 * NUR IM BATTLE-MODUS und nur fuer arena-aufgeloeste Disziplinen: dort -- und nur dort -- rechnet
 * die Arena den Oberflaechenwert in die Wertung. Im Manager-Modus (PPS-Pfad) gibt es den Effekt
 * noch nicht; der Picker verspricht dort deshalb auch nichts (Konzept: "Anzeige = Mechanik").
 */

export type LineupKulisseSpieler = {
  tendenz: KulissenTendenz;
  ow: number;
  tooltip: string;
};

export type LineupKulisseAnzeige = {
  disziplinId: string;
  varianteId: string;
  label: string;
  kurz: string;
  untertitel: string;
  chips: Array<{ label: string; richtung: "auf" | "ab"; delta: number }>;
  tooltip: string;
  /** Schluessel: Player.id. */
  spieler: Record<string, LineupKulisseSpieler>;
};

const fmt = (x: number, stellen = 1) =>
  `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(stellen).replace(".", ",")}`;

export function buildLineupKulisseAnzeige(input: {
  gameState: GameState | null | undefined;
  saveId: string | null | undefined;
  seasonId: string | null | undefined;
  matchdayId: string | null | undefined;
  teamId: string | null | undefined;
  disciplineId: string | null | undefined;
}): LineupKulisseAnzeige | null {
  const { gameState, saveId, seasonId, matchdayId, teamId, disciplineId } = input;
  if (!gameState || !saveId || !seasonId || !matchdayId || !teamId || !disciplineId) return null;
  if (!ARENA_KULISSEN_PROFILE[disciplineId] || !ARENA_RESOLVED_DISCIPLINE_IDS.has(disciplineId)) return null;
  if (!isBattleModeSave(gameState)) return null;
  const fixture = baueFixtureIndex(findeSpieltagsFixtures(gameState, matchdayId)).get(teamId);
  if (!fixture) return null;
  const saat = seedZuZahl(
    buildArenaMatchSeed({
      saveId,
      seasonId,
      matchdayId,
      disciplineId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
    }),
  );
  const variante = waehleKulisseFuerFixture({
    disziplin: disciplineId,
    saat,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    matchdayId,
  });
  if (!variante) return null;

  // Feldmittel ueber BEIDE Kader des Spieltags (Konzept 4.2 b: "relativ zum Feld dieses Spieltags").
  const eigene = buildArenaTeam(gameState, teamId);
  const gegnerId = fixture.homeTeamId === teamId ? fixture.awayTeamId : fixture.homeTeamId;
  const feld = [...eigene, ...buildArenaTeam(gameState, gegnerId)];
  const feldmittel: Record<string, number> = {};
  for (const k of Object.keys(variante.profil)) {
    feldmittel[k] = feld.length ? feld.reduce((s, p) => s + ((p.a as Record<string, number>)[k] ?? 0), 0) / feld.length : 50;
  }

  const spieler: Record<string, LineupKulisseSpieler> = {};
  for (const p of eigene) {
    const w = berechneOberflaechenwert(p.a as Record<string, number>, disciplineId, variante.id, feldmittel);
    if (!w) continue;
    const tendenz = kulissenTendenz(w.ow);
    const zeilen = w.beitraege
      .slice(0, 3)
      .map((b) => `${kulissenAttributLabel(b.attribut)} ${Math.round(b.wert)}  ${fmt(b.beitrag)}  (zählt hier ${fmt(b.delta, 0)})`);
    spieler[p.id] = {
      tendenz,
      ow: w.ow,
      tooltip: [
        `${variante.label}: ${fmt(w.ow)} Eignung (${tendenz}) — ${KULISSEN_TENDENZ_TEXT[tendenz]}`,
        ...zeilen,
        "Beiträge relativ zum Feld dieses Spieltags.",
      ].join("\n"),
    };
  }

  const verschiebung = Object.entries(variante.profil)
    .filter(([, d]) => d)
    .map(([k, d]) => `${kulissenAttributLabel(k)} ${fmt(d as number, 0)}`)
    .join(", ");
  return {
    disziplinId: disciplineId,
    varianteId: variante.id,
    label: variante.label,
    kurz: variante.kurz,
    untertitel: variante.untertitel,
    chips: kulissenTendenzChips(variante).map((c) => ({ label: c.label, richtung: c.richtung, delta: c.delta })),
    tooltip:
      `${variante.label}: Gewichte gegenüber der Matrix ${verschiebung} (Gewichtspunkte). ` +
      `Wirkt in der Arena-Wertung, gedeckelt auf ±${ARENA_KULISSEN_PROFILE[disciplineId].deckel} Eignung. ` +
      "Über alle Plätze einer Saison gleicht sich das aus — die Matrix bleibt die Grundlage.",
    spieler,
  };
}
