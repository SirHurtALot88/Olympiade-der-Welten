// ===================================================================================
// KI-MERKLISTE, MESSUNG (21.11.): rechnet die Merkliste aller KI-Teams auf einer KOPIE des live-save-Abbilds und gibt Laenge,
// Stufen, Dauer, Determinismus und Beispiele aus. Schreibt nichts.
//
// AUFRUF: OLY_APP_SQLITE_PATH=<kopie.sqlite> npx tsx scripts/miss-ki-merkliste.ts [saveId]
// ===================================================================================
import { berechneKiMerklisteFuerTeam, istKiTeam } from "@/lib/ai/ki-merkliste";
import { kiMerklisteGrund } from "@/lib/ai/ki-merkliste-lesen";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

if (!process.env.OLY_APP_SQLITE_PATH) {
  console.error("OLY_APP_SQLITE_PATH fehlt: dieses Skript liest nur aus einer Kopie.");
  process.exit(1);
}
const SAVE = process.argv[2] ?? process.env.IB_SAVE ?? "new-game-1795114260527-nzr0z9";
const save = createPersistenceService().getSaveById(SAVE);
if (!save) throw new Error(`Spielstand ${SAVE} nicht gefunden`);
const gs = save.gameState;
console.log(`${SAVE}: ${gs.season.id}, ${gs.matchdayState.matchdayId}, Phase ${gs.gamePhase}, ${gs.teams.length} Teams`);

const stufen: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
const laengen: number[] = [];
const eigeneBesitzer = new Map<string, number>();
const start = Date.now();
let ersteAusgabe = 0;
for (const team of gs.teams) {
  if (!istKiTeam(gs, team.teamId)) continue;
  const liste = berechneKiMerklisteFuerTeam(gs, team.teamId);
  laengen.push(liste.length);
  for (const eintrag of liste) {
    stufen[eintrag.stufe] += 1;
    eigeneBesitzer.set(eintrag.besitzerTeamId, (eigeneBesitzer.get(eintrag.besitzerTeamId) ?? 0) + 1);
  }
  if (ersteAusgabe < 3 && liste.length > 0) {
    ersteAusgabe += 1;
    console.log(`\n${team.teamId} (${liste.length} Eintraege)`);
    for (const eintrag of liste) {
      const spieler = gs.players.find((p) => p.id === eintrag.playerId);
      console.log(`  ${spieler?.name ?? eintrag.playerId} bei ${eintrag.besitzerTeamId}: Stufe ${eintrag.stufe}, Vorsprung ${eintrag.vorsprung}, ${kiMerklisteGrund(gs, eintrag)}`);
    }
  }
}
const dauer = Date.now() - start;
console.log(`\nKI-Teams ${laengen.length}, Dauer ${dauer} ms (${Math.round(dauer / Math.max(1, laengen.length))} ms je Team)`);
console.log(`Laengen ${laengen.join(",")}`);
console.log(`Stufen 1/2/3: ${stufen[1]}/${stufen[2]}/${stufen[3]}`);
console.log(`Interesse je Besitzer (Top 5): ${[...eigeneBesitzer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `${t}=${n}`).join(", ")}`);

const probe = gs.teams.find((team) => istKiTeam(gs, team.teamId));
if (probe) {
  const a = JSON.stringify(berechneKiMerklisteFuerTeam(gs, probe.teamId));
  const b = JSON.stringify(berechneKiMerklisteFuerTeam(gs, probe.teamId));
  console.log(`deterministisch (${probe.teamId}): ${a === b}`);
}
