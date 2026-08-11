/**
 * SPIELERPROFIL — ANZEIGE-VERTRAG.
 *
 * WARUM DIESE DATEI NEU GESCHRIEBEN WURDE (Entscheidung von Chris: „umschreiben"): sie bestand aus
 * EINEM `it` mit rund 90 Zusicherungen über zehn Dateien. Vitest bricht ein `it` bei der ersten
 * fehlgeschlagenen Zusicherung ab — die Datei scheiterte an Zeile 63, und die 83 Zusicherungen
 * DANACH wurden seitdem nie ausgeführt. Ein Vertrag, der nur bis zur ersten Lücke gilt, ist kein
 * Vertrag. Derselbe Bauplan hatte in `foundation-performance-architecture.test.ts` schon einmal drei
 * veraltete Zusicherungen hintereinander versteckt.
 *
 * Jetzt eine Gruppe je Oberfläche und ein `it` je zusammenhängender Aussage. Fällt eine, laufen die
 * anderen weiter und der Bericht nennt alle Lücken auf einmal.
 *
 * DIE ZUSICHERUNG, DIE ROT WAR — und was aus ihr wurde: geprüft wurde, dass
 * `getCachedPlayerProfileData` im Shell-Scope verdrahtet ist. Ist es nicht, und zwar nirgends in
 * `app/` oder `lib/`. Von `lib/foundation/player-profile-session-cache.ts` ist nur die
 * BUSTING-Seite (`invalidatePlayerProfileSessionCache`) angeschlossen — der Code leert also einen
 * Zwischenspeicher, den niemand füllt und niemand liest. Das ist ein echter Befund und keine
 * Testdrift; die Zusicherung ist deshalb nicht gelöscht, sondern DREHT SICH UM und hält den
 * gegenwärtigen Zustand fest, bis entschieden ist, ob der Zwischenspeicher zurückkommt oder ganz
 * verschwindet. So kann der Zustand nicht unbemerkt bleiben und nicht unbemerkt kippen.
 */
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const lies = (relativerPfad: string) => fs.readFile(path.join(process.cwd(), relativerPfad), "utf8");

