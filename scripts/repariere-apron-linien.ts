/* eslint-disable no-console */
/**
 * REPARIERT DIE APRON-LINIEN EINER BEREITS GESPIELTEN SAISON.
 *
 * GEMELDET VON CHRIS: „apron linien neu berechnen und jede season neu berechnen lassen!"
 *
 * BEFUND (am Live-Abbild gemessen): Der Snapshot der laufenden Saison stammt von einem Build, der
 * die Linien beim Saisonübergang einfror — BEVOR der Kaderbau begann (behoben in #467). Median 45,0
 * eingefroren um 06:05:23, danach kamen alle 106 Zugänge der Saison; der reale Median stand bei
 * 69,8. Weil inzwischen Spieltage gewertet sind, hält `resolveSeasonApronLines` den veralteten
 * Stand bewusst für endgültig — die Selbstheilung aus #467 greift nicht mehr. Folge: 29 Zahler,
 * Topf 550,7 Mio, 2 Empfänger zu je 275,4 Mio, bei Liga-Cash-Ständen von 0 bis 36 Mio.
 *
 * WARUM DIE NEUBERECHNUNG HIER KEINE SCHÄTZUNG IST: Seit dem ersten gewerteten Spieltag gab es in
 * diesem Spielstand NULL Transfers — die heutigen Kader sind exakt die, mit denen die Saison
 * gestartet ist. `computeApronLines` auf dem heutigen Stand liefert damit genau das, was das
 * Einfrieren beim Fensterschluss geliefert hätte. Genau diese Vorbedingung prüft die Schranke in
 * `lib/season/apron-lines-repair.ts`: fanden nach dem ersten gewerteten Spieltag Transfers statt,
 * bricht das Skript ab, statt eine mitten in der Saison verschobene Grenze als Reparatur auszugeben.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf: rechnen, Vorher/Nachher zeigen, nichts schreiben.
 *     Geschrieben wird nur mit `--schreiben`.
 *   - Läuft nur gegen die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine KOPIE
 *     zeigen lassen (siehe CLAUDE.md, Branch `live-save`). Ohne die Variable bricht das Skript ab.
 *   - Blockiert außer bei Transfers auch, wenn: die Saison noch gar nicht gespielt ist (dann heilt
 *     `resolveSeasonApronLines` von selbst), der Snapshot bereits vom korrigierten Fensterschluss-
 *     Einfrieren stammt, die Saisonende-Abrechnung schon gelaufen ist, oder alte und neue Linien
 *     ohnehin identisch sind.
 *   - Herkunftsvermerk am neuen Snapshot: `frozenAtEvent: "recompute_repair"` plus `note` mit
 *     Zeitpunkt und Grund — damit ein reparierter Stand künftig von außen erkennbar ist.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/repariere-apron-linien.ts [--save <saveId>] [--schreiben]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { planeApronLinienReparatur, type ApronRepairBlockGrund } from "@/lib/season/apron-lines-repair";
import type { ApronSettlementPreview } from "@/lib/season/apron-settlement-service";
import type { GameState } from "@/lib/data/olyDataTypes";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let schreiben = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--schreiben") {
      schreiben = true;
    } else if (argv[i] === "--trocken") {
      schreiben = false;
    }
  }
  return { saveId, schreiben };
}

function spalte(text: string | number | null | undefined, breite: number) {
  return String(text ?? "—").padStart(breite);
}

function zahl(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

const BLOCK_ERKLAERUNG: Record<ApronRepairBlockGrund, string> = {
  saison_noch_nicht_gespielt:
    "Die Saison hat noch keinen abgerechneten Spieltag — resolveSeasonApronLines rechnet ohnehin bei jedem Aufruf neu, es gibt nichts zu reparieren.",
  kein_gewertetes_spieltagsergebnis:
    "Kein gewertetes Spieltagsergebnis mit Zeitstempel auffindbar — ohne Stichzeit lässt sich nicht nachweisen, dass seit dem Fensterschluss keine Transfers stattfanden.",
  transfers_nach_erstem_spieltag:
    "Seit dem ersten gewerteten Spieltag gab es Transfers. Die heutigen Kader sind damit NICHT mehr der Stand beim Fensterschluss — eine Neuberechnung wäre eine mitten in der Saison verschobene Grenze, keine Reparatur.",
  snapshot_bereits_vom_fensterschluss:
    "Der Snapshot stammt bereits vom korrigierten Fensterschluss-Einfrieren (frozenAtEvent: buy_window_close) — es gibt nichts zu heilen.",
  saison_bereits_abgerechnet:
    "Die Apron-Saisonende-Abrechnung dieser Saison ist bereits gelaufen — die Cash-Buchungen basieren auf den alten Linien, ein neuer Snapshot würde eine Abrechnung behaupten, die so nie stattfand.",
  linien_bereits_identisch:
    "Alte und neue Linien sind identisch — Schreiben wäre ein Leerlauf.",
};

/** Zahler/Empfänger/Topf/je-Empfänger/größter-Zahler aus einer Settlement-Vorschau ziehen. */
function wirkung(preview: ApronSettlementPreview | null, gameState: GameState) {
  if (!preview) return null;
  const codeVon = new Map(gameState.teams.map((team) => [team.teamId, team.shortCode ?? team.teamId] as const));
  const groesster = [...preview.rows].sort((a, b) => b.abgabe - a.abgabe)[0] ?? null;
  return {
    zahler: preview.zahlerCount,
    empfaenger: preview.empfaengerCount,
    topf: preview.topf,
    jeEmpfaenger: preview.empfaengerCount > 0 ? preview.topf / preview.empfaengerCount : 0,
    groessterZahler:
      groesster && groesster.abgabe > 0
        ? { code: codeVon.get(groesster.teamId) ?? groesster.teamId, abgabe: groesster.abgabe }
        : null,
  };
}

