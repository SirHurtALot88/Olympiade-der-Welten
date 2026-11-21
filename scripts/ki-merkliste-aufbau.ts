// ===================================================================================
// KI-MERKLISTE, AUFNAHME-AUFBAU (21.11.): rechnet in einer KOPIE des live-save-Abbilds die Merkliste aller KI-Teams neu
// (genau wie beim Spieltagsabschluss) und schreibt sie in den Spielstand der Kopie. Schreibt NUR in OLY_APP_SQLITE_PATH.
//
// AUFRUF: OLY_APP_SQLITE_PATH=<kopie.sqlite> npx tsx scripts/ki-merkliste-aufbau.ts
// ===================================================================================
import { aktualisiereKiMerkliste } from "@/lib/ai/ki-merkliste";
import { kiMerklisteGrund } from "@/lib/ai/ki-merkliste-lesen";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

if (!process.env.OLY_APP_SQLITE_PATH) {
  console.error("OLY_APP_SQLITE_PATH fehlt: dieses Skript schreibt nur in eine Kopie.");
  process.exit(1);
}
const SAVE = process.env.IB_SAVE ?? "new-game-1795114260527-nzr0z9";
const TEAM = process.env.IB_TEAM ?? "D-P";
const persistence = createPersistenceService();
const save = persistence.getSaveById(SAVE);
if (!save) throw new Error(`Spielstand ${SAVE} nicht gefunden`);
let neu = aktualisiereKiMerkliste(save.gameState);
// AUFNAHME-LAGE (nur mit IB_REICH=1): zeigt die Liste kein Interesse an einem Spieler des menschlichen Teams, wird sie fuer die
// Aufnahme EINMAL mit einem reichen KI-Team neu gerechnet (Kasse x10, nur in der Kopie), damit die Meldung sichtbar wird.
const eigeneIds = new Set(neu.rosters.filter((entry) => entry.teamId === TEAM).map((entry) => entry.playerId));
const hatTreffer = Object.values(neu.seasonState.kiMerkliste ?? {}).some((liste) => liste.some((e) => eigeneIds.has(e.playerId)));
if (!hatTreffer && process.env.IB_REICH === "1") {
  const reich = { ...neu, teams: neu.teams.map((t) => ({ ...t, cash: (t.cash ?? 0) * 10 })) };
  const ersatz = aktualisiereKiMerkliste(reich);
  neu = { ...neu, seasonState: { ...neu.seasonState, kiMerkliste: ersatz.seasonState.kiMerkliste } };
  console.log("Aufnahme-Lage: Merkliste mit Kasse x10 gerechnet (nur Kopie)");
}
persistence.saveSingleplayerState(SAVE, neu);

const eigene = new Set(neu.rosters.filter((entry) => entry.teamId === TEAM).map((entry) => entry.playerId));
let treffer = 0;
for (const [kiTeam, liste] of Object.entries(neu.seasonState.kiMerkliste ?? {})) {
  for (const eintrag of liste) {
    if (!eigene.has(eintrag.playerId)) continue;
    treffer += 1;
    const spieler = neu.players.find((p) => p.id === eintrag.playerId);
    console.log(`${kiTeam} -> ${spieler?.name} (Stufe ${eintrag.stufe}): ${kiMerklisteGrund(neu, eintrag)}`);
  }
}
console.log(`Interesse an Spielern von ${TEAM}: ${treffer}`);