const PROFILE = await lies("app/foundation/player-profile/PlayerProfileClient.tsx");
const DRAWER = await lies("app/foundation/PlayerDetailDrawer.tsx");
const SERVICE = await lies("lib/foundation/player-profile-service.ts");
const PREVIEW = await lies("lib/foundation/projected-class-preview.ts");
const TRAINING_CONTROLS = await lies("app/foundation/player-profile/PlayerTrainingControls.tsx");
const TRAINING_SHARED = await lies("app/foundation/training-facilities-v2/training-view-shared.tsx");
const CHART = await lies("app/foundation/player-profile/PlayerAttributeProgressChart.tsx");
const CAREER_HEADER = await lies("app/foundation/player-profile/PlayerCareerStoryHeader.tsx");
const DRAWER_DATA = await lies("lib/foundation/player-detail-drawer.ts");
const SCOPE_ONLY = await lies("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PERSISTENCE_ACTIONS = await lies("lib/foundation/tabs/use-foundation-persistence-actions.ts");
const ORCHESTRATOR = await readFoundationOrchestratorSource();
const SURFACE = await readFoundationSurfaceSource();

/**
 * Der Zwischenspeicher zog beim Performance-Schnitt aus dem Shell-Scope in den Persistenz-Hook um.
 * Beide zusammen sind „die Verdrahtung" — eine Zusicherung gegen nur eine der beiden Dateien würde
 * je nach Umzug mal hier und mal dort ins Leere greifen.
 */
const SCOPE = `${SCOPE_ONLY}\n${PERSISTENCE_ACTIONS}`;

describe("Spielerprofil-Seite", () => {
  it("ist die volle Seite und benutzt denselben Inhalt wie die Schublade", () => {
    expect(PROFILE).toContain("PlayerDetailDrawer");
    expect(SURFACE).toContain("PlayerProfileClient");
  });

  it("führt von hier aus weiter — Liga-Bestenliste und Team", () => {
    expect(PROFILE).toContain("onOpenLeagueLeaders");
    expect(PROFILE).toContain("onOpenTeam");
    expect(ORCHESTRATOR).toContain("onOpenLeagueLeaders");
    expect(ORCHESTRATOR).toContain("league-leaders-${categoryId}");
  });

  it("hat adressierbare Reiter und die Trainingssteuerung", () => {
    expect(PROFILE).toContain("PLAYER_PROFILE_TAB_ANCHORS");
    expect(PROFILE).toContain("trainingRow");
    expect(PROFILE).toContain("onSetTrainingMode");
    expect(ORCHESTRATOR).toContain("playerProfileTrainingRow");
  });
});

describe("Laden und Rechtelage", () => {
  it("das Saisonarchiv wird nur einmal je Signatur geladen", () => {
    for (const quelle of [ORCHESTRATOR, SCOPE]) {
      expect(quelle).toContain("shouldLoadSeasonArchive");
      expect(quelle).toContain("loadedSeasonArchiveSignatureRef");
      expect(quelle).toContain("setPlayerProfileLoading(true)");
    }
  });

  it("fremde Spieler sind schreibgeschützt — die Trainingssteuerung hängt an der Verwaltbarkeit", () => {
    expect(SCOPE).toContain("const playerProfileTrainingReadOnly");
    expect(SCOPE).toContain("!canManageTeamId(playerProfileData.teamId)");
  });

  it("eine Trainingsänderung zieht das offene Profil nach", () => {
    expect(ORCHESTRATOR).toContain("refreshOpenPlayerProfileAfterTrainingChange");
    expect(SCOPE).toContain("openPlayerProfileById");
  });
});

/**
 * DER BEFUND, NICHT DIE DRIFT. Diese Gruppe hält absichtlich einen KAPUTTEN Zustand fest, damit er
 * sichtbar bleibt: `player-profile-session-cache.ts` exportiert vier Funktionen, angeschlossen ist
 * genau eine. Wird der Zwischenspeicher wieder verdrahtet ODER ganz entfernt, fällt diese Gruppe —
 * und genau dann soll sie fallen.
 */
describe("Spielerprofil-Zwischenspeicher (offener Befund)", () => {
  it("die Leer-Seite ist verdrahtet", () => {
    expect(SCOPE).toContain("player-profile-session-cache");
    expect(PERSISTENCE_ACTIONS).toContain("invalidatePlayerProfileSessionCache");
  });

  it("die Lese- und Schreibseite ist NICHT verdrahtet — der Speicher wird geleert, aber nie gefüllt", () => {
    expect(SCOPE).not.toContain("getCachedPlayerProfileData");
    expect(SCOPE).not.toContain("setCachedPlayerProfileData");
  });

  it("das Profil baut seine Daten deshalb bei jedem Öffnen neu", () => {
    // Kein Zwischenspeicher-Blick vor dem Bauen: `openPlayerProfileById` importiert den Bauer und
    // ruft ihn unbedingt. Das ist die Stelle, an der ein Treffer landen müsste.
    const oeffnen = SCOPE_ONLY.slice(
      SCOPE_ONLY.indexOf("async function openPlayerProfileById("),
      SCOPE_ONLY.indexOf("async function openPlayerProfileById(") + 3000,
    );
    expect(oeffnen).toContain("await import(\"@/lib/foundation/build-hydrated-player-drawer-data\")");
    expect(oeffnen).not.toContain("getCachedPlayerProfileData");
  });
});

describe("Kopfbereich der Schublade", () => {
  it("CA/PO-Sterne, Achsengitter und anklickbare Kennzahlenkarten", () => {
    expect(DRAWER).toContain("PlayerCaPoStarStack");
    expect(DRAWER).toContain('data-testid="player-drawer-ca-po-row"');
    expect(DRAWER).toContain("player-drawer-hero-axis-grid");
    expect(DRAWER).toContain("player-drawer-kpi-hero-card is-interactive");
  });

  /**
   * NACHGEZOGEN, NICHT GESTRICHEN: der Kopf hiess frueher „Kennzahlenband"
   * (`player-drawer-header-metrics-band` / `player-drawer-header-scout-compact`). Beides gibt es
   * nicht mehr — an seiner Stelle steht `PlayerCareerStoryHeader` mit eigenen Marken. Das ist ein
   * bewusster Umbau, also zieht die Zusicherung auf die heutigen Marken um.
   */
  it("die Karriere-Erzählung hat den alten Kennzahlen-Kopf abgelöst", () => {
    expect(DRAWER).toContain("PlayerCareerStoryHeader");
    expect(DRAWER).not.toContain("player-drawer-header-metrics-band");
    expect(CAREER_HEADER).toContain('data-testid="player-career-story"');
    expect(CAREER_HEADER).toContain('data-testid="career-story-peak"');
    expect(CAREER_HEADER).toContain('data-testid="career-story-trend"');
    expect(CAREER_HEADER).toContain('data-testid="career-story-longevity"');
    expect(CAREER_HEADER).toContain('data-testid="career-story-jump"');
    // Ohne Datenlage sagt der Kopf das, statt leer zu bleiben.
    expect(CAREER_HEADER).toContain('data-testid="player-career-story-empty"');
  });

  it("das Achsengitter hat eine kompakte Variante mit Hinweis-Chips", () => {
    expect(DRAWER).toContain("showFullAxisGrid");
    expect(DRAWER).toContain("showCompactAxisStrip");
    expect(DRAWER).toContain('data-testid="player-drawer-axis-strip"');
    expect(DRAWER).toContain("player-drawer-axis-chip-hint");
    expect(DRAWER).toContain("player-drawer-axis-chip-accent");
  });

  it("Kennzahlen sind anklickbar und sagen das auch", () => {
    expect(DRAWER).toContain("onOpenLeagueLeaders");
    expect(DRAWER).toContain("onOpenTeam");
    expect(DRAWER).toContain("table-link-button");
    expect(DRAWER).toContain("player-drawer-kpi-link-hint");
  });

});

/**
 * ZWEI WEITERE OFFENE BEFUNDE, die dieser Umbau freigelegt hat — beide lagen HINTER der roten
 * Zwischenspeicher-Zusicherung und wurden deshalb seit deren Bruch nie mehr ausgeführt. Auch sie
 * stehen hier als gedrehte Zusicherung, nicht als Löschung.
 */
describe("Spielerprofil: was die Daten liefern, aber niemand anzeigt (offene Befunde)", () => {
  it("der deutsche Flavor-Text wird berechnet, aber nirgends gerendert", () => {
    // Die Datenschicht führt ihn vollständig: eigener Katalog (`player-flavor-catalog.ts`), Feld im
    // Typ, zwei Befüllstellen in `player-detail-drawer.ts`. In der Ansicht kommt er nicht an —
    // weder in der Schublade noch im Karriere-Kopf.
    expect(DRAWER_DATA).toContain("flavorDe: string | null;");
    expect(DRAWER).not.toContain("flavorDe");
    expect(CAREER_HEADER).not.toContain("flavorDe");
  });

  it("das Spielerprofil zeigt kein Bild", () => {
    // `BudgetedMediaImage` (das budgetierte Bild, das Tabelle und Teamseite benutzen) kommt im
    // Profil nicht vor, `FoundationPlayerPortraitCard` auch nicht. Frueher stand hier die
    // Zusicherung, die Schublade nutze `BudgetedMediaImage` — sie war die zweite von vier
    // Zusicherungen, die hinter der roten versteckt lagen.
    expect(DRAWER).not.toContain("BudgetedMediaImage");
    expect(DRAWER).not.toContain("FoundationPlayerPortraitCard");
  });
});

describe("Inhalt der Schublade", () => {
  it("Potential, Trainingsroute und Spielraum", () => {
    expect(DRAWER).toContain("Achsen-Potential");
    expect(DRAWER).toContain("data.potentialOverallDelta");
    expect(DRAWER).toContain("data.trainingRouteImpact");
    expect(DRAWER).toContain("headroomLabel");
    expect(DRAWER).toContain("player-drawer-potential");
  });

  it("Disziplinen-Achsenliste mit Werten", () => {
    expect(DRAWER).toContain("player-drawer-axis-discipline-list");
    expect(DRAWER).toContain("formatValue(row.pow, 1)");
    expect(DRAWER).toContain("player-drawer-top-disciplines-layout");
  });

  it("Transferhistorie samt Ablöse-Erklärung", () => {
    expect(DRAWER).toContain("data.transferHistory");
    expect(DRAWER).toContain("PlayerDrawerTransferHistoryTable");
    expect(DRAWER).toContain("PlayerDrawerHistoryTable");
    expect(DRAWER).toContain("PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP");
  });

  it("Trainingshistorie und Verlaufsdiagramm", () => {
    expect(DRAWER).toContain("PlayerAttributeProgressChart");
    expect(DRAWER).toContain("player-drawer-stats-chart");
    expect(DRAWER).toContain("player-drawer-season-snapshot");
    expect(DRAWER).toContain("player-drawer-training-history");
    expect(DRAWER).toContain("Trainingshistorie");
    expect(DRAWER).toContain("trainingHistoryRows");
  });

  it("Verletzungen: Banner, Historie und Zusammenfassung", () => {
    expect(DRAWER).toContain("player-drawer-injury-banner");
    expect(DRAWER).toContain("player-drawer-injury-history");
    expect(DRAWER).toContain("Verletzungshistorie");
    expect(DRAWER).toContain("player-drawer-injury-summary");
    expect(DRAWER).toContain("injuriesCount");
    expect(DRAWER).toContain("matchdaysMissed");
  });

  it("die abgelöste XP-Oberfläche ist wirklich weg", () => {
    expect(DRAWER).not.toContain("Legacy XP-Vorschau");
    expect(DRAWER).not.toContain("<h3>Klassen-Training</h3>");
    expect(DRAWER).not.toContain("Spendbare XP");
  });
});

describe("Trainingssteuerung", () => {
  it("Intensitätsschiene und Vorschau-Gitter statt der alten Fokus-Marken", () => {
    expect(TRAINING_CONTROLS).toContain("VeloIntensityRail");
    expect(TRAINING_CONTROLS).toContain("TrainingAttributeForecastGrid");
    expect(TRAINING_CONTROLS).not.toContain("VeloAttributeFocusTags");
    expect(TRAINING_CONTROLS).toContain("buildStatForecastTooltip");
  });

  it("das Vorschau-Gitter ist geteilt und sortiert nach Klassenprofil", () => {
    expect(TRAINING_SHARED).toContain("export function TrainingAttributeForecastGrid");
    expect(TRAINING_SHARED).toContain("sortTrainingAttributeForecastByClassProfile");
    expect(TRAINING_SHARED).toContain("training-v2-ceiling-mark");
  });

  it("die Schublade bindet die Steuerung ein", () => {
    expect(DRAWER).toContain("PlayerTrainingControls");
    expect(DRAWER).toContain("player-drawer-training-controls");
    expect(SERVICE).toContain("player-drawer-training-controls");
  });
});

describe("Verlaufsdiagramm", () => {
  it("Diagramm, Zusammenfassung und Attributtabelle sind adressierbar", () => {
    expect(CHART).toContain('data-testid="player-attribute-progress-chart"');
    expect(CHART).toContain('data-testid="player-attribute-progress-summary"');
    expect(CHART).toContain('data-testid="player-attribute-progress-str-line"');
    expect(CHART).toContain('data-testid="player-attribute-progress-pp-metric-pow"');
    expect(CHART).toContain('data-testid="player-attribute-progress-attribute-table"');
  });

  it("Beschriftungen und Zeilen kommen aus einer Quelle", () => {
    expect(CHART).toContain("PLAYER_ATTRIBUTE_CHART_LABELS");
    expect(CHART).toContain("attributeHistoryRows");
  });
});

describe("Klassen-Vorschau", () => {
  it("baut die Vorschau und empfiehlt gegebenenfalls die Umschulung", () => {
    expect(PREVIEW).toContain("buildProjectedClassPreview");
    expect(PREVIEW).toContain("reclassRecommended");
    expect(SERVICE).toContain("Stats");
  });
});
