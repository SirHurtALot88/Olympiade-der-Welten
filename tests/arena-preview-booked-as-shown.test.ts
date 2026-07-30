import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildMatchdayArenaBaseSessionKey,
  buildMatchdayLineupRevision,
} from "@/lib/foundation/matchday-arena-session-cache";

const REPO_ROOT = process.cwd();
const ARENA = readFileSync(join(REPO_ROOT, "app/foundation/discipline-stage/DisciplineStageArena.tsx"), "utf8");
const SCOPE = readFileSync(
  join(REPO_ROOT, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);
const HANDLERS = readFileSync(join(REPO_ROOT, "lib/foundation/tabs/cockpit-matchday-handlers.ts"), "utf8");
const AUTO_RUN = readFileSync(join(REPO_ROOT, "lib/season/matchday-auto-run-service.ts"), "utf8");
const ROUTE = readFileSync(join(REPO_ROOT, "app/api/season/matchday-auto-run/route.ts"), "utf8");

/**
 * „Wichtig ist, dass das Ergebnis, das man sieht, auch das ist, was in den Saisonstand geschrieben
 * wird." — Die Kette dahinter geht ueber fuenf Dateien; faellt an EINER Stelle die Preview weg,
 * rechnet der Server wieder selbst und niemand merkt es. Deshalb ist hier jedes Glied festgehalten.
 */
describe("Die Arena-Preview wandert bis in die Buchung", () => {
  it("die Buehne gibt die abgespielte Preview an den Commit weiter", () => {
    expect(ARENA).toContain("void onCommitDiscipline(side, preview)");
  });

  it("der Commit reicht sie an den Auto-Run weiter", () => {
    expect(SCOPE).toContain("runCockpitMatchdayAutoRun(true, side, false, shownPreview)");
  });

  it("der Handler schickt sie an die Route", () => {
    expect(HANDLERS).toContain("submittedPreview,");
  });

  it("die Route reicht sie an den Dienst durch", () => {
    expect(ROUTE).toContain("submittedPreview: body.options?.submittedPreview ?? null,");
  });

  it("der Dienst bucht die entschiedene Preview statt der frisch gerechneten", () => {
    expect(AUTO_RUN).toContain("decideResolvePreviewToBook({");
    expect(AUTO_RUN).toContain("preloadedPreview: previewDecision.preview,");
    // Der alte Weg — immer die eigene, zweite Aufloesung — darf nicht zurueckkommen.
    expect(AUTO_RUN).not.toContain("preloadedPreview: activeResolve.preview,");
  });

  it("eine abgelehnte Einreichung wird gemeldet, statt still ersetzt zu werden", () => {
    expect(AUTO_RUN).toContain("result.warnings.push(previewDecision.rejectedReason)");
  });
});

/**
 * Ohne diesen Teil waere Option A ein Rueckschritt: die Buehne haette eine VERALTETE Preview
 * gezeigt, und die wuerde nun auch noch gebucht.
 *
 * Der Session-Cache der Arena hielt das teuerste Stueck des Bundles — die Resolve-Preview, also
 * genau das abgespielte Ergebnis — unter einem Schluessel aus Save/Saison/Spieltag/Team/Quelle.
 * Die AUFSTELLUNGEN kamen darin nicht vor. Ein Treffer ueberlebte damit jede Aenderung an ihnen;
 * der typische Ablauf war, dass die KI-Aufstellungen erst nach dem ersten Laden nachzogen und die
 * Buehne danach weiter die Preview von VOR dem Nachziehen zeigte.
 */
describe("Preview-Cache der Arena", () => {
  const scope = { seasonId: "season-1", matchdayId: "matchday-3" };
  const baseKeyParams = {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-3",
    teamId: "A-A",
    source: "sqlite" as const,
    includeDetails: true,
  };

  it("ein neuer Aufstellungsstand trifft den alten Cache-Eintrag nicht mehr", () => {
    const before = buildMatchdayLineupRevision(
      [{ ...scope, teamId: "A-A", updatedAt: "2026-07-30T10:00:00.000Z" }],
      scope,
    );
    const after = buildMatchdayLineupRevision(
      [
        { ...scope, teamId: "A-A", updatedAt: "2026-07-30T10:00:00.000Z" },
        { ...scope, teamId: "B-B", updatedAt: "2026-07-30T10:05:00.000Z" },
      ],
      scope,
    );

    expect(before).not.toBe(after);
    expect(buildMatchdayArenaBaseSessionKey({ ...baseKeyParams, lineupRevision: before })).not.toBe(
      buildMatchdayArenaBaseSessionKey({ ...baseKeyParams, lineupRevision: after }),
    );
  });

  it("bemerkt auch eine geaenderte Aufstellung ohne neue Teams", () => {
    // Formkarte/Intensitaet/Kapitaen aendern die Eintraege nicht, das Ergebnis aber sehr wohl —
    // deshalb haengt die Revision am Zeitstempel und nicht an der Spielerauswahl.
    const before = buildMatchdayLineupRevision([{ ...scope, teamId: "A-A", updatedAt: "10:00" }], scope);
    const after = buildMatchdayLineupRevision([{ ...scope, teamId: "A-A", updatedAt: "10:07" }], scope);
    expect(before).not.toBe(after);
  });

  it("ignoriert Aufstellungen anderer Spieltage", () => {
    const withForeign = buildMatchdayLineupRevision(
      [
        { ...scope, teamId: "A-A", updatedAt: "10:00" },
        { seasonId: "season-1", matchdayId: "matchday-4", teamId: "B-B", updatedAt: "11:00" },
      ],
      scope,
    );
    expect(withForeign).toBe(buildMatchdayLineupRevision([{ ...scope, teamId: "A-A", updatedAt: "10:00" }], scope));
  });

  it("die Buehne holt neu, sobald sich die Aufstellungen bewegen", () => {
    // Der Schluessel allein reicht nicht — der Effekt muss auch neu laufen.
    expect(ARENA).toContain("previewReloadNonce, lineupRevision]);");
    expect(ARENA).toContain("lineupRevision,");
  });
});
