import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { applyPlannedFormCardsToModifiers, normalizeLineupModifiers } from "@/lib/foundation/form-board-plan-service";
import {
  generateLocalLegacyFormCardsForSeason,
  saveLocalLegacyFormCardPlan,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildGeneratedFormCardRecordsForSeason } from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * Formplan: die Team-Power-Kachel ist raus, Push-Ziele sind rein.
 *
 * Team-Power konnte auf diesem Screen gar nichts planen — Powers werden am
 * Spieltag in der Einsatzliste aktiviert, ein Zukunfts-Plan existiert fuer sie
 * im Datenmodell nicht. Die Kachel zeigte also nur ein Kontingent an einem Ort,
 * an dem geplant werden soll. Die Intensitaet IST dagegen pro Spieltag planbar
 * und ist die eigentliche Entscheidung neben den Karten: Push kostet Fatigue und
 * Strain, man muss sich aussuchen, wo man pusht.
 */
describe("Formplan-Panel: Team-Power raus, Push-Ziele rein", () => {
  const panel = read("app/foundation/legacy-lineup-lab/FormBoardPanel.tsx");

  it("rendert keine Team-Power-Kachel mehr", () => {
    expect(panel).not.toContain("legacy-lineup-form-resource is-power");
    expect(panel).not.toContain("teamPowerBudget");
    expect(panel).not.toContain("getTeamPowerCategoryLabel");
    // Auch der Hinweistext, der die Kachel als reine Anzeige entschuldigt hat.
    expect(panel).not.toContain("Team-Power wird am Spieltag in der Einsatzliste aktiviert");
  });

  it("fuehrt die drei Stufen in einer Quelle und in fester Reihenfolge", () => {
    expect(panel).toContain("const FORM_PLAN_INTENSITY_STAGES");
    const order = [...panel.matchAll(/id: "(conserve|normal|push)"/g)].map(([, id]) => id);
    expect(order.slice(0, 3)).toEqual(["conserve", "normal", "push"]);
    expect(panel).toContain('label: "Schonen"');
    expect(panel).toContain('label: "Normal"');
    expect(panel).toContain('label: "Push"');
  });

  it("bietet je Spieltag-Seite einen Schalter und zaehlt die Rest-Saison im Cockpit", () => {
    expect(panel).toContain("legacy-lineup-form-board-cell-intensity");
    expect(panel).toContain("setFormPlanIntensity({");
    // Nochmal auf die aktive Stufe = Plan wieder offen.
    expect(panel).toContain("intensity: isActive ? null : stage.id");
    // Cockpit-Bilanz zaehlt nur, was noch kommt.
    expect(panel).toContain("const intensityPlanBudget");
    expect(panel).toContain("entry.matchdayIndex < currentMatchdayIndex");
  });

  it("laesst gespielte Spieltage nur noch lesen", () => {
    expect(panel).toContain("legacy-lineup-form-board-cell-intensity is-past");
  });

  it("bringt die Stufen-Farben als Tokens mit", () => {
    const css = read("app/globals.css");
    expect(css).toContain(".legacy-lineup-form-intensity-button.is-push.is-active");
    expect(css).toContain(".legacy-lineup-form-intensity-button.is-conserve.is-active");
    expect(css).toContain(".legacy-lineup-form-intensity-chip.is-push");
    // Die alte Team-Power-Regel im Cockpit ist mit umgezogen.
    expect(css).not.toContain(".legacy-lineup-form-resource.is-power ");
  });
});

/**
 * Der Plan ist eine SAAT, kein Zwang: er faellt in den Entwurf, solange dort noch
 * die Standardstufe steht. Eine am Spieltag bewusst gewaehlte Intensitaet
 * ueberschreibt er nicht — sonst koennte man die Vorplanung nicht mehr korrigieren.
 */
