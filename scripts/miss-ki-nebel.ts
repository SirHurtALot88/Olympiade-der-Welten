/**
 * MESSUNG: KI-Nebel (21.11.). Faehrt einen kompletten Liga-Draft einer reinen KI-Liga (32 Teams, Wegwerf-SQLite) und misst
 * Kaderstaerke (je Disziplin Mittel der besten 6, dann Mittel ueber alle Disziplinen), Kadergroessen, Fehlkaeufe und Laufzeit.
 *
 *   OLY_KI_NEBEL=0 npx tsx scripts/miss-ki-nebel.ts <saat>                (heutiges Verhalten)
 *   OLY_KI_NEBEL_STAERKE=1 npx tsx scripts/miss-ki-nebel.ts <saat>        (mit Nebel)
 *
 * Gleiche Saat = gleiche Save-Id = gleiche Draft-Saat, damit zwei Staende vergleichbar sind. Schreibt nur in eine Wegwerf-SQLite.
 */
import os from "node:os";
import path from "node:path";

const saat = process.argv[2] ?? "A";
process.env.OLY_APP_SQLITE_PATH = path.join(os.tmpdir(), `oly-ki-nebel-${process.pid}.sqlite`);
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";

const mw = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

async function main() {
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const dienst = await import("@/lib/draft/liga-draft-dienst");
  const modell = await import("@/lib/draft/liga-draft-modell");
  const { baueKiSichtKontext, kiSichtAufSpieler } = await import("@/lib/ai/ki-nebel");
  const { SOLIDE_THRESHOLD } = await import("@/lib/ai/organic-squad/types");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: `ki-nebel-${saat}`, saveId: `ki-nebel-${saat}` });
  const saveId = frisch.saveId;
  const start = persistence.getSaveById(saveId)!.gameState;
  // Die Sicht fuer die Fehlkauf-Zaehlung wird auch im AUS-Lauf gebaut (Nebel kurz erzwungen), damit AUS und AN vergleichbar sind.
  const nebelEnv = process.env.OLY_KI_NEBEL;
  delete process.env.OLY_KI_NEBEL;
  const kontexte = new Map(start.teams.map((t) => [t.teamId, baueKiSichtKontext(start, t.teamId)] as const));
  if (nebelEnv === undefined) delete process.env.OLY_KI_NEBEL;
  else process.env.OLY_KI_NEBEL = nebelEnv;
  const spielerById = new Map(start.players.map((p) => [p.id, p] as const));
  dienst.starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [], seed: `nebel-${saat}` });

  const picks: Array<{ teamId: string; playerId: string }> = [];
  const t0 = performance.now();
  const zeiten: number[] = [];
  for (;;) {
    const t = performance.now();
    const lauf = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 1 });
    zeiten.push(performance.now() - t);
    for (const e of lauf.eintraege) if (e.art === "pick" && e.playerId) picks.push({ teamId: e.teamId, playerId: e.playerId });
    if (lauf.halt === "draft_vorbei" || lauf.eintraege.length === 0) break;
  }
  const dauer = performance.now() - t0;
  const gs = persistence.getSaveById(saveId)!.gameState;

  // Fehlkaeufe: bewertet (verrauschte Sicht des Teams zu Beginn) gegen wahr, Mittel der besten 5 Disziplinen.
  const top5 = (r: Record<string, number>) => mw(Object.values(r).sort((a, b) => b - a).slice(0, 5));
  const abw: number[] = [];
  let fehl = 0;
  for (const pick of picks) {
    const kontext = kontexte.get(pick.teamId);
    const spieler = spielerById.get(pick.playerId);
    if (!kontext || !spieler) continue;
    const sicht = kiSichtAufSpieler(kontext, spieler, null);
    const d = top5(sicht.disciplineRatings) - top5(spieler.disciplineRatings ?? {});
    abw.push(d);
    if (d >= 5) fehl += 1;
  }

  // Kaderstaerke: wahre Werte, je Disziplin Mittel der besten 6 des Kaders.
  const ids = new Set<string>();
  for (const p of gs.players) for (const k of Object.keys(p.disciplineRatings ?? {})) ids.add(k);
  const disziplinen = [...ids];
  const staerken: number[] = [];
  const groessen: number[] = [];
  const abgedeckt: number[] = [];
  for (const team of gs.teams) {
    const kader = gs.rosters.filter((r) => r.teamId === team.teamId).map((r) => gs.players.find((p) => p.id === r.playerId)!).filter(Boolean);
    groessen.push(kader.length);
    const je = disziplinen.map((d) => mw(kader.map((p) => p.disciplineRatings?.[d] ?? 0).sort((a, b) => b - a).slice(0, 6)));
    staerken.push(mw(je));
    abgedeckt.push(disziplinen.filter((d) => kader.some((p) => (p.disciplineRatings?.[d] ?? 0) > SOLIDE_THRESHOLD)).length);
  }
  const sort = [...zeiten].sort((a, b) => a - b);
  const modus = process.env.OLY_KI_NEBEL === "0" ? "AUS" : `AN (Staerke ${process.env.OLY_KI_NEBEL_STAERKE ?? "Standard"})`;
  console.log(`ERGEBNIS saat=${saat} nebel=${modus}`);
  console.log(`  Picks ${picks.length}; Kader min ${Math.min(...groessen)} Ø ${mw(groessen).toFixed(2)} max ${Math.max(...groessen)}, unter 8: ${groessen.filter((g) => g < 8).length}`);
  console.log(`  Kaderstaerke (beste 6, 20 Diszis) Ø ${mw(staerken).toFixed(3)} min ${Math.min(...staerken).toFixed(3)} max ${Math.max(...staerken).toFixed(3)}`);
  console.log(`  Diszis mit solidem Spieler: min ${Math.min(...abgedeckt)} Ø ${mw(abgedeckt).toFixed(2)} (von ${disziplinen.length})`);
  console.log(`  Fehlkaeufe (bewertet >= 5 ueber wahr, Top-5-Mittel): ${fehl} von ${abw.length} = ${((100 * fehl) / Math.max(1, abw.length)).toFixed(1)} %, mittlere Ueberbewertung ${mw(abw).toFixed(2)}`);
  console.log(`  Laufzeit gesamt ${(dauer / 1000).toFixed(1)} s, je Pick Ø ${mw(zeiten).toFixed(0)} ms, Median ${sort[Math.floor(sort.length / 2)]!.toFixed(0)} ms, p95 ${sort[Math.floor(sort.length * 0.95)]!.toFixed(0)} ms`);
  console.log(`  Diszis-Abdeckung je Team (sortiert): ${[...abgedeckt].sort((a, b) => a - b).join(",")}`);
  console.log(`  Kaderstaerke je Team (sortiert): ${[...staerken].sort((a, b) => a - b).map((x) => x.toFixed(1)).join(",")}`);
  console.log(`  Kasse Ø ${mw(gs.teams.map((t) => t.cash ?? 0)).toFixed(1)}`);
}
void main().then(() => process.exit(0));
