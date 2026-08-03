/**
 * SPONSOR-ZIELE-AUDIT — welches Sonderziel taugt, welches nicht.
 *
 * Der Katalog fuehrt 27 Bonusziele plus 6 Golden-Ziele. Diese Masse ist selbst das Problem: jedes
 * Ziel braucht ein Staerke-Gate, eine eigene Stufenleiter und ENV-Stellschrauben, damit es fuer das
 * Team, dem es angeboten wird, ueberhaupt erreichbar ist. Wo so viel Kruecke noetig ist, misst das
 * Ziel nicht mehr das, was es verspricht.
 *
 * Bevor man auf Gefuehl schneidet, misst man. Dieses Skript beantwortet zwei Fragen an einem
 * ECHTEN, gespielten Spielstand:
 *
 *   1. WIRD ES ANGEBOTEN?  Ueber alle Teams und mehrere Saison-Seeds gezaehlt. Ein Ziel, das der
 *      Picker nie zieht, ist tot — die Staerke-Gates koennen es faktisch aus dem Katalog nehmen,
 *      ohne dass man es dem Katalog ansieht.
 *   2. WIRD ES ERFUELLT?   Gegen den ECHTEN Endstand derselben Saison ausgewertet. Ein Ziel, das
 *      nie erfuellt wird, ist ein verstecktes Preisschild (der Vertrag zieht `p*G` ab und zahlt nie
 *      aus); eines, das IMMER erfuellt wird, ist eine verkappte Gehaltserhoehung.
 *
 * Beides ist ein Ausschlussgrund, unabhaengig davon, wie gut ein Ziel auf dem Papier klingt.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad-zum-save-store> npx tsx scripts/sponsor-ziele-audit.ts [--save <id>] [--seeds 8]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import type { GameState, SponsorOffer } from "@/lib/data/olyDataTypes";

type Zeile = {
  key: string;
  angebote: number;
  /** Wie oft die Auswertung ueberhaupt eine Zahl liefert (sonst: nicht messbar an diesem Stand). */
  messbar: number;
  voll: number;
  teilweise: number;
  null_: number;
  summeAnteil: number;
};

