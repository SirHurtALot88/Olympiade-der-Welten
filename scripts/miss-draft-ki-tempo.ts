/**
 * MESSUNG: Tempo der Draft-KI (19.11.). Wegwerf-SQLite, 32 Teams, Mensch (reichstes Team) pickt als Letzter der Runde 1.
 * Misst Laden / Bewertung / Gesamtzeit je KI-Pick, "Vor zu meinem Pick" (Hintergrundlauf) und die Event-Loop-Blockade je Happen.
 *   npx tsx scripts/miss-draft-ki-tempo.ts [--vor] [--nur-folge]
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

// --db=<datei> --save=<id>: einen vorbereiteten Stand (siehe --vorbereiten=<datei>) benutzen, damit zwei Code-Staende dieselbe
// Pick-Folge rechnen koennen (die Saat haengt an der Save-Id).
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const vorbereiten = arg("vorbereiten");
process.env.OLY_APP_SQLITE_PATH = vorbereiten ?? arg("db") ?? path.join(os.tmpdir(), `oly-ki-tempo-${process.pid}.sqlite`);
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";

const ms = (a: number) => `${a.toFixed(0)} ms`;
const mw = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

async function main() {
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const dienst = await import("@/lib/draft/liga-draft-dienst");
  const ki = await import("@/lib/draft/liga-draft-ki");
  const modell = await import("@/lib/draft/liga-draft-modell");
  const persistence = createPersistenceService();
  const vorhanden = arg("save");
  const frisch = vorhanden ? persistence.getSaveById(vorhanden)! : persistence.createFreshSeasonOneSave({ name: "ki-tempo" });
  const saveId = frisch.saveId;
  const reichstes = [...frisch.gameState.teams].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0))[0]!;
  const settings = { ...(frisch.gameState.seasonState.teamControlSettings ?? {}) };
  settings[reichstes.teamId] = { ...settings[reichstes.teamId]!, controlMode: "manual", ownerId: "user_local" };
  if (!vorhanden) persistence.saveSingleplayerState(saveId, { ...frisch.gameState, seasonState: { ...frisch.gameState.seasonState, teamControlSettings: settings } });
  const kopie = persistence.getSaveById(saveId)!.gameState;
  if (!vorhanden) dienst.starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [reichstes.teamId], seed: "tempo-messung" });
  if (vorbereiten) {
    console.log(`VORBEREITET save=${saveId}`);
    return;
  }
  console.log(`Teams ${kopie.teams.length}, Spieler ${kopie.players.length}`);

  const nurFolge = process.argv.includes("--nur-folge");
  if (!nurFolge) {
    const ladeZ: number[] = [], bewZ: number[] = [], gesZ: number[] = [];
    for (let i = 0; i < 8; i++) {
      let t = performance.now();
      const gs = persistence.getSaveById(saveId)!.gameState;
      ladeZ.push(performance.now() - t);
      const draft = gs.seasonState.ligaDraft!;
      const zug = modell.werIstDran(draft)!;
      t = performance.now();
      ki.bewerteKiPick({ gameState: gs, saveId, draft, teamId: zug.teamId, topN: 3 });
      bewZ.push(performance.now() - t);
      t = performance.now();
      dienst.laufeKiZuege({ persistence, saveId, maxPicks: 1 });
      gesZ.push(performance.now() - t);
    }
    console.log(`je Pick (Ø von 8): Laden ${ms(mw(ladeZ))} | bewerteKiPick top3 ${ms(mw(bewZ))} | Gesamt laufeKiZuege(1) ${ms(mw(gesZ))}`);
  }

  const takt = arg("takt");
  if (takt) {
    // Simuliert den Takt der Seite: warten, dann `ki_schritt` (laufeKiZuege) mit maxPicks; 1x = 800 ms / 1 Pick, 3x = 60 ms / 6 Picks.
    const [warte, n] = takt === "3" ? [60, 6] : [800, 1];
    const t1 = performance.now();
    let picks = 0;
    for (; picks < 20; ) {
      await new Promise((r) => setTimeout(r, warte));
      picks += dienst.laufeKiZuege({ persistence, saveId, maxPicks: n }).eintraege.length;
    }
    const sek = (performance.now() - t1) / 1000;
    console.log(`Takt ${takt}x: ${picks} sichtbare Picks in ${sek.toFixed(1)} s = ${(picks / sek).toFixed(2)} Picks/s`);
    return;
  }
  let maxLuecke = 0;
  let letzte = performance.now();
  const wach = setInterval(() => {
    const j = performance.now();
    maxLuecke = Math.max(maxLuecke, j - letzte - 5);
    letzte = j;
  }, 5);
  const t0 = performance.now();
  const vor = process.argv.includes("--vor");
  console.log(vor ? "Modus: Vor (schnell)" : "Modus: Standard-Happen (120 ms)");
  const r = await dienst.laufeKiImHintergrund({
    persistence,
    saveId,
    logPrefix: "[messung]",
    ...(vor ? { jeHappen: dienst.LIGA_DRAFT_VOR_JE_HAPPEN, happenBudgetMs: dienst.LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS } : {}),
  });
  const dauer = performance.now() - t0;
  clearInterval(wach);
  const verlauf = persistence.getSaveById(saveId)!.gameState.seasonState.ligaDraft!.verlauf;
  console.log(`Vor-Lauf: ${r.picks} Picks in ${(dauer / 1000).toFixed(2)} s (${(r.picks / (dauer / 1000)).toFixed(1)} Picks/s), halt ${r.halt}, Verlauf ${verlauf.length}, max. Event-Loop-Luecke ${ms(maxLuecke)}`);
  const folge = verlauf.map((e) => `${e.teamId}:${e.playerId ?? e.art}`).join(",");
  console.log(`FOLGE ${verlauf.length} ${crypto.createHash("sha1").update(folge).digest("hex").slice(0, 12)}`);
}
void main().then(() => process.exit(0));
