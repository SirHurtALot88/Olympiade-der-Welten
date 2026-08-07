/**
 * REINE RANG- UND RUNDUNGSHELFER — bewusst OHNE `"use client"`.
 *
 * GEMELDET: „habe saisonwechsel prüfen gedrückt … ich hab ok gedrückt aber es passiert nix",
 * und nach dem Sichtbarkeits-Fix (#437) stand endlich der Grund auf dem Bildschirm:
 *
 *     Attempted to call roundViewNumber() from the server but roundViewNumber is on the client.
 *
 * Diese beiden Funktionen lagen in `lib/foundation/tabs/season-stand-render-helpers.tsx`, und das
 * Modul traegt `"use client"` — zu Recht, es rendert auch JSX. `roundViewNumber` und
 * `buildSharedRankMap` selbst sind aber reine Rechnung: kein React, kein DOM, kein State. Sie lagen
 * dort nur, weil die Views sie zuerst brauchten.
 *
 * Ueber `lib/foundation/team-discipline-rank-engine.ts` zog `lib/season/season-snapshot-service.ts`
 * damit ein Client-Modul in einen Route-Handler. Next.js laesst das nicht zu und wirft zur Laufzeit
 * — der Saisonwechsel starb also genau an der Stelle, an der er den Snapshot baut.
 *
 * Der Befund ist nicht neu: `scripts/audit-koop-spielbarkeit.ts:624` prueft seit PR #211 auf genau
 * diese Fehlermeldung und haelt fest, dass das Werkzeug „in Route-Handlern faktisch kaputt" ist.
 * Sichtbar wurde er trotzdem erst, als das Saisonfinale-Panel Fehler ueberhaupt anzeigen konnte.
 *
 * Beide Funktionen sind WORTGLEICH hierher verschoben — insbesondere `roundViewNumber` mit
 * `toFixed`, nicht mit der `Math.round`-Variante aus `foundation-number-utils`. Die beiden runden
 * an Grenzfaellen unterschiedlich, und dieser Umzug soll nichts am Verhalten aendern.
 *
 * `season-stand-render-helpers.tsx` exportiert beide weiterhin (re-export), damit kein bestehender
 * Aufrufer angefasst werden muss.
 */

export function roundViewNumber(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function buildSharedRankMap(values: Array<{ teamId: string; value: number }>) {
  const sortedValues = [...values].sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    return left.teamId.localeCompare(right.teamId, "de");
  });
  const rankMap = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sortedValues.forEach((entry, index) => {
    if (previousValue != null && Math.abs(previousValue - entry.value) < 0.0001) {
      rankMap.set(entry.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousValue = entry.value;
    previousRank = nextRank;
    rankMap.set(entry.teamId, nextRank);
  });

  return rankMap;
}