function main() {
  const { saveId: gewaehlt, schreiben } = parseArgs(process.argv.slice(2));

  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error(
      "OLY_APP_SQLITE_PATH ist nicht gesetzt. Dieses Skript läuft nur gegen eine ausdrücklich",
    );
    console.error("benannte KOPIE des Spielstands, nie gegen den Standardpfad. Abbruch.");
    process.exit(2);
    return;
  }

  const persistence = createPersistenceService();
  const start = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!start) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH prüfen.");
    process.exit(2);
    return;
  }
  const gameState = start.gameState;

  console.log(`Datenbank  : ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(`Spielstand : ${start.saveId} — ${start.name}`);
  console.log(`Saison     : ${gameState.season.id}`);
  console.log(`Modus      : ${schreiben ? "SCHREIBEN (Snapshot wird ersetzt)" : "Trockenlauf (es wird nichts geschrieben)"}`);

  const plan = planeApronLinienReparatur(gameState);

  console.log(
    `Stichzeit  : ${plan.ersterGewerteterSpieltag ? `${plan.ersterGewerteterSpieltag.createdAt} (erster gewerteter Spieltag: ${plan.ersterGewerteterSpieltag.matchdayId})` : "—"}`,
  );
  console.log(`Transfers seit Stichzeit: ${plan.transfersNachErstemSpieltag}`);
  if (plan.alteLinien) {
    console.log(
      `Alter Snapshot: createdAt ${plan.alteLinien.createdAt}, Herkunft ${plan.alteLinien.frozenAtEvent ?? "unvermerkt (Alt-Build)"}`,
    );
  } else {
    console.log("Alter Snapshot: keiner für diese Saison vorhanden.");
  }

  console.log(`\nVORHER/NACHHER — Apron-Linien ${plan.seasonId}:`);
  console.log(`${"".padEnd(10)}${spalte("Median", 10)}${spalte("Linie 1", 10)}${spalte("Linie 2", 10)}`);
  console.log(
    `${"alt".padEnd(10)}${spalte(zahl(plan.alteLinien?.medianSalary), 10)}${spalte(zahl(plan.alteLinien?.line1), 10)}${spalte(zahl(plan.alteLinien?.line2), 10)}`,
  );
  console.log(
    `${"neu".padEnd(10)}${spalte(zahl(plan.neueLinien.medianSalary), 10)}${spalte(zahl(plan.neueLinien.line1), 10)}${spalte(zahl(plan.neueLinien.line2), 10)}`,
  );

  const vorher = wirkung(plan.vorher, gameState);
  const nachher = wirkung(plan.nachher, plan.gameStateRepariert ?? gameState);
  console.log(`\nWIRKUNG auf die Saisonende-Abrechnung (previewApronSettlement, Endrang = Rang heute):`);
  console.log(
    `${"".padEnd(10)}${spalte("Zahler", 8)}${spalte("Empfänger", 11)}${spalte("Topf", 10)}${spalte("je Empf.", 10)}${spalte("größter Zahler", 18)}`,
  );
  for (const [name, w] of [
    ["alt", vorher],
    ["neu", nachher],
  ] as const) {
    console.log(
      `${name.padEnd(10)}${spalte(w ? w.zahler : null, 8)}${spalte(w ? w.empfaenger : null, 11)}${spalte(w ? zahl(w.topf) : null, 10)}${spalte(w ? zahl(w.jeEmpfaenger) : null, 10)}${spalte(w?.groessterZahler ? `${w.groessterZahler.code} ${zahl(w.groessterZahler.abgabe)}` : "—", 18)}`,
    );
  }

  // Je-Team-Tabelle: Bemessungsgrundlage und Netto-Wirkung unter alten wie neuen Linien.
  if (plan.vorher && plan.nachher) {
    const altNachTeam = new Map(plan.vorher.rows.map((row) => [row.teamId, row] as const));
    const codeVon = new Map(gameState.teams.map((team) => [team.teamId, team.shortCode ?? team.teamId] as const));
    console.log(`\nJE TEAM (Gehalt geglättet · netto = Ausgleich − Abgabe):`);
    console.log(
      `${"Team".padEnd(8)}${spalte("Gehalt", 9)}${spalte("netto alt", 11)}${spalte("netto neu", 11)}`,
    );
    const zeilen = [...plan.nachher.rows].sort((a, b) => b.salary - a.salary);
    for (const neu of zeilen) {
      const alt = altNachTeam.get(neu.teamId) ?? null;
      console.log(
        `${String(codeVon.get(neu.teamId) ?? neu.teamId).padEnd(8)}${spalte(zahl(neu.salary), 9)}${spalte(alt ? zahl(alt.nettoDelta) : null, 11)}${spalte(zahl(neu.nettoDelta), 11)}`,
      );
    }
  }

  if (plan.blockiert) {
    console.error(`\nBLOCKIERT — es wird NICHT geschrieben. Gründe:`);
    for (const grund of plan.blockGruende) {
      console.error(`  - ${grund}: ${BLOCK_ERKLAERUNG[grund]}`);
    }
    process.exit(1);
    return;
  }

  if (!schreiben) {
    console.log("\nTrockenlauf beendet — nichts geschrieben. Zum Übernehmen mit --schreiben aufrufen.");
    return;
  }

  if (!plan.gameStateRepariert || !plan.neuerSnapshot) {
    console.error("\nInnerer Fehler: Plan ist nicht blockiert, trägt aber keinen reparierten Zustand. Abbruch.");
    process.exit(1);
    return;
  }

  persistence.saveSingleplayerState(start.saveId, plan.gameStateRepariert);
  console.log(
    `\nGeschrieben: apronLinesSnapshot für ${plan.seasonId} ersetzt (Median ${zahl(plan.neuerSnapshot.medianSalary)}, ` +
      `Linien ${zahl(plan.neuerSnapshot.line1)}/${zahl(plan.neuerSnapshot.line2)}), Herkunft vermerkt (recompute_repair).`,
  );
}

main();
