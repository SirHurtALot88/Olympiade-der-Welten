/**
 * GEFORDERT: „bitte höre erst auf wenn das sauber funktioniert, getestet wurde, übers UI
 * erreichbar ist und gemerged."
 *
 * „Übers UI erreichbar" war der wunde Punkt. Beim Durchspielen im Browser sind zwei Sperren
 * aufgefallen, die beide NICHT im Kaufdialog selbst lagen, sondern im Weg dorthin und zurück:
 *
 * 1. Der Hauptaktions-Knopf im Kopf blieb dauerhaft auf „Kandidat wählen [gesperrt]" mit dem
 *    Hinweis „Wähle links erst einen Kandidaten aus der Liste aus" — obwohl links sichtbar
 *    einer markiert war.
 * 2. Nach einer Absage blieb „Schritt 1: Verhandeln" gesperrt, auch nachdem das Gehalt
 *    angehoben war — obwohl die Absage-Meldung genau dazu auffordert. Eine Sackgasse: der
 *    einzige Ausweg war, den Dialog zu schließen, was zusätzlich den Abbruch-Malus riskiert.
 *
 * Beide sind Verdrahtungsfehler zwischen zwei Zuständen, die dieselbe Frage beantworten. Diese
 * Suite hält die Verdrahtung fest — sie ist bewusst eine Quelltext-Prüfung, weil der Defekt
 * genau dort saß und nicht im Verhalten einer einzelnen Komponente.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

describe("Der Hauptknopf im Kopf sieht, was in der Liste ausgewählt ist", () => {
  const client = () => quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");

  it("meldet jede effektive Auswahl nach oben — auch Fallback und Wunschlisten-Fokus", () => {
    // Vorher meldete NUR der Klick-Handler nach oben; die automatische Auswahl (Fallback auf den
    // ersten sichtbaren Kandidaten) blieb dem Shell-Zustand verborgen — der Kopfknopf stand auf
    // „Kandidat wählen [gesperrt]", während der Deal-Desk längst rechnete. Seit M1 spiegelt ein
    // Sync-Effekt die EFFEKTIVE Auswahl (`selectedPlayer`) in den Shell-Zustand.
    const text = client();
    expect(text).toContain("onSelectCandidate?: (playerId: string, name: string) => void;");
    expect(text).toContain("const lastReportedCandidateIdRef = useRef<string | null>(null);");
    expect(text).toContain("onSelectCandidateUpstreamRef.current?.(effectiveId,");
  });

  it("schickt den Namen mit, nicht nur die Id", () => {
    // Der Knopf beschriftet sich mit dem Namen („X prüfen"). Nur die Id zu melden hätte den
    // Knopf freigeschaltet, aber ohne lesbare Beschriftung. Der Name kommt aus der effektiven
    // Auswahl selbst — nicht aus einem Feed, der beim Öffnen des Marktes leer sein kann.
    expect(client()).toContain("selectedPlayer?.name ?? effectiveId");
  });

  /**
   * Der eigentliche Grund, warum Teil 1 allein nicht gereicht hätte: die Id wurde über
   * `marketFeed` aufgelöst — und DIESER Feed wird beim normalen Öffnen des Marktes gar nicht
   * geladen (`shouldLoadMarketFeed = false` in use-foundation-market-feed-actions.ts).
   * `reloadMarketFeed` läuft nur über Live-Sync und nach einem Kauf. Der Knopf hätte beim
   * ersten Öffnen also nie funktionieren können, egal welche Id gesetzt ist.
   */
  it("löst die Auswahl auch ohne geladenen Feed auf", () => {
    const scope = quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
    expect(scope).toContain("marketPreviewPlayerSummary?.playerId === marketPreviewPlayerId");
    // Der Feed bleibt die erste Wahl — er trägt den vollen Datensatz, die Zusammenfassung nur
    // Id und Name.
    const block = scope.slice(scope.indexOf("const marketPreviewPlayer = useMemo"), scope.indexOf("const marketPreviewPlayer = useMemo") + 700);
    expect(block.indexOf("marketFeed?.items.find")).toBeLessThan(block.indexOf("marketPreviewPlayerSummary?.playerId"));
  });

  it("hält den toten Ladepfad im Kommentar fest", () => {
    // Ohne diesen Hinweis sucht der nächste Mensch den Fehler wieder im Knopf statt im Feed.
    expect(quelle("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx")).toContain(
      "shouldLoadMarketFeed = false",
    );
  });
});

describe("Nach einer Absage kommt man weiter, statt in der Sackgasse zu sitzen", () => {
  const client = () => quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx");

  it("hebt die Absage auf, sobald das Gehalt geändert wird", () => {
    const text = client();
    expect(text).toContain("function applyOfferedSalaryChange");
    expect(text).toContain('current?.status === "rejected" ? null : current');
  });

  it("führt BEIDE Eingabewege über dieselbe Funktion", () => {
    // Es gibt zwei Stellen, an denen der Nutzer das Gehalt ändert: den Regler im Deal-Desk und
    // das Feld im Vertragsblock. Ginge nur eine über die Funktion, wäre die Sackgasse je nach
    // benutztem Regler noch da — genau die Sorte Fehler, die man beim Testen knapp verfehlt.
    const text = client();
    expect(text).toContain("applyOfferedSalaryChange(value);");
    expect(text).toContain("onOfferedSalaryChange: applyOfferedSalaryChange,");
    expect(text).not.toContain("onOfferedSalaryChange: setOfferedSalary,");
  });

  it("lässt ein GEGENANGEBOT unangetastet", () => {
    // Bewusst nur bei „rejected" zurücksetzen: bei „countered" trägt der Zustand das
    // Gegenangebot samt „Einschlagen"-Knopf, und `acceptCounterOffer` setzt das Gehalt selbst
    // auf die Gegenangebots-Zahl. Ein pauschales Zurücksetzen würde diesen Klick sein eigenes
    // Ziel löschen lassen.
    const text = client();
    const fn = text.slice(text.indexOf("function applyOfferedSalaryChange"));
    expect(fn.slice(0, 400)).not.toContain("setBuyNegotiationOutcome(null)");
  });
});
