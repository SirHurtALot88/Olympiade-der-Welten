// ===================================================================================
// KI-MERKLISTE, MESSUNG (21.11.): rechnet die Merkliste aller KI-Teams auf einer KOPIE des live-save-Abbilds und gibt Laenge,
// Stufen, Dauer, Determinismus und Beispiele aus. Schreibt nichts.
//
// AUFRUF: OLY_APP_SQLITE_PATH=<kopie.sqlite> npx tsx scripts/miss-ki-merkliste.ts [saveId]
// ===================================================================================
import { aktualisiereKiMerkliste, berechneKiMerklisteFuerTeam, istKiTeam } from "@/lib/ai/ki-merkliste";
import { getScoutingWishlistQueue } from "@/lib/scouting/scouting-wishlist-slots";
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
const besitzerZaehler = new Map<string, number>();
let markt = 0;
let fremde = 0;
const start = Date.now();
let ersteAusgabe = 0;
for (const team of gs.teams) {
  if (!istKiTeam(gs, team.teamId)) continue;
  const liste = berechneKiMerklisteFuerTeam(gs, team.teamId);
  laengen.push(liste.length);
  for (const eintrag of liste) {
    stufen[eintrag.stufe] += 1;
    if (eintrag.besitzerTeamId === null) markt += 1;
    else {
      fremde += 1;
      besitzerZaehler.set(eintrag.besitzerTeamId, (besitzerZaehler.get(eintrag.besitzerTeamId) ?? 0) + 1);
    }
  }
  if (ersteAusgabe < 2 && liste.length > 0) {
    ersteAusgabe += 1;
    console.log(`\n${team.teamId} (${liste.length} Eintraege, erste 8)`);
    for (const eintrag of liste.slice(0, 8)) {
      const spieler = gs.players.find((p) => p.id === eintrag.playerId);
      console.log(`  ${spieler?.name ?? eintrag.playerId} ${eintrag.besitzerTeamId ? `bei ${eintrag.besitzerTeamId}` : "(Markt)"}: Stufe ${eintrag.stufe}, Vorsprung ${eintrag.vorsprung}, ${kiMerklisteGrund(gs, eintrag)}`);
    }
  }
}
const dauer = Date.now() - start;
const sortiert = [...laengen].sort((a, b) => a - b);
const q = (p: number) => sortiert[Math.min(sortiert.length - 1, Math.floor(p * sortiert.length))] ?? 0;
console.log(`\nKI-Teams ${laengen.length}, nur Berechnung ${dauer} ms (${Math.round(dauer / Math.max(1, laengen.length))} ms je Team)`);
console.log(`Laengen je Team: min ${sortiert[0]}, Median ${q(0.5)}, p90 ${q(0.9)}, max ${sortiert[sortiert.length - 1]}, Summe ${laengen.reduce((a, b) => a + b, 0)}`);
console.log(`Laengen ${laengen.join(",")}`);
console.log(`Stufen 1/2/3: ${stufen[1]}/${stufen[2]}/${stufen[3]}`);
console.log(`Markt ${markt} / fremde Teams ${fremde} (Marktanteil ${Math.round((100 * markt) / Math.max(1, markt + fremde))} %)`);
console.log(`Interesse je Besitzer (Top 5): ${[...besitzerZaehler.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `${t}=${n}`).join(", ")}`);

// Ganzer Abschlussschritt: schreiben + Scouting-Plaetze neu rechnen (so wie beim Spieltagsabschluss), dann Scouting-Belegung.
const vorGroesse = JSON.stringify(gs.seasonState.transferWishlist ?? []).length;
const t0 = Date.now();
const neu = aktualisiereKiMerkliste(gs, SAVE);
const gesamt = Date.now() - t0;
const zeilen = (neu.seasonState.transferWishlist ?? []).filter((z) => z.ki);
const nachGroesse = JSON.stringify(neu.seasonState.transferWishlist ?? []).length;
console.log(`\nAbschlussschritt aktualisiereKiMerkliste: ${gesamt} ms gesamt (inkl. Scouting-Plaetze), ${zeilen.length} Wunschlisten-Eintraege, Wunschliste ${Math.round(vorGroesse / 1024)} -> ${Math.round(nachGroesse / 1024)} KiB`);
const belegt: number[] = [];
const kapazitaet = new Set<number>();
let wartend = 0;
for (const team of gs.teams) {
  if (!istKiTeam(gs, team.teamId)) continue;
  const queue = getScoutingWishlistQueue(neu, team.teamId);
  const records = (neu.seasonState.scoutIntelByTeamId?.[team.teamId] ?? []).filter((r) => !r.parked && r.source === "wishlist_mirror");
  belegt.push(records.length);
  kapazitaet.add(queue.capacity);
  wartend += queue.waiting.length;
}
console.log(`Scouting-Plaetze aus der Merkliste belegt je KI-Team: ${belegt.join(",")} (Kapazitaet ${[...kapazitaet].join("/")}); wartend gesamt ${wartend}`);

const probe = gs.teams.find((team) => istKiTeam(gs, team.teamId));
if (probe) {
  const a = JSON.stringify(berechneKiMerklisteFuerTeam(gs, probe.teamId));
  const b = JSON.stringify(berechneKiMerklisteFuerTeam(gs, probe.teamId));
  console.log(`deterministisch (${probe.teamId}): ${a === b}`);
}