function argWert(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function specialKeysOf(offer: SponsorOffer): string[] {
  return offer.components
    .filter((component) => component.kind === "special" && component.specialKey)
    .map((component) => component.specialKey as string);
}

function main() {
  const saveId = argWert("--save") ?? "new-game-1785174792968-8d7mdx";
  const seeds = Number(argWert("--seeds") ?? 8);

  const persistence = createPersistenceService();
  const save = persistence.listSaves().find((entry) => entry.saveId === saveId);
  if (!save) {
    console.error(`Save ${saveId} nicht im Store. Vorhanden:`);
    for (const entry of persistence.listSaves()) console.error(`  ${entry.saveId}`);
    process.exit(1);
  }
  const gameState = persistence.getSaveById(saveId)!.gameState as GameState;
  const teams = gameState.teams;
  console.log(`Save ${saveId} · ${teams.length} Teams · Saison ${gameState.season.id}`);
  console.log(`Angebots-Seeds: ${seeds} (dieselben Teams, ${seeds} verschiedene Saison-Ids)`);
  console.log();

  const zeilen = new Map<string, Zeile>();
  const hole = (key: string): Zeile => {
    const vorhanden = zeilen.get(key);
    if (vorhanden) return vorhanden;
    const neu: Zeile = { key, angebote: 0, messbar: 0, voll: 0, teilweise: 0, null_: 0, summeAnteil: 0 };
    zeilen.set(key, neu);
    return neu;
  };

  // Die Angebotserzeugung ist deterministisch je (seasonId, teamId). Um die Haeufigkeit nicht an
  // einem einzigen Wurf zu messen, wird sie ueber mehrere kuenstliche Saison-Ids wiederholt; der
  // ZUSTAND bleibt derselbe, es variiert nur der Wurf.
  for (let seed = 0; seed < seeds; seed += 1) {
    const seedState: GameState =
      seed === 0
        ? gameState
        : { ...gameState, season: { ...gameState.season, id: `${gameState.season.id}-audit${seed}` } };

    for (const team of teams) {
      let offers: SponsorOffer[];
      try {
        offers = buildSponsorOffersForTeam({ gameState: seedState, teamId: team.teamId });
      } catch (fehler) {
        console.error(`  Angebotserzeugung fuer ${team.shortCode} (Seed ${seed}) fehlgeschlagen:`, fehler);
        continue;
      }
      for (const offer of offers) {
        for (const key of specialKeysOf(offer)) {
          hole(key).angebote += 1;
        }
      }
    }
  }

  // ERFUELLUNG NUR AUS DEN ECHTEN, UNTERSCHRIEBENEN VERTRAEGEN.
  //
  // Eine Achse misst gegen die bei ANGEBOTSERZEUGUNG eingefrorene Ausgangslage (`axisbase` im
  // targetValue). Wertet man frisch erzeugte Angebote gegen denselben Stand aus, aus dem sie
  // erzeugt wurden, ist die Ausgangslage der Endstand — jede Wachstumsachse kommt dann per
  // Konstruktion auf 0, ohne dass das irgendetwas ueber das Ziel aussagt. Nur die Vertraege im
  // Save tragen eine Ausgangslage vom echten Saisonstart.
  const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};
  let ausgewerteteVertraege = 0;
  for (const [teamId, contract] of Object.entries(vertraege)) {
    for (const component of contract.components ?? []) {
      if (component.kind !== "special" || !component.specialKey) continue;
      const zeile = hole(component.specialKey);
      const ergebnis = evaluateSpecialComponentStage(gameState, teamId, component);
      zeile.messbar += 1;
      zeile.summeAnteil += ergebnis.fraction;
      if (ergebnis.fraction >= 0.999) zeile.voll += 1;
      else if (ergebnis.fraction > 0) zeile.teilweise += 1;
      else zeile.null_ += 1;
      ausgewerteteVertraege += 1;
    }
  }
  console.log(`Erfuellung ausgewertet an ${ausgewerteteVertraege} unterschriebenen Vertragskomponenten.`);
  console.log();

  const sortiert = [...zeilen.values()].sort((links, rechts) => rechts.angebote - links.angebote);
  const gesamtAngebote = sortiert.reduce((summe, zeile) => summe + zeile.angebote, 0);

  console.log("| Ziel | Angebote | Anteil | ausgewertet | voll | teilw. | null | Ø Erfüllung |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const zeile of sortiert) {
    const quote = zeile.messbar > 0 ? zeile.summeAnteil / zeile.messbar : 0;
    console.log(
      `| ${zeile.key} | ${zeile.angebote} | ${((zeile.angebote / gesamtAngebote) * 100).toFixed(1)} % | ` +
        `${zeile.messbar} | ${zeile.voll} | ${zeile.teilweise} | ${zeile.null_} | ${(quote * 100).toFixed(0)} % |`,
    );
  }
  console.log();
  console.log(`${sortiert.length} verschiedene Ziele in ${gesamtAngebote} Angebots-Komponenten.`);

  // Der eigentliche Befund: was nie kommt und was immer faellt.
  const nieAngeboten = sortiert.filter((zeile) => zeile.angebote === 0);
  const nieErfuellt = sortiert.filter((zeile) => zeile.messbar >= 5 && zeile.summeAnteil === 0);
  const immerErfuellt = sortiert.filter(
    (zeile) => zeile.messbar >= 5 && zeile.summeAnteil / zeile.messbar >= 0.999,
  );
  console.log();
  console.log(`NIE ANGEBOTEN (tot): ${nieAngeboten.map((z) => z.key).join(", ") || "—"}`);
  console.log(`NIE ERFUELLT (verstecktes Preisschild): ${nieErfuellt.map((z) => z.key).join(", ") || "—"}`);
  console.log(`IMMER ERFUELLT (verkappte Gehaltserhoehung): ${immerErfuellt.map((z) => z.key).join(", ") || "—"}`);
}

main();
