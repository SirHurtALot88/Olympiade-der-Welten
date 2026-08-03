/**
 * SPONSOR-ACHSEN-MESSUNG — wie oft, wie stark und wie fair fallen die fuenf V4-Achsen.
 *
 * Seit dem V4-Umbau (#361) sind `kaderpflege`, `entwicklung`, `soliditaet`, `ausbau`, `wachstum` die
 * EINZIGEN Sponsorziele im Spiel. Der alte Katalog aus 27 Bonus- und 6 Golden-Zielen (gemessen von
 * `sponsor-ziele-audit.ts`) wurde entfernt. Damit haengt an diesen fuenf Achsen die gesamte
 * Zielvielfalt: faellt eine Achse nie, faellt sie immer, oder verteilt sie sich schief, hat der
 * Spieler faktisch weniger als fuenf Ziele.
 *
 * DIESELBE FALLE WIE BEIM VORGAENGER-SKRIPT: eine Achse misst gegen die bei ANGEBOTSERZEUGUNG
 * eingefrorene Ausgangslage (`axisbase`/`axisscale`/`axisoffset` im `targetValue`). Erzeugt man
 * Angebote aus einem Endstand und wertet sie gegen denselben Endstand aus, kommt jede Wachstumsachse
 * per Konstruktion auf 0 — das misst nichts. Ausgewertet wird deshalb AUSSCHLIESSLICH gegen die
 * ECHTEN, im Save unterschriebenen Vertraege (`gameState.seasonState.sponsorContractsByTeamId`),
 * deren Ausgangslage beim echten Saisonstart eingefroren wurde — nie gegen frisch erzeugte Angebote.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad-zum-save-store> npx tsx scripts/sponsor-achsen-messung.ts --save <id> [--save <id2> ...]
 */
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import { sponsorV4AxisDefinition, sponsorV4AxisKeyFromSpecialKey } from "@/lib/sponsor/sponsor-v4-axes";
import { SPONSOR_V4_AXIS_KEYS, type SponsorV4AxisKey } from "@/lib/sponsor/sponsor-v3-model";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState } from "@/lib/data/olyDataTypes";

/** Liest den Wert eines `tag:value`-Segments aus einem targetValue — dieselbe Notation wie in
 *  sponsor-objective-evaluator.ts (dort nicht exportiert, deshalb hier dupliziert). */
function taggedTargetValue(targetValue: unknown, tag: string): string | null {
  if (typeof targetValue !== "string") return null;
  const match = new RegExp(`(?:^|;)${tag}:([^;]*)`).exec(targetValue);
  return match ? (match[1] ?? null) : null;
}

function argWerte(name: string): string[] {
  const werte: string[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) werte.push(process.argv[i + 1] as string);
  }
  return werte;
}

type AchsenZeile = {
  key: SponsorV4AxisKey;
  vertraege: number;
  fractions: number[];
  metrics: number[];
  // Erfuellungsgrad derselben Rohmetrik, aber mit den AKTUELLEN scale/offset aus
  // sponsor-v4-axes.ts statt der im Vertrag eingefrorenen. So laesst sich eine Skalenaenderung
  // gegen die Vertraege EINER gemessenen Saison pruefen, ohne einen neuen Save zu brauchen — die
  // Rohmetrik selbst haengt nicht an scale/offset.
  fractionsAktuellerCode: number[];
  // Im Vertrag eingefrorenes Ziel (scale - offset) — fuer die Vorher/Nachher-Gegenueberstellung.
  altesZiel: number | null;
};

function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 0 ? ((sortiert[mitte - 1] ?? 0) + (sortiert[mitte] ?? 0)) / 2 : (sortiert[mitte] ?? 0);
}

function mittelwert(werte: number[]): number {
  if (werte.length === 0) return 0;
  return werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
}

/** Lineare Interpolation zwischen den Rangwerten — ausreichend robust fuer n < 15. */
function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const position = q * (sortiert.length - 1);
  const unten = Math.floor(position);
  const oben = Math.ceil(position);
  if (unten === oben) return sortiert[unten] ?? 0;
  const anteil = position - unten;
  return (sortiert[unten] ?? 0) * (1 - anteil) + (sortiert[oben] ?? 0) * anteil;
}

