/**
 * GEMELDET VON CHRIS: „hier wird das cash auch noch falsch gezeigt … alles was finanzen angeht
 * oder auch punkte etc sollen gesnapshottet werden BEVOR spieler verkauft werden!"
 *
 * BEFUND (am Live-Spielstand nachgemessen): Die Historienzeile mischte DREI Zeitpunkte —
 *
 *   Cash    (`cashEnd`)             → Stand NACH den Verkäufen
 *   Gehalt  (`salaryTotalEnd`)      → Eintrittsstand der FOLGE-Saison
 *   MW      (`marketValueTotalEnd`) → Eintrittsstand der FOLGE-Saison
 *   Punkte/Rang/GuV                 → Saisonabschluss (korrekt)
 *
 * Zwei der drei Zahlen stammten also aus einer anderen Saison. Grund: Der Eintritts-Patch
 * (`patchCompletedSeasonSnapshotAfterPreseasonBuy`) überschreibt Gehalt, Marktwert und Kadergröße
 * im fertigen Datensatz mit dem Stand nach den Käufen — bewusst, für Ewige Tabelle und Finanzen.
 * Die Historie las nur zufällig dieselben Felder.
 *
 * Neu: ein gemeinsamer, write-once eingefrorener Block (`cashSeasonEnd`, `salarySeasonEnd`,
 * `rosterSeasonEnd`, `marketValueSeasonEnd`) zum Ende von `player_development` — nach dem
 * Trainings-Apply, vor dem ersten Verkauf.
 *
 * NACHTRAG ZU CASH. An L-K fiel auf, dass der Saisonabschluss für den Kontostand die falsche Frage
 * beantwortet: die Zeile trug 137,4, das Team hatte vor dem Ausverkauf 9,4 und ging mit 25,6 in die
 * Folgesaison. Chris' Entscheidung: die Cash-Spalte zeigt `cashEntry` — den Eintrittsstand der
 * Folgesaison, dieselbe Wahl wie in der Ewigen Tabelle. Gehalt und Marktwert bleiben auf dem
 * eingefrorenen Saisonabschluss; die Spalten stehen damit bewusst auf zwei Zeitpunkten, und der
 * Spaltenkopf sagt es an.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const snapshotService = readFileSync(join(root, "lib/season/season-snapshot-service.ts"), "utf8");
const transitionService = readFileSync(join(root, "lib/season/season-transition-service.ts"), "utf8");
const preseasonWorkflow = readFileSync(join(root, "lib/season/preseason-workflow-service.ts"), "utf8");
const historyReader = readFileSync(
  join(root, "lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts"),
  "utf8",
);
const projection = readFileSync(join(root, "lib/persistence/foundation-season-history-projection.ts"), "utf8");
const allTimeReader = readFileSync(join(root, "lib/foundation/all-time-table.ts"), "utf8");

describe("Saison-Snapshot · ein Zeitpunkt für alle Momentwerte", () => {
  it("friert Cash, Gehalt und Kadergröße gemeinsam mit dem Marktwert ein", () => {
    expect(snapshotService).toContain("cashSeasonEnd: record.cashSeasonEnd ??");
    expect(snapshotService).toContain("salarySeasonEnd: record.salarySeasonEnd ??");
    expect(snapshotService).toContain("rosterSeasonEnd: record.rosterSeasonEnd ??");
  });

  it("schreibt jedes Feld nur einmal (write-once)", () => {
    // Ein zweiter Durchlauf darf die Historie nicht nachträglich verschieben — genau das
    // hat der Eintritts-Patch bei den alten Feldern getan.
    for (const feld of ["cashSeasonEnd", "salarySeasonEnd", "rosterSeasonEnd", "marketValueSeasonEnd"]) {
      // Der Umbruch im Quelltext ist erlaubt — geprüft wird die Zuweisung, nicht ihre Formatierung.
      expect(snapshotService).toMatch(new RegExp(`${feld}:\\s*record\\.${feld} \\?\\?`));
    }
  });

  it("hält den Zeitpunkt des Einfrierens fest", () => {
    expect(snapshotService).toContain("seasonEndFrozenAt: record.seasonEndFrozenAt ??");
  });
});

describe("Saison-Snapshot · der Freeze hängt nicht an der Entwicklung", () => {
  it("holt ihn vor der Verkaufsphase nach", () => {
    // Lief die Entwicklung nicht durch, gab es vorher gar keinen Freeze — auf dem
    // Live-Save trug kein einziges Team `marketValueSeasonEnd`.
    expect(transitionService).toMatch(
      /computed\.appliedStep === "transfer_sell_phase"[\s\S]{0,200}patchSeasonSnapshotMarketValueAfterProgression/,
    );
  });

  it("verkauft erst nach dem Einfrieren", () => {
    const freezeIndex = transitionService.indexOf("const gameStateVorVerkaeufen");
    const sellIndex = transitionService.indexOf("runSeasonEndAiSellsIfDue({");
    expect(freezeIndex).toBeGreaterThan(-1);
    expect(sellIndex).toBeGreaterThan(freezeIndex);
  });
});

describe("Saison-Snapshot · der Freeze legt an, statt aufzugeben", () => {
  it("baut den Snapshot, wenn zu diesem Zeitpunkt noch keiner existiert", () => {
    // DIE eigentliche Ursache: Der Snapshot entsteht nur im Cockpit-Pfad vor der Kette.
    // Wer über das Saisonende-Panel spielt, hatte hier gar keinen — der Freeze gab
    // still `patched: false` zurück und erst der Notbehelf baute später einen, da lagen
    // die Verkäufe aber schon dahinter.
    expect(snapshotService).toMatch(
      /vorhandenerIndex < 0[\s\S]{0,200}upsertSeasonSnapshotRecord\(vorhandeneSnapshots, buildSeasonSnapshot\(gameState, seasonId\)\)/,
    );
  });
});

describe("Saison-Snapshot · Notbehelf gibt sich zu erkennen", () => {
  it("markiert nachträglich gebaute Snapshots als post_sell_fallback", () => {
    // Auf dem Live-Save entstand der Datensatz drei Tage nach 49 Verkäufen über genau
    // diesen Weg. Er darf keinen Saisonstand behaupten, den er nicht hat.
    expect(preseasonWorkflow).toContain('economySnapshotSource: "post_sell_fallback"');
  });

  it("friert dort KEINE Wirtschaftsfelder ein", () => {
    // Eine falsche Zahl ist schlimmer als ein sichtbares "—".
    expect(preseasonWorkflow).not.toContain("cashSeasonEnd:");
    expect(preseasonWorkflow).not.toContain("salarySeasonEnd:");
  });
});

describe("Saison-Snapshot · die Historie liest den eingefrorenen Stand", () => {
  it("bevorzugt die SeasonEnd-Felder bei Gehalt und Marktwert in beiden Lesepfaden", () => {
    expect(historyReader).toMatch(/salarySeasonEnd \?\? teamSnapshot\.salaryTotalEnd/);
    expect(historyReader).toMatch(/salarySeasonEnd \?\? teamEintrag\.salaryTotalEnd/);
    expect(historyReader).toMatch(/marketValueSeasonEnd \?\?\s*teamSnapshot\.marketValueTotalEnd/);
    expect(historyReader).toMatch(/marketValueSeasonEnd \?\?\s*teamEintrag\.marketValueTotalEnd/);
  });

  it("liest Cash in der HISTORIE als Eintrittsstand der Folgesaison", () => {
    // Die Historie zeigt `cashEntry`: das Geld, mit dem das Team wirklich losgespielt hat.
    // `cashCarryOver` darf dazwischenstehen (Kontostand an der Saisongrenze, nach der
    // Vertragsalterung und vor den Kaeufen) — was hier festgehalten wird, ist: `cashEntry` ZUERST,
    // und der Saisonend-Stand erst als Rueckfall dahinter.
    const treffer = historyReader.match(
      /cashEntry \?\?\s*(?:teamSnapshot\.cashCarryOver \?\?\s*)?teamSnapshot\.cashSeasonEnd|cashEntry \?\?\s*(?:teamEintrag\.cashCarryOver \?\?\s*)?teamEintrag\.cashSeasonEnd/g,
    );
    expect(treffer?.length).toBe(2);
  });

  /**
   * DIE EWIGE TABELLE ANTWORTET SEIT DEM 22.08. AUF EINE ANDERE FRAGE — und das ist Absicht.
   *
   * Chris' Entscheidung: „ewige tabelle immer zum ende der saison speichern also in Season 2 sehe
   * ich dort Season 1 ergebnisse." Eine EWIGE Tabelle sagt, was eine Saison gebracht hat; die
   * Historie sagt, womit das Team weiterspielte. Zwei Fragen, zwei Felder — beide im Snapshot.
   *
   * `cashEnd` waere in BEIDEN falsch: es traegt den Stand NACH den Verkaeufen (an `1hf25q`
   * gemessen bei `L-K` 137,4 statt 25,6 beim Eintritt). Der Wert, den Chris meint, ist
   * `cashSeasonEnd` — Ende `player_development`, also nach Sponsorgeld und Gehaltsabzug und vor
   * dem ersten Verkauf (olyDataTypes.ts:2654, season-transition-service.ts:112).
   */
  it("liest Cash in der EWIGEN TABELLE als Saisonende VOR den Verkaeufen", () => {
    expect(allTimeReader).toMatch(/cash:\s*record\.cashSeasonEnd \?\? record\.cashCarryOver/);
    // Der Stand nach dem Ausverkauf darf dort nicht vorn stehen.
    expect(allTimeReader).not.toMatch(/cash:\s*record\.cashEnd/);
  });

  it("behält die Rückfallkette für Altsaisons ohne Freeze", () => {
    // Saison 1 hat keinen Freeze und bekommt auch keinen — rückrechnen ginge nur über
    // Schätzungen. Sie zeigt weiter ihre alten Werte, statt leer zu laufen. Ohne
    // Eintritts-Patch (letzte archivierte Saison vor der nächsten Vorbereitung) greift
    // zuerst der eingefrorene Saisonabschluss, erst danach die überschriebenen Altfelder.
    expect(historyReader).toMatch(
      /cashEntry \?\?\s*(?:teamSnapshot\.cashCarryOver \?\?\s*)?teamSnapshot\.cashSeasonEnd \?\?\s*teamSnapshot\.cashEnd \?\?\s*teamSnapshot\.cashTotal/,
    );
  });

  it("reicht die neuen Felder bis in den Browser durch", () => {
    // Ohne die Projektion kämen sie nie an und die Historie liefe weiter auf den alten.
    for (const feld of ["cashSeasonEnd", "salarySeasonEnd", "rosterSeasonEnd"]) {
      expect(projection).toContain(`${feld}: zahlOderNull(record.${feld})`);
      expect(projection).toContain(`${feld}: team.${feld}`);
    }
  });
});
