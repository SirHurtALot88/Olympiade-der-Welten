import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

/**
 * DIE EINE LISTE, welche Ansicht das volle Saisonarchiv braucht.
 *
 * Sie stand bis hierher ZWEIMAL im Repo: einmal hier und einmal woertlich ausgeschrieben in
 * `use-foundation-shell-router-body-scope.tsx` (`const shouldLoadSeasonArchive = …`). Die beiden
 * Listen waren nicht gleich, und die Produktion las die falsche. Aufgeloest wurde die Abweichung
 * NICHT durch Vereinheitlichen auf den groesseren Nenner, sondern an dem, was die Ansichten
 * tatsaechlich aus dem Archiv lesen:
 *
 * - `diszis` (Helfer JA, Inline NEIN → JA gewinnt): `diszis` steht in `shouldBuildPpAreaRows`, und
 *   `buildPpAreaFormBonusByTeamId` liest fuer eine ausgewaehlte VERGANGENE Saison
 *   `snapshot.disciplineResults` / `snapshot.matchdayResults`. Genau diese schweren Anhaenge traegt
 *   die mitgefahrene Kurzfassung ausdruecklich NICHT (`alsSchnappschussErsatz`: „Die schweren
 *   Anhaenge … fehlen und bleiben leer"). Ohne vollen Load bleibt der Formbonus dort auf 0.
 *
 * - `teams` (Inline: bedingungslos, Helfer: nur mit `showExtendedTeamPanels` → Helfer gewinnt): die
 *   Archiv-Lesestellen des Teams-Reiters sitzen im Team-Detail-Drawer, also in den erweiterten
 *   Panels. Die Grundtabelle liest keine Schnappschuesse. Bedingungslos zu laden holte je Saison
 *   Megabytes fuer eine Ansicht, die sie nicht anzeigt.
 *
 * - `players` (Inline JA, Helfer NEIN → Helfer gewinnt): die Spielerliste bezieht ihre
 *   Karriere-Zahlen aus dem SERVER-Slice (`playerDirectorySlice.careerStatsByPlayerId`); die lokale
 *   `buildPlayerLeagueCareerStatsMap` ist nur der Rueckfall. Genau dieser Ansichtswechsel ist
 *   ausserdem der in `e37f3513` beschriebene Ausloeser („feuert genau beim Betreten der
 *   Spieleransichten"), und ein Nachladen beim Blaettern ist das teuerste und riskanteste, was hier
 *   passieren kann.
 */
export function shouldLoadSeasonArchiveForView(
  activeView: FoundationViewId,
  options: {
    showExtendedTeamPanels?: boolean;
  } = {},
): boolean {
  if (
    activeView === "season" ||
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    activeView === "leagueLeaders" ||
    activeView === "allTimeTable" ||
    // Finanzen: Cash-Abgleich/Verlauf lesen das Saisonarchiv (Saisonstart-Cash der Vorsaison).
    activeView === "finances" ||
    (activeView === "teams" && options.showExtendedTeamPanels === true)
  ) {
    return true;
  }

  if (activeView === "playerProfile" || activeView === "teamProfile") {
    return true;
  }

  return false;
}

export function isSeasonArchiveLoaded(seasonSnapshots: SeasonSnapshotRecord[] | undefined | null): boolean {
  return seasonSnapshots !== undefined;
}

/**
 * „Noch nicht geholt" heisst hier ausdruecklich AUCH `[]`.
 *
 * Der Grund ist `withCompactSeasonArchiveSentinel`
 * (`lib/foundation/apply-compact-season-archive-sentinel.ts`): die kompakte Anfangsladung streicht
 * `seasonSnapshots` auf `undefined`, und der Browser stempelt an dieselbe Stelle eine LEERE LISTE.
 * Im Browser ist `seasonSnapshots` deshalb nie `undefined` — eine Pruefung auf `undefined` sagt
 * dort immer „liegt vor", auch wenn nie etwas geladen wurde. Am Live-Abbild gemessen (Save
 * `new-game-1785823388048-1hf25q`, Saison 2): voll 1 archivierte Saison, nach compact+Sentinel
 * `seasonSnapshots === []`.
 *
 * Gegen ein Dauerfeuer schuetzt NICHT die Laenge, sondern `seasonArchiveFetchCompleted`: wer einmal
 * geholt hat, fragt nicht wieder — auch dann nicht, wenn die Antwort ehrlich „null Saisons" lautet.
 */
export function isSeasonArchivePendingFetch(input: {
  seasonSnapshots: SeasonSnapshotRecord[] | undefined | null;
  seasonArchiveFetchCompleted?: boolean;
}): boolean {
  if (input.seasonArchiveFetchCompleted) {
    return false;
  }

  if (input.seasonSnapshots === undefined || input.seasonSnapshots === null) {
    return true;
  }

  return input.seasonSnapshots.length === 0;
}

export function shouldRequestSeasonArchiveLoad(input: {
  activeView: FoundationViewId;
  seasonSnapshots: SeasonSnapshotRecord[] | undefined | null;
  showExtendedTeamPanels?: boolean;
  archiveLoadInFlight?: boolean;
  seasonArchiveFetchCompleted?: boolean;
}): boolean {
  if (input.archiveLoadInFlight || input.seasonArchiveFetchCompleted) {
    return false;
  }

  if (!shouldLoadSeasonArchiveForView(input.activeView, {
    showExtendedTeamPanels: input.showExtendedTeamPanels,
  })) {
    return false;
  }

  return isSeasonArchivePendingFetch({
    seasonSnapshots: input.seasonSnapshots,
    seasonArchiveFetchCompleted: input.seasonArchiveFetchCompleted,
  });
}

/**
 * Das nachgeladene Archiv in den laufenden Zustand uebernehmen — die Gegenrichtung zum Gate oben.
 *
 * HIER STAND DERSELBE FEHLER EIN ZWEITES MAL. Der Effekt schrieb
 * `previous.seasonState.seasonSnapshots ?? loadedSnapshots`, und `??` greift nur bei
 * `null`/`undefined`. Hinter dem Sentinel steht dort `[]` — nicht nullish —, also haette der
 * nachgeladene Stand selbst dann nicht uebernommen werden koennen, wenn das Gate ihn je geholt
 * haette. Am Live-Abbild gemessen: `previous ?? geladen` ergibt 0 Saisons, geladen waeren 1.
 *
 * Entschieden wird deshalb an der LAENGE: ein bereits gefuellter Stand (etwa ein parallel
 * eingetroffener Load) gewinnt, ein leerer wird ersetzt.
 */
export function uebernimmGeladenesSaisonarchiv(
  vorher: SeasonSnapshotRecord[] | undefined | null,
  geladen: SeasonSnapshotRecord[] | undefined | null,
): SeasonSnapshotRecord[] {
  if (vorher != null && vorher.length > 0) {
    return vorher;
  }
  return geladen ?? [];
}
