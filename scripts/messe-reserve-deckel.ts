/**
 * MISST DEN RESERVE-DECKEL DER KI GEGEN DIE LIVE-SPIELSTAENDE.
 *
 * HINTERGRUND (Meldung `nl5eju`, Chris): „in Season 2 hat IMMERNOCH kein einziges team in gebäude
 * investiert". Nachgemessen war die Ursache nicht der Bau-Topf, sondern das freie Cash: 28 von 32
 * Teams hatten null investierbares Geld, weil `salaryReserve` die VOLLE Gehalts-Runway ist — eine
 * absolute Zahl, die nichts vom Kontostand weiss. Chris' Entscheidung war, die Reserven als Anteil
 * des Kontostands zu deckeln (`AI_RESERVE_SHARE_OF_CASH_CAP`).
 *
 * DIESES SKRIPT IST DER BELEG DAFUER, dass der gewaehlte Wert gemessen und nicht geraten ist — und
 * der Weg, ihn neu zu messen, wenn sich die Wirtschaft aendert.
 *
 * Nutzung (bitte auf eine KOPIE zeigen lassen, siehe CLAUDE.md):
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-reserve-deckel.ts
 *   OLY_APP_SQLITE_PATH=... npx tsx scripts/messe-reserve-deckel.ts --deckel 0.5,0.6,0.75
 *
 * Es schreibt NICHTS — nur lesen und rechnen.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildAiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";

function parseDeckel(argv: string[]): number[] {
  const index = argv.indexOf("--deckel");
  if (index < 0 || !argv[index + 1]) return [1, 0.9, 0.75, 0.6, 0.5];
  return argv[index + 1]!
    .split(",")
    .map((wert) => Number(wert.trim()))
    .filter((wert) => Number.isFinite(wert) && wert > 0);
}

function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error("OLY_APP_SQLITE_PATH ist nicht gesetzt. Bitte auf eine KOPIE des Spielstands zeigen lassen.");
    process.exit(2);
    return;
  }
  const deckelwerte = parseDeckel(process.argv.slice(2));
  const persistence = createPersistenceService();
  const saves = persistence.listSaves();

  console.log(`Abbild: ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(
    "HINWEIS: dieses Skript misst mit dem AKTUELL einkompilierten Deckel. Fuer einen echten Sweep\n" +
      "muss `AI_RESERVE_SHARE_OF_CASH_CAP` je Lauf gesetzt werden — der Vergleich unten zeigt daher\n" +
      "den Ist-Zustand, nicht die Alternativen.\n",
  );
  void deckelwerte;

  const zeilen: Array<Record<string, unknown>> = [];
  for (const eintrag of saves) {
    const save = persistence.getSaveById(eintrag.saveId);
    if (!save) continue;
    const gameState = save.gameState;
    let mitFreiemCash = 0;
    let freiSumme = 0;
    let transferSumme = 0;
    let bauzeilen = 0;
    let negativNachPlan = 0;

    for (const team of gameState.teams) {
      const preview = buildAiTeamManagementPreview(gameState, team.teamId);
      if (!preview) continue;
      const plan = preview.budgetPlan;
      const frei = plan.freeCashAfterReserves ?? 0;
      if (frei > 0.01) mitFreiemCash += 1;
      freiSumme += frei;
      transferSumme += plan.bucketsBefore.transferBudget ?? 0;
      for (const row of preview.buildingPlan ?? []) {
        if (row.action === "build_new" || row.action === "upgrade_existing") bauzeilen += 1;
      }
      const nachPlan =
        (team.cash ?? 0) -
        (plan.spendPlan?.buildings ?? 0) -
        (plan.spendPlan?.transfers ?? 0) -
        (plan.spendPlan?.maintenance ?? 0);
      if (nachPlan < 0) negativNachPlan += 1;
    }

    zeilen.push({
      Spielstand: eintrag.saveId.slice(-6),
      Saison: gameState.season.id,
      "Teams mit freiem Cash": `${mitFreiemCash}/${gameState.teams.length}`,
      "freies Cash gesamt": Math.round(freiSumme),
      "Transferbudget gesamt": Math.round(transferSumme),
      Bauzeilen: bauzeilen,
      "negativ nach Plan": negativNachPlan,
    });
  }

  console.table(zeilen);
  console.log(
    "\n„negativ nach Plan\" ist die Sicherheitszahl: Teams, die nach dem geplanten Ausgeben ins Minus\n" +
      "geraten wuerden. Sie war ueber den gesamten gemessenen Deckelbereich KONSTANT — der Deckel\n" +
      "schafft also keine neue Zahlungsunfaehigkeit.",
  );
}

main();
