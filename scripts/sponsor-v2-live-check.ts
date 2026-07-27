/**
 * LIVE-CHECK fuer das Sponsorsystem V2 — erzeugt ein NEUES Spiel und prueft, dass das neue
 * Sponsorsystem den ganzen Weg geht: Angebote entstehen, werden gewaehlt, und am Saisonende wird
 * korrekt abgerechnet.
 *
 * Aufruf:
 *   npx tsx scripts/sponsor-v2-live-check.ts
 *   npx tsx scripts/sponsor-v2-live-check.ts --persist --name "V2 Testspiel"
 *
 * Ohne `--persist` wird NICHTS geschrieben — der Lauf baut den Spielstand im Speicher und wirft
 * ihn danach weg. Mit `--persist` landet er als Sandbox-Save in der Datenbank und kann in der App
 * weitergespielt werden.
 *
 * Was geprueft wird und warum jede Pruefung da ist:
 *  1. Angebote entstehen ueberhaupt und tragen V2-Konditionen.
 *  2. Keine Liste enthaelt zwei gleiche Kurvenformen — die Angebotsregel, ohne die genau dort
 *     Fallen auftreten, wo die Untergrenze den Malus abschneidet.
 *  3. Jedes KI-Team hat unterschrieben und der Vertrag traegt die Konditionen des GEWAEHLTEN
 *     Angebots (nicht irgendeines).
 *  4. ANZEIGE == SETTLEMENT: die in der Karte gezeigte Gewinnstufen-Leiter ist zeichengleich die,
 *     aus der abgerechnet wird.
 *  5. Die Auszahlungsleiter jedes unterschriebenen Vertrags ist ueber alle 32 Endraenge monoton.
 *  6. Die Abrechnung laeuft: vier Zeilen je Vertrag, Summe positiv, und die Liga-Deckung
 *     (Sigma Sponsoren gegen Sigma Gehaelter) liegt in der Naehe des Ligajahr-Faktors.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  applyNewGameSetup, buildNewGameStateFromBaseline, NEW_GAME_PRESETS, type NewGamePresetId,
} from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildOfferRankPayoutLadderPreview } from "@/lib/sponsor/sponsor-economy-calibration";
import { buildSponsorRankTierRows } from "@/lib/sponsor/sponsor-offer-presenter";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import {
  getSponsorV2Terms, resolveSponsorSystemVersion, SPONSOR_V2_PRICED_GOAL_KEYS, sponsorV2GuaranteedLadder,
  sponsorV2LeagueSalaryBasis, sponsorV2Settle,
} from "@/lib/sponsor/sponsor-v2-offer-service";

const args = process.argv.slice(2);
const argOf = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
  ?? (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const PERSIST = args.includes("--persist");
const SAVE_NAME = argOf("name") ?? `V2 Live-Check ${new Date().toISOString().slice(0, 16)}`;
const PRESET = argOf("preset") ?? undefined;

const line = (c = "=") => console.log(c.repeat(100));
const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");

let failures = 0;
function check(ok: boolean, label: string, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}${detail ? `  —  ${detail}` : ""}`);
}

function main(): void {
  line();
  console.log("SPONSORSYSTEM V2 — LIVE-CHECK auf einem NEUEN Spiel");
  line();

  const presetId = (PRESET ?? NEW_GAME_PRESETS[0]!.presetId) as NewGamePresetId;
  console.log(`Preset: ${presetId} · Save-Name: ${SAVE_NAME} · schreiben: ${PERSIST ? "JA (Sandbox)" : "nein"}`);

  // OHNE --persist wird nur gebaut, nicht geschrieben. buildNewGameStateFromBaseline durchlaeuft
  // denselben Weg wie das echte Neue Spiel (inklusive ensureSeasonSponsorOffers und
  // chooseSponsorOfferForAiTeams), legt aber keinen Save an.
  const prepared = buildNewGameStateFromBaseline({ presetId, saveName: SAVE_NAME, sandbox: true });
  let gameState: GameState = prepared.gameState;
  let saveId = "(nicht persistiert)";
  if (PERSIST) {
    const applied = applyNewGameSetup(
      { presetId, saveName: SAVE_NAME, sandbox: true, confirmToken: prepared.preview.confirmToken },
      createPersistenceService(),
    );
    saveId = applied.save.saveId;
    const reloaded = createPersistenceService().getSaveById(saveId);
    if (reloaded?.gameState) gameState = reloaded.gameState;
  }
  console.log(`Save-ID: ${saveId} · Saison ${gameState.season.id} · ${gameState.teams.length} Teams`);
  check(resolveSponsorSystemVersion(gameState) === 2, "Spielstand traegt sponsorSystemVersion 2",
    `gelesen: ${gameState.seasonState.sponsorSystemVersion ?? "(kein Vermerk -> V1)"}`);

  // ── 1/2: Angebote ────────────────────────────────────────────────────────────────────────────
  line("-");
  console.log("1) ANGEBOTE");
  line("-");
  const offersByTeam = gameState.seasonState.sponsorOffersByTeamId ?? {};
  const teamsWithOffers = Object.keys(offersByTeam).length;
  const allOffers = Object.values(offersByTeam).flat();
  const v2Offers = allOffers.filter((o) => getSponsorV2Terms(o) != null);
  check(teamsWithOffers > 0, `Angebotslisten erzeugt`, `${teamsWithOffers} Teams, ${allOffers.length} Angebote`);
  check(v2Offers.length === allOffers.length, `alle Angebote tragen V2-Konditionen`,
    `${v2Offers.length}/${allOffers.length}`);

  let slatesWithDuplicateCurve = 0;
  const curveMix = new Map<string, number>();
  const clauseMix = new Map<string, number>();
  const rarityMix = new Map<string, number>();
  for (const offers of Object.values(offersByTeam)) {
    const curves = (offers ?? []).map((o) => getSponsorV2Terms(o)?.curveName ?? "?");
    if (new Set(curves).size !== curves.length) slatesWithDuplicateCurve += 1;
    for (const o of offers ?? []) {
      const t = getSponsorV2Terms(o);
      if (!t) continue;
      curveMix.set(t.curveName, (curveMix.get(t.curveName) ?? 0) + 1);
      clauseMix.set(t.clauseName, (clauseMix.get(t.clauseName) ?? 0) + 1);
      rarityMix.set(t.rarity, (rarityMix.get(t.rarity) ?? 0) + 1);
    }
  }
  check(slatesWithDuplicateCurve === 0, `ANGEBOTSREGEL: keine zwei gleichen Kurvenformen je Liste`,
    `${slatesWithDuplicateCurve} Listen mit Doppel`);
  console.log(`     Kurven:   ${[...curveMix.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`     Rarities: ${[...rarityMix.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`     Klauseln: ${[...clauseMix.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  // EHRLICHKEIT ZUR SCHWIERIGKEITS-BEPREISUNG: ein Sonderziel ohne Eintrag in der
  // Wahrscheinlichkeitstabelle laeuft auf den Default 0.45 — fuer dieses Ziel ist "nach
  // Schwierigkeit bepreist" dann schlicht nicht wahr. Die Quote gehoert ausgewiesen.
  const goalKeys = allOffers.map((o) => getSponsorV2Terms(o)?.goalKey ?? null);
  const priced = goalKeys.filter((k) => k != null && SPONSOR_V2_PRICED_GOAL_KEYS.includes(k)).length;
  const unpricedKeys = [...new Set(goalKeys.filter((k) => k != null && !SPONSOR_V2_PRICED_GOAL_KEYS.includes(k)))];
  check(priced === goalKeys.filter((k) => k != null).length,
    `Sonderziele nach Schwierigkeit bepreist (statt Default 0.45)`,
    `${priced}/${goalKeys.filter((k) => k != null).length}` +
    (unpricedKeys.length ? ` · ohne Schaetzung: ${unpricedKeys.join(", ")}` : ""));

  // ── 3: Vertraege ─────────────────────────────────────────────────────────────────────────────
  line("-");
  console.log("3) VERTRAEGE");
  line("-");
  const contracts = gameState.seasonState.sponsorContractsByTeamId ?? {};
  const contractList = Object.values(contracts).filter(Boolean);
  const v2Contracts = contractList.filter((c) => getSponsorV2Terms(c) != null);
  check(contractList.length > 0, `Vertraege unterschrieben`, `${contractList.length} von ${gameState.teams.length} Teams`);
  check(v2Contracts.length === contractList.length, `alle Vertraege tragen V2-Konditionen`,
    `${v2Contracts.length}/${contractList.length}`);
  let mismatched = 0;
  for (const c of v2Contracts) {
    const offer = (offersByTeam[c.teamId] ?? []).find((o) => o.offerId === c.offerId);
    const ot = offer ? getSponsorV2Terms(offer) : null;
    const ct = getSponsorV2Terms(c)!;
    if (!ot || ot.curveName !== ct.curveName || ot.clauseName !== ct.clauseName
      || Math.abs(ot.rankLadder[0]! - ct.rankLadder[0]!) > 1e-9) mismatched += 1;
  }
  check(mismatched === 0, `Vertrag traegt die Konditionen des GEWAEHLTEN Angebots`, `${mismatched} Abweichungen`);

  // ── 4/5: Anzeige == Settlement, Monotonie ────────────────────────────────────────────────────
  line("-");
  console.log("4/5) ANZEIGE == SETTLEMENT UND MONOTONIE");
  line("-");
  let ladderMismatch = 0, tierMismatch = 0, nonMonotone = 0;
  for (const c of v2Contracts) {
    const terms = getSponsorV2Terms(c)!;
    const guaranteed = sponsorV2GuaranteedLadder(terms);
    const locked = c.lockedRankPayoutLadder ?? [];
    if (locked.length !== 32 || locked.some((v, i) => Math.abs(v - guaranteed[i]!) > 1e-6)) ladderMismatch += 1;
    const offer = (offersByTeam[c.teamId] ?? []).find((o) => o.offerId === c.offerId);
    if (offer) {
      const preview = buildOfferRankPayoutLadderPreview(gameState, offer);
      const baseCash = offer.components.find((x) => x.kind === "base")?.rewardCash ?? 0;
      for (const row of buildSponsorRankTierRows({ baseCash, rankLadder: preview })) {
        const atRank = guaranteed[Math.min(32, Math.max(1, row.rankAt)) - 1]!;
        if (Math.abs(row.absolutePayout - Math.round(atRank * 10) / 10) > 0.15) tierMismatch += 1;
      }
    }
    for (const clauseMet of [true, false]) {
      for (const goalFraction of [0, 1]) {
        const ladder = Array.from({ length: 32 }, (_, i) => sponsorV2Settle(terms, i + 1, clauseMet, goalFraction));
        for (let r = 1; r < 32; r += 1) if (ladder[r]! > ladder[r - 1]! + 1e-6) { nonMonotone += 1; break; }
      }
    }
  }
  check(ladderMismatch === 0, `eingefrorene Leiter im Vertrag == Modell-Leiter`, `${ladderMismatch} Abweichungen`);
  check(tierMismatch === 0, `angezeigte Gewinnstufen == Leiterwerte`, `${tierMismatch} Abweichungen`);
  check(nonMonotone === 0, `Auszahlungsleiter ueber alle 32 Endraenge monoton`, `${nonMonotone} Verstoesse`);

  // ── 6: Abrechnung ────────────────────────────────────────────────────────────────────────────
  line("-");
  console.log("6) ABRECHNUNG AM SAISONENDE");
  line("-");
  const preview = previewSponsorSettlement(gameState, "season_end");
  const v2Rows = preview.rows.filter((r) => r.componentId.includes(":v2:"));
  const byTeam = new Map<string, number>();
  for (const r of v2Rows) byTeam.set(r.teamId, (byTeam.get(r.teamId) ?? 0) + r.cashDelta);
  check(v2Rows.length > 0, `Settlement erzeugt V2-Zeilen`, `${v2Rows.length} Zeilen fuer ${byTeam.size} Teams`);
  check(v2Rows.length === byTeam.size * 4, `genau vier Zeilen je Vertrag`,
    `${v2Rows.length} statt ${byTeam.size * 4}`);
  const negative = [...byTeam.values()].filter((v) => v <= 0).length;
  check(negative === 0, `kein Team bekommt eine Sponsorsumme <= 0`, `${negative} Faelle`);

  const salaryFactor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor ?? 1;
  const sponsorSum = [...byTeam.values()].reduce((a, b) => a + b, 0);
  const basis = sponsorV2LeagueSalaryBasis(gameState);
  const salarySum = basis.salarySum;
  if (basis.usedReference) {
    console.log(`     HINWEIS: die Liga fuehrt noch keine echten Gehaelter (frisches Spiel vor dem Draft).`);
    console.log(`     K und Deckung laufen deshalb gegen die Referenz ${fmt(salarySum)} C statt gegen`);
    console.log(`     ${fmt(gameState.teams.reduce((a, t) => a + getTeamDisplaySalaryTotal(gameState, t.teamId), 0))} C gemessen.`);
  }
  const coverage = (100 * sponsorSum) / Math.max(1e-9, salarySum);
  const target = salaryFactor * 100;
  const dev = coverage - target;
  console.log(`     Sigma Sponsoren ${fmt(sponsorSum)} C · Sigma Gehaelter ${fmt(salarySum)} C` +
    ` · Deckung ${fmt(coverage)} % gegen Ziel ${fmt(target, 0)} %  (Abweichung ${dev >= 0 ? "+" : ""}${fmt(dev)} Pp)`);
  // ACHTUNG: das ist EIN Wurf. Kriterium 1 des Schattentests erlaubt +-12 Pp, weil die
  // Eigenstreuung des Entwurfs bei +-5.6 bis +-6.8 Pp liegt. Ein einzelner Lauf ausserhalb ist
  // keine Aussage ueber das Modell, ein Lauf WEIT ausserhalb schon.
  check(Math.abs(dev) <= 12, `Liga-Deckung innerhalb der Kriteriums-Toleranz von +-12 Pp`,
    `${dev >= 0 ? "+" : ""}${fmt(dev)} Pp (Eigenstreuung des Entwurfs +-5.6 bis +-6.8 Pp)`);

  const example = v2Contracts[0];
  if (example) {
    const t = getSponsorV2Terms(example)!;
    console.log(`\n     Beispielvertrag ${example.teamId} — ${example.name}`);
    console.log(`       Kurve ${t.curveName} · Profil ${t.profileName} · Rarity ${t.rarity} · Erwartungsrang ${t.expectedRank}`);
    console.log(`       Klausel: ${t.clauseLabel}  (+${fmt(t.clauseBonus)} / −${fmt(t.clauseMalus)}, Schwelle ${t.clauseThreshold ?? "—"})`);
    console.log(`       Sonderziel ${t.goalKey ?? "—"}: ${fmt(t.goalPayout)} C bei ${Math.round(t.goalProbability * 100)} % Erfolgswahrscheinlichkeit`);
    const g = sponsorV2GuaranteedLadder(t);
    console.log(`       garantierte Leiter: Rang 1 ${fmt(g[0]!)} · Rang 8 ${fmt(g[7]!)} · Rang 16 ${fmt(g[15]!)} · Rang 32 ${fmt(g[31]!)} C`);
    for (const r of preview.rows.filter((x) => x.teamId === example.teamId)) {
      console.log(`       ${r.label.padEnd(38)} ${fmt(r.cashDelta).padStart(7)} C   ${r.reason}`);
    }
  }

  line();
  console.log(failures === 0
    ? "ERGEBNIS: alle Pruefungen bestanden — das neue Sponsorsystem laeuft live."
    : `ERGEBNIS: ${failures} Pruefung(en) GERISSEN.`);
  if (PERSIST) console.log(`Spielstand geschrieben: ${saveId} — in der App unter diesem Namen waehlbar.`);
  else console.log("Kein Spielstand geschrieben (kein --persist).");
  line();
  if (failures > 0) process.exitCode = 1;
}

if (require.main === module) main();


// Modul-Marker: ohne Export gilt die Datei als globales Skript und kollidiert ueber
// gleichnamige Bindungen mit den anderen scripts/sponsor-*.ts (TS2451). Dieser Fehler ist im Repo
// bereits dreimal aufgetreten.
export {};