function main() {
  const saveIds = argWerte("--save");
  if (saveIds.length === 0) {
    console.error("Mindestens ein --save <id> erwarten. Vorhanden im Store:");
    const persistence = createPersistenceService();
    for (const entry of persistence.listSaves()) console.error(`  ${entry.saveId} (${entry.name})`);
    process.exit(1);
  }

  const persistence = createPersistenceService();
  const zeilen = new Map<SponsorV4AxisKey, AchsenZeile>();
  for (const key of SPONSOR_V4_AXIS_KEYS) {
    zeilen.set(key, { key, vertraege: 0, fractions: [], metrics: [], fractionsAktuellerCode: [], altesZiel: null });
  }

  let ausgewerteteVertraege = 0;
  let ausgewerteteSaisons = 0;

  for (const saveId of saveIds) {
    const persisted = persistence.getSaveById(saveId);
    if (!persisted) {
      console.error(`Save ${saveId} nicht im Store — uebersprungen.`);
      continue;
    }
    const gameState = persisted.gameState as GameState;
    const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};
    const teamsMitVertrag = Object.keys(vertraege).length;
    console.error(
      `Save ${saveId} · Saison ${gameState.season.id} · ${gameState.teams.length} Teams · ` +
        `${teamsMitVertrag} mit Sponsorvertrag`,
    );
    ausgewerteteSaisons += 1;

    for (const [teamId, contract] of Object.entries(vertraege)) {
      for (const component of contract.components ?? []) {
        if (component.kind !== "special" || !component.specialKey) continue;
        const axisKey = sponsorV4AxisKeyFromSpecialKey(component.specialKey);
        if (!axisKey) continue; // Kein Achsen-Ziel (z. B. Rang-/Golden-Rest aus dem V3-Modell).
        const zeile = zeilen.get(axisKey);
        if (!zeile) continue;
        const ergebnis = evaluateSpecialComponentStage(gameState, teamId, component);
        if (ergebnis.metric == null) continue; // nicht messbar an diesem Stand
        zeile.vertraege += 1;
        zeile.fractions.push(ergebnis.fraction);
        zeile.metrics.push(ergebnis.metric);
        const definition = sponsorV4AxisDefinition(axisKey);
        const aktuelleFraction = Math.max(0, Math.min(1, (ergebnis.metric + definition.offset) / definition.scale));
        zeile.fractionsAktuellerCode.push(aktuelleFraction);
        if (zeile.altesZiel == null) {
          const altScale = Number(taggedTargetValue(component.targetValue, "axisscale") ?? NaN);
          const altOffset = Number(taggedTargetValue(component.targetValue, "axisoffset") ?? NaN);
          if (Number.isFinite(altScale) && Number.isFinite(altOffset)) zeile.altesZiel = altScale - altOffset;
        }
        ausgewerteteVertraege += 1;
      }
    }
  }

  console.log();
  console.log(`Ausgewertet: ${ausgewerteteSaisons} Saison(en), ${ausgewerteteVertraege} Achsen-Vertragskomponenten.`);
  console.log();
  console.log(
    "| Achse | n | Ø Erfüllung | Median | 0 % (nie) | teilweise | 100 % (voll) | Ø Rohmetrik | Zielwert |",
  );
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");

  for (const key of SPONSOR_V4_AXIS_KEYS) {
    const zeile = zeilen.get(key)!;
    const definition = sponsorV4AxisDefinition(key);
    const ziel = Math.round((definition.scale - definition.offset) * 100) / 100;
    const n = zeile.vertraege;
    const nullQuote = n > 0 ? zeile.fractions.filter((f) => f <= 0).length : 0;
    const vollQuote = n > 0 ? zeile.fractions.filter((f) => f >= 0.999).length : 0;
    const teilQuote = n - nullQuote - vollQuote;
    const avgFraction = mittelwert(zeile.fractions);
    const medFraction = median(zeile.fractions);
    const avgMetric = mittelwert(zeile.metrics);
    console.log(
      `| ${definition.label} (${key}) | ${n} | ${(avgFraction * 100).toFixed(1)} % | ` +
        `${(medFraction * 100).toFixed(1)} % | ${nullQuote} | ${teilQuote} | ${vollQuote} | ` +
        `${avgMetric.toFixed(2)}${definition.unit} | ${ziel}${definition.unit} |`,
    );
  }
  console.log();

  // VORHER/NACHHER: dieselbe Rohmetrik derselben Vertraege, einmal mit den im Vertrag eingefrorenen
  // scale/offset (Stand bei Angebotserzeugung) und einmal mit den AKTUELLEN scale/offset aus
  // sponsor-v4-axes.ts. Zeigt die Wirkung einer Skalenaenderung, ohne einen neuen Save zu brauchen.
  console.log("Vorher/Nachher — Ø Erfüllung mit altem vs. aktuellem Zielwert (dieselbe Rohmetrik):");
  console.log("| Achse | n | Zielwert alt | Zielwert aktuell | Ø Erfüllung alt | Ø Erfüllung aktueller Code |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const key of SPONSOR_V4_AXIS_KEYS) {
    const zeile = zeilen.get(key)!;
    const definition = sponsorV4AxisDefinition(key);
    const aktuellesZiel = Math.round((definition.scale - definition.offset) * 100) / 100;
    const n = zeile.vertraege;
    if (n === 0) {
      console.log(`| ${definition.label} (${key}) | 0 | — | ${aktuellesZiel}${definition.unit} | — | — |`);
      continue;
    }
    console.log(
      `| ${definition.label} (${key}) | ${n} | ${zeile.altesZiel ?? "?"}${definition.unit} | ` +
        `${aktuellesZiel}${definition.unit} | ${(mittelwert(zeile.fractions) * 100).toFixed(1)} % | ` +
        `${(mittelwert(zeile.fractionsAktuellerCode) * 100).toFixed(1)} % |`,
    );
  }
  console.log();

  // Verteilung der ROHMETRIK je Achse — der Mittelwert allein verdeckt Ausreisser und sagt nichts
  // darueber, wo die Haelfte der Teams tatsaechlich landet. Fuer die Skalenkalibrierung zaehlt der
  // Median (p50), nicht der Mittelwert.
  console.log("Verteilung der Rohmetrik je Achse (p10..p90, aus den Vertragswerten dieser Saison):");
  console.log("| Achse | n | min | p10 | p25 | p50 (Median) | p75 | p90 | max |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const key of SPONSOR_V4_AXIS_KEYS) {
    const zeile = zeilen.get(key)!;
    const definition = sponsorV4AxisDefinition(key);
    const m = zeile.metrics;
    if (m.length === 0) {
      console.log(`| ${definition.label} (${key}) | 0 | — | — | — | — | — | — | — |`);
      continue;
    }
    const sortiert = [...m].sort((a, b) => a - b);
    console.log(
      `| ${definition.label} (${key}) | ${m.length} | ${(sortiert[0] ?? 0).toFixed(2)} | ` +
        `${quantil(m, 0.1).toFixed(2)} | ${quantil(m, 0.25).toFixed(2)} | ${quantil(m, 0.5).toFixed(2)} | ` +
        `${quantil(m, 0.75).toFixed(2)} | ${quantil(m, 0.9).toFixed(2)} | ` +
        `${(sortiert[sortiert.length - 1] ?? 0).toFixed(2)} |${definition.unit}`,
    );
  }
  console.log();

  // Bei n < 15 verdeckt selbst ein Quantil noch zu viel — die sortierte Rohliste zeigt jeden
  // einzelnen Vertrag und macht Kalibrierung nachvollziehbar statt geschaetzt.
  console.log("Sortierte Rohmetrik je Achse (jeder Vertrag einzeln):");
  for (const key of SPONSOR_V4_AXIS_KEYS) {
    const zeile = zeilen.get(key)!;
    const definition = sponsorV4AxisDefinition(key);
    const sortiert = [...zeile.metrics].sort((a, b) => a - b);
    console.log(`  ${key}: [${sortiert.map((w) => w.toFixed(2)).join(", ")}]${definition.unit}`);
  }
  console.log();

  // Der eigentliche Befund: was faktisch tot ist (nie faellt = verstecktes Preisschild) und was
  // faktisch eine Gehaltserhoehung ist (immer faellt).
  console.log("Befund je Achse (nur bei n >= 5 gewertet, sonst Stichprobe zu duenn):");
  for (const key of SPONSOR_V4_AXIS_KEYS) {
    const zeile = zeilen.get(key)!;
    const n = zeile.vertraege;
    if (n < 5) {
      console.log(`  ${key}: n=${n} — zu wenige Vertraege fuer eine Aussage.`);
      continue;
    }
    const avgFraction = mittelwert(zeile.fractions);
    let einordnung = "im Zielkorridor";
    if (avgFraction <= 0.05) einordnung = "faktisch verstecktes Preisschild (faellt praktisch nie)";
    else if (avgFraction >= 0.95) einordnung = "faktisch verkappte Gehaltserhoehung (faellt praktisch immer)";
    else if (avgFraction < 0.35) einordnung = "zu schwer";
    else if (avgFraction > 0.65) einordnung = "zu leicht";
    console.log(`  ${key}: n=${n}, Ø ${(avgFraction * 100).toFixed(1)} % — ${einordnung}`);
  }
}

main();
