/**
 * GEMELDET VON CHRIS: „wieso kann ich im finanzen tab die teams nicht anklicken? ich will von da
 * aus ja auch ins team profil kommen"
 *
 * Die Liga-Tabelle im Finanzen-Reiter rendert Team-Logo, Kürzel und Namen — aber als reinen Text.
 * Von überall sonst (Saisonstand, Ranks, Spielerliste) führt ein Klick aufs Team ins Profil, nur
 * hier war Schluss.
 *
 * Der Öffner (`openTeamProfileById`) lag im Router längst bereit und wird an zwei anderen Stellen
 * genauso benutzt; die Finanzen-Kette reichte ihn nur nirgends durch. Diese Datei sichert die
 * ganze Kette ab, weil ein fehlendes Glied darin nicht auffällt — die Seite rendert weiter, der
 * Name ist eben nur nicht klickbar:
 *
 *   Router → Host → NewLook → FinanceLeagueTable → Zelle
 *
 * Dazu der Rückfallweg: OHNE Öffner bleibt es bewusst bei reinem Text. Ein Knopf, der nichts tut,
 * wäre schlimmer als gar keiner.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const router = readFileSync(join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8");
const host = readFileSync(join(root, "app/foundation/finances/FoundationFinancesHost.tsx"), "utf8");
const view = readFileSync(join(root, "app/foundation/finances/FoundationFinancesNewLook.tsx"), "utf8");

describe("Finanzen · Team öffnet das Profil", () => {
  it("reicht den Öffner vom Router an den Host", () => {
    expect(router).toMatch(/<FoundationFinancesHost[\s\S]{0,320}onOpenTeam=\{\(teamId\) => openTeamProfileById\(teamId\)\}/);
  });

  it("reicht ihn vom Host an die Ansicht", () => {
    expect(host).toContain("onOpenTeam?: (teamId: string) => void");
    expect(host).toMatch(/<FoundationFinancesNewLook[\s\S]{0,400}onOpenTeam=\{onOpenTeam\}/);
  });

  it("reicht ihn von der Ansicht bis in die Liga-Tabelle", () => {
    expect(view).toMatch(/<FinanceLeagueTable[\s\S]{0,200}onOpenTeam=\{onOpenTeam \?\? null\}/);
    expect(view).toMatch(/renderLeagueCell\([\s\S]{0,160}onOpenTeam\)/);
  });

  it("macht die Team-Zelle zum Knopf, der das Profil öffnet", () => {
    expect(view).toMatch(/className="nl-fin-league-team is-linked"[\s\S]{0,120}onClick=\{\(\) => onOpenTeam\(row\.teamId\)\}/);
  });

  it("bleibt ohne Öffner reiner Text statt eines Knopfs ohne Wirkung", () => {
    expect(view).toMatch(/if \(!onOpenTeam\) \{[\s\S]{0,160}<span className="nl-fin-league-team">/);
  });
});