describe("Formplan: geplante Intensitaet als Saat fuer den Entwurf", () => {
  function buildContext(plannedIntensity: "conserve" | "normal" | "push" | null) {
    return {
      matchday: { id: "md-1" },
      team: { id: "team-1" },
      existingDraft: null,
      formCards: [],
      formCardPlans: [
        {
          id: "plan-d1",
          saveId: "save-1",
          seasonId: "season-1",
          teamId: "team-1",
          matchdayId: "md-1",
          disciplineSide: "d1" as const,
          disciplineId: "disc-1",
          primaryFormCardId: null,
          secondaryFormCardId: null,
          plannedIntensity,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as LegacyLineupLoadedContext;
  }

  it("uebernimmt das Push-Ziel in den frischen Entwurf", () => {
    const next = applyPlannedFormCardsToModifiers(buildContext("push"), normalizeLineupModifiers());
    expect(next.d1.intensity).toBe("push");
    // Die Seite ohne Plan bleibt auf dem Standard.
    expect(next.d2.intensity).toBe("normal");
  });

  it("ueberschreibt eine bereits abweichend gewaehlte Intensitaet NICHT", () => {
    const manual = normalizeLineupModifiers({ d1: { intensity: "push" } });
    const next = applyPlannedFormCardsToModifiers(buildContext("conserve"), manual);
    expect(next.d1.intensity).toBe("push");
  });

  it("laesst den Entwurf ohne Push-Ziel unveraendert", () => {
    const next = applyPlannedFormCardsToModifiers(buildContext(null), normalizeLineupModifiers());
    expect(next.d1.intensity).toBe("normal");
  });
});

/**
 * Persistenz: Karten und Push-Ziel liegen im SELBEN Datensatz. Ohne die
 * Dreiwertigkeit (`undefined` = nicht anfassen) wuerde jeder Kartenklick das
 * Push-Ziel derselben Seite mitloeschen — und umgekehrt.
 */
describe("Formplan-Persistenz: Karten und Push-Ziel stoeren sich nicht", () => {
  // Ein frischer Season-1-Save plus Kartengenerierung braucht deutlich mehr als
  // die 5s-Standardgrenze — dieselbe Groessenordnung wie in
  // `legacy-lineup-local-service.test.ts`.
  const SETUP_TIMEOUT_MS = 120_000;

  beforeEach(() => {
    resetDatabaseForTests();
  });

  function setup() {
    const persistence = createPersistenceService();
    const save = persistence.createFreshSeasonOneSave({ name: "Push-Ziel Plan" });
    // Der frische Season-1-Save hat nur EIN Team mit Kader — genau das brauchen wir,
    // sonst gibt es fuer das gewaehlte Team gar keine Formkarten zum Gegenprobieren.
    const teamId = [...save.gameState.teams]
      .map((team) => ({
        teamId: team.teamId,
        rosterCount: save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
      }))
      .sort((left, right) => right.rosterCount - left.rosterCount)[0]!.teamId;
    const params = {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      matchdayId: save.gameState.matchdayState.matchdayId,
      teamId,
    };
    /**
     * DAS TEAM BRAUCHT MINDESTENS EINE KARTE MIT NENNWERT > 0 — und ein frischer Spielstand
     * garantiert das nicht.
     *
     * `FORM_CARD_VALUES` ist `[0, 2, 4, 8]`, gezogen deterministisch aus
     * (saveId, seasonId, teamId, playerId, Vorzeichen). Der saveId traegt einen Zeitstempel, der
     * Wurf faellt also je Lauf anders aus. Und der frische Saison-1-Stand hat genau EINEN
     * Kaderspieler — also genau eine positive Karte, die in **einem Viertel** der Laeufe eine 0
     * ist. Genau daran ist dieser Fall im vollen Lauf gefallen („expected null to be truthy"),
     * einzeln aber immer durchgekommen.
     *
     * Deshalb wird hier gezielt ein freier Spieler nachgelegt, dessen positive Karte
     * nachweislich > 0 ist — gerechnet mit derselben Produktionsfunktion, die auch die Heilung
     * benutzt, statt mit einer nachgebauten Formel.
     */
    const belegt = new Set(save.gameState.rosters.map((entry) => entry.playerId));
    const spenderMitPositiverKarte = save.gameState.players.find((kandidat) => {
      if (belegt.has(kandidat.id)) return false;
      const mitKandidat = {
        ...save.gameState,
        rosters: [
          ...save.gameState.rosters,
          { id: `probe-${kandidat.id}`, teamId, playerId: kandidat.id, joinedSeasonId: params.seasonId },
        ],
      } as typeof save.gameState;
      const karten = buildGeneratedFormCardRecordsForSeason(mitKandidat, save.saveId, params.seasonId);
      return karten.some(
        (karte) => karte.playerId === kandidat.id && karte.id.endsWith(":positive") && karte.cardValue > 0,
      );
    });
    expect(spenderMitPositiverKarte, "kein freier Spieler mit positiver Karte gefunden").toBeTruthy();
    save.gameState.rosters.push({
      id: "push-ziel-kartenspender",
      teamId,
      playerId: spenderMitPositiverKarte!.id,
      contractLength: 3,
      salary: Math.round(spenderMitPositiverKarte!.salaryDemand),
      upkeep: Math.round(spenderMitPositiverKarte!.salaryDemand),
      purchasePrice: Math.round(spenderMitPositiverKarte!.marketValue),
      currentValue: Math.round(spenderMitPositiverKarte!.marketValue),
      roleTag: "bench",
      joinedSeasonId: params.seasonId,
    } as never);
    persistence.saveSingleplayerState(save.saveId, save.gameState);

    expect(generateLocalLegacyFormCardsForSeason(params).ok).toBe(true);
    const scheduleEntry = getSeasonDisciplineSchedule(save.gameState).find(
      (entry) => entry.matchdayId === params.matchdayId,
    );
    return { persistence, params, disciplineId: scheduleEntry?.discipline1?.disciplineId ?? null };
  }

  it("speichert ein Push-Ziel auch ohne Karten", () => {
    const { params, disciplineId } = setup();
    const saved = saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId,
      primaryFormCardId: null,
      secondaryFormCardId: null,
      plannedIntensity: "push",
    });
    expect(saved.ok).toBe(true);
    // Vor der Aenderung wurde ein Plan ohne Karten schlicht geloescht.
    expect(saved.plans.find((plan) => plan.disciplineSide === "d1")?.plannedIntensity).toBe("push");
  }, SETUP_TIMEOUT_MS);

  it("laesst das Push-Ziel stehen, wenn danach nur eine Karte gesetzt wird", () => {
    const { persistence, params, disciplineId } = setup();
    saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId,
      primaryFormCardId: null,
      secondaryFormCardId: null,
      plannedIntensity: "conserve",
    });

    const stored = persistence.getSaveById(params.saveId)!;
    const cardId =
      (stored.gameState.seasonState.formCards ?? []).find(
        (card) => card.seasonId === params.seasonId && card.teamId === params.teamId && card.cardValue > 0,
      )?.id ?? null;
    expect(cardId).toBeTruthy();

    // Kartenklick ohne `plannedIntensity` — das Feld fehlt bewusst.
    const afterCard = saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId,
      primaryFormCardId: cardId,
      secondaryFormCardId: null,
    });
    expect(afterCard.ok).toBe(true);
    const plan = afterCard.plans.find((entry) => entry.disciplineSide === "d1");
    expect(plan?.primaryFormCardId).toBe(cardId);
    expect(plan?.plannedIntensity).toBe("conserve");
  }, SETUP_TIMEOUT_MS);

  it("entfernt das Push-Ziel nur bei explizitem null — und raeumt den leeren Plan dann auf", () => {
    const { params, disciplineId } = setup();
    saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId,
      primaryFormCardId: null,
      secondaryFormCardId: null,
      plannedIntensity: "push",
    });
    const cleared = saveLocalLegacyFormCardPlan({
      ...params,
      disciplineSide: "d1",
      disciplineId,
      primaryFormCardId: null,
      secondaryFormCardId: null,
      plannedIntensity: null,
    });
    expect(cleared.ok).toBe(true);
    expect(cleared.plans.some((plan) => plan.disciplineSide === "d1")).toBe(false);
  }, SETUP_TIMEOUT_MS);
});
