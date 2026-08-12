import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const transfermarktV2ClientPath = path.join(
  process.cwd(),
  "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
);
const transfermarktV2NewLookPath = path.join(
  process.cwd(),
  "app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx",
);

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Regression fuer: „gerade kann ich auch nicht mehr mit den Pfeiltasten durch die Kandidaten
 * scrollen".
 *
 * Ursache war NICHT fehlende Tastatur-Logik — `moveCandidateSelection`, der globale
 * keydown-Listener und `candidateButtonRefs.current.get(...)?.focus()`/`scrollIntoView()` waren
 * alle noch da. Die Map, aus der der Fokus-Effekt liest, wurde aber nirgends mehr BEFUELLT: beim
 * Ausbau des Legacy-Zweigs (Commit 32683df8) verschwand `setCandidateButtonRef` samt dem
 * `ref={...}` an der Kandidaten-Karte. Der bestehende Test
 * `transfermarkt-v2-performance-contract.test.ts` prueft nur, dass der STRING
 * "candidateButtonRefs" irgendwo im Quelltext vorkommt — die Deklaration der (leeren) Map allein
 * reicht dafuer, der Test blieb also gruen, waehrend die Tastatur-Navigation tot war.
 *
 * Diese Tests pruefen stattdessen die tatsaechliche BEFUELLUNG: dass es eine Registrierungs-
 * funktion gibt, die in die Map schreibt, dass der New Look sie als Prop bekommt, und dass sie am
 * gerenderten Kandidaten-Element als `ref` haengt — nicht nur irgendwo im Text vorkommt.
 */
describe("Transfermarkt-Kandidatenliste: Ref-Registrierung fuer Tastaturnavigation", () => {
  it("TransfermarktV2Client legt eine Registrierungsfunktion an, die tatsaechlich in candidateButtonRefs schreibt", () => {
    const source = read(transfermarktV2ClientPath);

    // Die Map selbst existiert weiterhin.
    expect(source).toContain("candidateButtonRefs = useRef<Map<string, HTMLElement>>(new Map())");

    // Es gibt eine Funktion, die Knoten tatsaechlich in die Map schreibt (nicht nur eine leere
    // Deklaration) — das ist der Teil, der beim Legacy-Ausbau verloren ging.
    const setterMatch = source.match(
      /function setCandidateButtonRef\(playerId: string, node: HTMLElement \| null\) \{[\s\S]{0,200}?candidateButtonRefs\.current\.set\(playerId, node\)/,
    );
    expect(setterMatch).not.toBeNull();

    // Die Registrierungsfunktion muss den New Look tatsaechlich erreichen — sonst schreibt sie
    // zwar in die Map, wird aber nie mit einem echten DOM-Knoten aufgerufen.
    expect(source).toContain("onCandidateCardRef={setCandidateButtonRef}");
  });

  it("TransfermarktV2NewLook haengt die Registrierung als ref an die tatsaechlich gerenderte Kandidaten-Karte", () => {
    const source = read(transfermarktV2NewLookPath);

    // Prop existiert im Interface, ist also nicht nur zufaellig durchgereicht.
    expect(source).toContain("onCandidateCardRef?: (playerId: string, node: HTMLElement | null) => void");
    // Und wird aus den Props destrukturiert (sonst bliebe sie ungenutzt liegen).
    expect(source).toMatch(/\bonCandidateCardRef,/);

    // Kern der Reparatur: der `ref`-Callback muss AM SELBEN Element haengen, das auch
    // `data-testid="transfer-candidate-card"` traegt — nicht irgendwo sonst im Quelltext. Ein
    // Block-Match von genau diesem <div ...> bis zu seinem `onClick` stellt das sicher: faellt
    // `ref={...}` aus diesem Bereich, war es aus dem JSX entfernt (der urspruengliche Fehler),
    // selbst wenn die Prop im Interface stehen bliebe.
    const cardBlockMatch = source.match(
      /<div\s+key=\{item\.playerId\}[\s\S]{0,400}?data-testid="transfer-candidate-card"[\s\S]{0,400}?onClick=\{\(\) => onSelectCandidate\(item\.playerId\)\}/,
    );
    expect(cardBlockMatch).not.toBeNull();
    const cardBlock = cardBlockMatch![0];
    expect(cardBlock).toContain("ref={(node) => onCandidateCardRef?.(item.playerId, node)}");
  });

  it("Gegenprobe: der alte Kommentar ueber eine vollstaendig gerenderte Liste ohne eigenen Virtualisierer ist korrigiert", () => {
    // Der New Look hat einen echten Fenster-Virtualisierer (siehe `sichtbaresFenster` dort) —
    // TransfermarktV2Client.tsx darf nicht mehr behaupten, es gaebe keinen und die Karten-Refs
    // arbeiteten auf einer vollstaendigen Liste. Beides war beim Befund veraltet.
    const source = read(transfermarktV2ClientPath);
    expect(source).not.toContain(
      "Bewusst SO und nicht als eigener Virtualisierer",
    );
    expect(source).not.toContain(
      "Tastaturnavigation,\n   * `scrollIntoView` und die Karten-Refs arbeiten weiter auf einer vollstaendigen Liste",
    );
  });
});
