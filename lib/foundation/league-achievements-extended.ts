/**
 * NEUE MEILENSTEINE — Disziplinen, Serien, Wirtschaft, Kaderaufbau.
 *
 * GEWÜNSCHT: „'Erfolge' Tab braucht eigentlich auch noch neue achievements die sinn machen."
 *
 * Die 14 bestehenden Meilensteine (`league-achievements.ts`) decken Ranglisten, Kader-OVR/-Wert,
 * Transfer-ZÄHLER, Tabellenplatz und Saisonabschlüsse ab. Auffällig ist, was fehlt: Von dem,
 * was in diesem Spiel jeden Spieltag tatsächlich passiert — Disziplinen gewinnen, Serien
 * aufbauen — kommt nichts vor. Und die Wirtschaft fehlt ganz, obwohl Sponsoren die
 * Haupteinnahme sind.
 *
 * QUELLEN, alle vorhanden und alle fog-safe (nur das eigene Team):
 * - `disciplineResults` — `rank`, `disciplineId`, Spieltag über `matchdayResultId`
 * - `playerDisciplinePerformances` — `isTop10` je Auftritt
 * - `standings[teamId]` — `startplatz`, `rank`, `sponsorSeason`, `guv`
 * - `transferHistory`, `rosters` (`promisedRole`), `teamCaptains`, `playerMoraleState`
 *
 * KEIN NEUER SCHREIBPFAD nötig: „einmal erreicht"-Zustände über Spieltage sind über
 * Saisonwechsel hinweg reproduzierbar, weil der Snapshot `disciplineResults` 1:1 archiviert.
 *
 * ACHTUNG, HIER STAND EINMAL DAS GEGENTEIL: „weil `disciplineResults` die ganze Saison im State
 * bleiben". Auf dem Server stimmt das, im Browser seit dem kompakten Payload nicht mehr — der
 * beschneidet sie auf den aktiven Spieltag. Alles, was über MEHRERE Spieltage misst, sah damit
 * nur einen: gemessen am Live-Save meldete „Breit aufgestellt" 0 statt 2 von 4 Bereichen und
 * „Lauf" eine längste Serie von 0 statt 2. Dagegen fuhr eine Zeit lang die fertige Bilanz als
 * Projektion mit (`foundationDisciplineTally`); seit `8ec6454b` fahren die `disciplineResults`
 * selbst wieder vollständig mit, die Projektion war danach nachgemessen wirkungslos und ist
 * entfernt. Gerechnet wird wieder an genau einer Stelle: `buildSeasonDisciplineTallyByTeamId`.
 *
 * BEWUSST KEIN PREISGELD. Preisgeld wird in diesem Spiel nie ausgezahlt, es ist ausschliesslich
 * Benchmark — ein Meilenstein darauf wäre ein Ziel, das kein Geld bewegt. Gewertet werden
 * Sponsoreinnahmen und GuV.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { NlTone } from "@/components/foundation/new-look/nl-tones";
import { buildLeagueSeasonAwards } from "@/lib/foundation/league-season-awards";
import {
  buildSeasonDisciplineTallyByTeamId,
  laengsteSpieltagsSerie,
  leereDisziplinBilanz,
  spieltagNummerAusId,
} from "@/lib/foundation/season-discipline-tally";

export type ExtendedAchievement = {
  id: string;
  group: "disciplines" | "streaks" | "economy" | "squad";
  label: string;
  description: string;
  reached: boolean;
  detail: string | null;
  progressLabel: string | null;
  targetLabel: string | null;
  tone: NlTone;
  playerId: string | null;
};

function runde(value: number, stellen = 1) {
  return Number(value.toFixed(stellen));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sortiert = [...values].sort((links, rechts) => links - rechts);
  const mitte = Math.floor(sortiert.length / 2);
  return sortiert.length % 2 === 1 ? sortiert[mitte] : (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

export function buildExtendedLeagueAchievements(gameState: GameState, teamId: string): ExtendedAchievement[] {
  const saisonResultIds = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === gameState.season.id)
      .map((result) => [result.id, result.matchdayId] as const),
  );

  /**
   * Die Disziplin-Kennzahlen entstehen aus `gameState.seasonState.disciplineResults` — und die
   * müssen dafür VOLLSTÄNDIG vorliegen, auch im Browser. Solange die Anfangsladung sie auf den
   * aktiven Spieltag beschnitt, war jede Kennzahl über mehrere Spieltage zu klein (siehe Kopf).
   */
  const disziplinBilanz = buildSeasonDisciplineTallyByTeamId(gameState).get(teamId) ?? leereDisziplinBilanz(teamId);
  const disziplinName = new Map((gameState.disciplines ?? []).map((d) => [d.id, d.name] as const));

  const ergebnisse: ExtendedAchievement[] = [];

  // ============ DISZIPLINEN ============================================
  const siege = disziplinBilanz.siege;
  ergebnisse.push({
    id: "disciplines-first-win",
    group: "disciplines",
    label: "Disziplinsieger",
    description: "Gewinne eine Disziplin an einem Spieltag.",
    reached: siege > 0,
    detail: siege > 0 ? `${siege}× gewonnen` : null,
    progressLabel: siege > 0 ? null : "Noch kein Disziplinsieg",
    targetLabel: siege > 0 ? null : "Ziel: 1 Disziplinsieg",
    tone: "good",
    playerId: null,
  });

  // Doppelschlag: beide Disziplinen DESSELBEN Spieltags gewonnen.
  const bestesSpieltagsDoppel = disziplinBilanz.bestesSpieltagsDoppel;
  ergebnisse.push({
    id: "disciplines-double",
    group: "disciplines",
    label: "Doppelschlag",
    description: "Gewinne beide Disziplinen desselben Spieltags.",
    reached: bestesSpieltagsDoppel >= 2,
    detail: bestesSpieltagsDoppel >= 2 ? "Beide Disziplinen an einem Spieltag" : null,
    progressLabel: bestesSpieltagsDoppel >= 2 ? null : `Bester Spieltag: ${bestesSpieltagsDoppel} von 2`,
    targetLabel: bestesSpieltagsDoppel >= 2 ? null : "Ziel: 2 Siege an einem Spieltag",
    tone: "pow",
    playerId: null,
  });

  // Hausdisziplin: dieselbe Disziplin dreimal in einer Saison gewonnen.
  const besteDisziplinSiege = disziplinBilanz.besteDisziplinSiege;
  const besteDisziplinId = disziplinBilanz.besteDisziplinId;
  const hausdisziplin = besteDisziplinSiege >= 3;
  ergebnisse.push({
    id: "disciplines-home-turf",
    group: "disciplines",
    label: "Hausdisziplin",
    description: "Gewinne dieselbe Disziplin dreimal in einer Saison.",
    reached: hausdisziplin,
    detail: hausdisziplin && besteDisziplinId ? disziplinName.get(besteDisziplinId) ?? besteDisziplinId : null,
    progressLabel: hausdisziplin ? null : `Beste Disziplin: ${besteDisziplinSiege} von 3 Siegen`,
    targetLabel: hausdisziplin ? null : "Ziel: 3 Siege in einer Disziplin",
    tone: "pow",
    playerId: null,
  });

  // Breit aufgestellt: Top-5 in Disziplinen ALLER vier Bereiche.
  const bereicheMitTop5 = disziplinBilanz.bereicheMitTop5;
  ergebnisse.push({
    id: "disciplines-all-areas",
    group: "disciplines",
    label: "Breit aufgestellt",
    description: "Hole in einer Saison eine Top-5-Platzierung in allen vier Bereichen.",
    reached: bereicheMitTop5 >= 4,
    detail: bereicheMitTop5 >= 4 ? "Alle vier Bereiche" : null,
    progressLabel: bereicheMitTop5 >= 4 ? null : `${bereicheMitTop5} von 4 Bereichen`,
    targetLabel: bereicheMitTop5 >= 4 ? null : "Ziel: Top 5 in allen vier Bereichen",
    tone: "spe",
    playerId: null,
  });

  // ============ SERIEN =================================================
  const top3Serie = disziplinBilanz.top3Serie;
  ergebnisse.push({
    id: "streaks-run",
    group: "streaks",
    label: "Lauf",
    description: "Hole an drei Spieltagen in Folge mindestens eine Top-3-Platzierung.",
    reached: top3Serie >= 3,
    detail: top3Serie >= 3 ? `${top3Serie} Spieltage in Folge` : null,
    progressLabel: top3Serie >= 3 ? null : `Längste Serie: ${top3Serie} von 3`,
    targetLabel: top3Serie >= 3 ? null : "Ziel: 3 Spieltage in Folge",
    tone: "good",
    playerId: null,
  });

  // Serientäter: EIN eigener Spieler mit Top-10-Auftritt an 5 Spieltagen in Folge.
  const top10SpieltageJeSpieler = new Map<string, number[]>();
  for (const auftritt of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (auftritt.teamId !== teamId || !auftritt.isTop10) continue;
    const matchdayId = saisonResultIds.get(auftritt.matchdayResultId);
    if (!matchdayId) continue;
    const bisher = top10SpieltageJeSpieler.get(auftritt.playerId) ?? [];
    bisher.push(spieltagNummerAusId(matchdayId));
    top10SpieltageJeSpieler.set(auftritt.playerId, bisher);
  }
  let besteSpielerSerie = 0;
  let serienSpielerId: string | null = null;
  for (const [playerId, spieltage] of top10SpieltageJeSpieler.entries()) {
    const serie = laengsteSpieltagsSerie(spieltage);
    if (serie > besteSpielerSerie) {
      besteSpielerSerie = serie;
      serienSpielerId = playerId;
    }
  }
  const spielerNamen = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));
  ergebnisse.push({
    id: "streaks-player-top10",
    group: "streaks",
    label: "Serientäter",
    description: "Ein Spieler steht an fünf Spieltagen in Folge in den Top 10.",
    reached: besteSpielerSerie >= 5,
    detail:
      besteSpielerSerie >= 5 && serienSpielerId
        ? `${spielerNamen.get(serienSpielerId) ?? serienSpielerId} · ${besteSpielerSerie} Spieltage`
        : null,
    progressLabel: besteSpielerSerie >= 5 ? null : `Längste Serie: ${besteSpielerSerie} von 5`,
    targetLabel: besteSpielerSerie >= 5 ? null : "Ziel: 5 Spieltage in Folge",
    tone: "accent",
    playerId: besteSpielerSerie >= 5 ? serienSpielerId : null,
  });

  /**
   * Der Durchmarsch: mindestens fünf Ränge besser als beim Saisonstart.
   *
   * `startplatz` ist der beim Saisonaufbau vergebene Startrang
   * (`new-game-setup-service`), `rank` der aktuelle. Am echten Spielstand geprüft:
   * A-A trägt `startplatz: 31`, `rank: 27`, `rankDiff: 4` — die Verbesserung ist also
   * `startplatz − rank`, positiv heisst besser geworden. `rankDiff` trägt bereits genau das;
   * gerechnet wird trotzdem aus den beiden Rängen, damit kein zweiter Wert nötig ist, der
   * abweichen könnte.
   */
  const eigeneStandings = gameState.seasonState.standings?.[teamId] ?? null;
  const startplatz = eigeneStandings?.startplatz ?? null;
  const aktuellerRang = eigeneStandings?.rank ?? null;
  const verbesserung = startplatz != null && aktuellerRang != null ? startplatz - aktuellerRang : null;
  ergebnisse.push({
    id: "streaks-climb",
    group: "streaks",
    label: "Der Durchmarsch",
    description: "Verbessere dich um mindestens fünf Ränge gegenüber dem Saisonstart.",
    reached: (verbesserung ?? 0) >= 5,
    detail: (verbesserung ?? 0) >= 5 ? `${verbesserung} Ränge gutgemacht` : null,
    progressLabel:
      (verbesserung ?? 0) >= 5
        ? null
        : verbesserung != null
          ? `${verbesserung} von 5 Rängen (Start #${startplatz}, jetzt #${aktuellerRang})`
          : "Noch kein Startplatz bekannt",
    targetLabel: (verbesserung ?? 0) >= 5 ? null : "Ziel: 5 Ränge besser als zum Start",
    tone: "good",
    playerId: null,
  });

  // ============ WIRTSCHAFT =============================================
  const alleStandings = Object.values(gameState.seasonState.standings ?? {});
  const sponsorWerte = alleStandings
    .map((eintrag) => eintrag.sponsorSeason)
    .filter((wert): wert is number => typeof wert === "number" && Number.isFinite(wert));
  const sponsorMedian = median(sponsorWerte);
  const eigenerSponsor = eigeneStandings?.sponsorSeason ?? null;
  const sponsorReached = eigenerSponsor != null && sponsorMedian != null && eigenerSponsor >= sponsorMedian;
  ergebnisse.push({
    id: "economy-sponsor-median",
    group: "economy",
    label: "Sponsorenliebling",
    description: "Hol dir Sponsoreinnahmen über dem Liga-Median.",
    reached: sponsorReached,
    detail: sponsorReached && eigenerSponsor != null ? `${runde(eigenerSponsor, 1)} Mio Sponsorgeld` : null,
    progressLabel: sponsorReached
      ? null
      : eigenerSponsor == null || sponsorMedian == null
        ? // „Noch keine Sponsordaten" statt gar nichts: ein gesperrter Meilenstein ohne Stand
          // ist nur eine geschlossene Tuer, er sagt dem Spieler nicht, woran es liegt.
          "Noch keine Sponsordaten"
        : `${runde(eigenerSponsor, 1)} von ${runde(sponsorMedian, 1)} Mio`,
    targetLabel: sponsorReached ? null : "Ziel: Sponsoreinnahmen über dem Liga-Median",
    tone: "warn",
    playerId: null,
  });

  const guv = eigeneStandings?.guv ?? null;
  ergebnisse.push({
    id: "economy-break-even",
    group: "economy",
    label: "Schwarze Null",
    description: "Schließe eine Saison mit ausgeglichener oder positiver Bilanz ab.",
    reached: guv != null && guv >= 0,
    detail: guv != null && guv >= 0 ? `GuV ${runde(guv, 1)} Mio` : null,
    progressLabel: guv != null && guv < 0 ? `GuV ${runde(guv, 1)} Mio` : guv == null ? "Noch keine Bilanz" : null,
    targetLabel: guv != null && guv >= 0 ? null : "Ziel: GuV mindestens 0",
    tone: "warn",
    playerId: null,
  });

  /**
   * Transfer-Gewinner: mehr aus Verkäufen eingenommen als für Käufe ausgegeben.
   *
   * Erst ab drei Verkäufen — sonst zählte ein einzelner Glücksgriff bereits als
   * Transferpolitik. Das ist der Unterschied zwischen einem Ergebnis und einem Muster.
   */
  const eigeneTransfers = (gameState.transferHistory ?? []).filter(
    (transfer) => transfer.seasonId === gameState.season.id && (transfer.fromTeamId === teamId || transfer.toTeamId === teamId),
  );
  const verkaeufe = eigeneTransfers.filter((transfer) => transfer.fromTeamId === teamId && transfer.transferType !== "contract_exit");
  const kaeufe = eigeneTransfers.filter((transfer) => transfer.toTeamId === teamId);
  const einnahmen = verkaeufe.reduce((summe, transfer) => summe + (transfer.fee ?? 0), 0);
  const ausgaben = kaeufe.reduce((summe, transfer) => summe + (transfer.fee ?? 0), 0);
  const saldo = runde(einnahmen - ausgaben, 1);
  const transferGewinner = verkaeufe.length >= 3 && saldo > 0;
  ergebnisse.push({
    id: "economy-transfer-profit",
    group: "economy",
    label: "Transfer-Gewinner",
    description: "Nimm bei mindestens drei Verkäufen mehr ein, als du ausgibst.",
    reached: transferGewinner,
    detail: transferGewinner ? `+${saldo} Mio aus ${verkaeufe.length} Verkäufen` : null,
    progressLabel: transferGewinner ? null : `${verkaeufe.length} von 3 Verkäufen · Saldo ${saldo} Mio`,
    targetLabel: transferGewinner ? null : "Ziel: 3 Verkäufe mit positivem Saldo",
    tone: "warn",
    playerId: null,
  });

  // ============ KADERAUFBAU ============================================
  const hatKapitaen = (gameState.teamCaptains ?? []).some((eintrag) => eintrag.teamId === teamId);
  ergebnisse.push({
    id: "squad-captain",
    group: "squad",
    label: "Kapitän ernannt",
    description: "Bestimme einen Kapitän für dein Team.",
    reached: hatKapitaen,
    detail: hatKapitaen ? "Kapitän ist benannt" : null,
    progressLabel: hatKapitaen ? null : "Noch kein Kapitän",
    targetLabel: hatKapitaen ? null : "Ziel: einen Kapitän ernennen",
    tone: "accent",
    playerId: null,
  });

  const eigeneRoster = (gameState.rosters ?? []).filter((eintrag) => eintrag.teamId === teamId);
  const talente = eigeneRoster.filter((eintrag) => eintrag.promisedRole === "prospect").length;
  ergebnisse.push({
    id: "squad-prospects",
    group: "squad",
    label: "Perspektivplanung",
    description: "Führe mindestens drei Spieler als Talente im Kader.",
    reached: talente >= 3,
    detail: talente >= 3 ? `${talente} Talente` : null,
    progressLabel: talente >= 3 ? null : `${talente} von 3 Talenten`,
    targetLabel: talente >= 3 ? null : "Ziel: 3 Spieler mit Rolle Talent",
    tone: "spe",
    playerId: null,
  });

  const eigeneStimmung = (gameState.playerMoraleState ?? []).filter((eintrag) => eintrag.teamId === teamId);
  const unzufriedene = eigeneStimmung.filter(
    (eintrag) => eintrag.visibleMood === "angry" || eintrag.visibleMood === "unhappy",
  ).length;
  const guteStimmung = eigeneStimmung.length > 0 && unzufriedene === 0;
  ergebnisse.push({
    id: "squad-morale",
    group: "squad",
    label: "Gute Stimmung",
    description: "Kein Spieler im Kader ist unzufrieden.",
    reached: guteStimmung,
    detail: guteStimmung ? "Alle zufrieden" : null,
    progressLabel: guteStimmung ? null : `${unzufriedene} unzufrieden`,
    targetLabel: guteStimmung ? null : "Ziel: niemand unzufrieden",
    tone: "good",
    playerId: null,
  });

  /**
   * Treue: ein Spieler seit drei Saisons ununterbrochen im Kader.
   *
   * Messbar über `joinedSeasonId` am Kadereintrag. Vor Saison 3 ist der Meilenstein per
   * Definition unerreichbar — er wird dann mit ehrlichem Fortschritt gezeigt („1 von 3
   * Saisons") statt versteckt.
   */
  const aktuelleSaisonNummer = Number(gameState.season.id.match(/(\d+)$/)?.[1] ?? 1);
  let laengsteZugehoerigkeit = 0;
  let treuerSpielerId: string | null = null;
  for (const eintrag of eigeneRoster) {
    const beitritt = Number(eintrag.joinedSeasonId?.match(/(\d+)$/)?.[1] ?? aktuelleSaisonNummer);
    const saisons = aktuelleSaisonNummer - beitritt + 1;
    if (saisons > laengsteZugehoerigkeit) {
      laengsteZugehoerigkeit = saisons;
      treuerSpielerId = eintrag.playerId;
    }
  }
  const treue = laengsteZugehoerigkeit >= 3;
  ergebnisse.push({
    id: "squad-loyalty",
    group: "squad",
    label: "Treue",
    description: "Ein Spieler steht seit drei Saisons ununterbrochen in deinem Kader.",
    reached: treue,
    detail:
      treue && treuerSpielerId
        ? `${spielerNamen.get(treuerSpielerId) ?? treuerSpielerId} · ${laengsteZugehoerigkeit} Saisons`
        : null,
    progressLabel: treue ? null : `${laengsteZugehoerigkeit} von 3 Saisons`,
    targetLabel: treue ? null : "Ziel: 3 Saisons derselbe Spieler",
    tone: "accent",
    playerId: treue ? treuerSpielerId : null,
  });

  // ============ VERZAHNUNG MIT DEN SAISON-AWARDS =======================
  // Dieselbe Rechnung wie im Liga-Leaders-Reiter, kein zweiter Weg.
  const awards = buildLeagueSeasonAwards(gameState);
  const eigeneSpielerIds = new Set(eigeneRoster.map((eintrag) => eintrag.playerId));
  const eigenerAward = awards.awards.find((award) => eigeneSpielerIds.has(award.playerId)) ?? null;
  ergebnisse.push({
    id: "squad-award-forge",
    group: "squad",
    label: "Award-Schmiede",
    description: "Ein Spieler aus deinem Kader hält einen Saison-Award.",
    reached: eigenerAward != null,
    detail: eigenerAward ? `${eigenerAward.label} · ${eigenerAward.playerName}` : null,
    progressLabel: eigenerAward ? null : "Noch kein Award im Kader",
    targetLabel: eigenerAward ? null : "Ziel: einen Saison-Award halten",
    tone: "warn",
    playerId: eigenerAward?.playerId ?? null,
  });

  return ergebnisse;
}
