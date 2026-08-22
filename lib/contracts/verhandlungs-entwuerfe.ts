import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * WANN EIN VERHANDLUNGS-ENTWURF STIRBT.
 *
 * Ein `contractNegotiationDraft` ist EINE Verhandlung: Season, Team, Spieler — so ist auch seine
 * `draftId` gebaut. Er trägt das Gedächtnis dieser Verhandlung, den Trotz-Aufschlag und das letzte
 * Geld-Wort. Bisher wurde er nur geschrieben und nie entfernt. An Chris' Spielstand lagen deshalb
 * neun Entwürfe herum, und zwar in ZWEI Sorten:
 *
 *   VERBRAUCHT — die Verhandlung endete mit einer Unterschrift, der Entwurf blieb liegen.
 *     King Arlen ist der Beleg: sein Vertrag ist exakt der Entwurfsplan ohne die erste Rate.
 *
 *         Entwurf  LZ 4   2,17 | 2,79 | 3,41 | 4,03
 *         Vertrag  LZ 3          2,79 | 3,41 | 4,03
 *
 *     Ebenso Jorund, Lulu und Xelara.
 *
 *   ABGEBROCHEN — eine Kaufverhandlung, die nie bestätigt wurde. Patience, Midorina, XR-KAROT-01,
 *     Scorpion King und Evie stehen in keinem Kader; sie wurden nie gekauft.
 *
 * Beide Sorten brauchen einen anderen Griff. Die VERBRAUCHTEN raeumt die Unterschrift weg, hier
 * unten. Die ABGEBROCHENEN raeumt der Saisonwechsel weg: `nextSeasonState` in
 * `preseason-workflow-service.ts` setzt `contractNegotiationDrafts` auf leer, gleich neben
 * `lineupDrafts`. Solange die Saison laeuft, darf ein offenes Kaufgespraech offen bleiben.
 *
 * WAS EIN LIEGENGEBLIEBENER ENTWURF ANRICHTET. Er ist nicht nur Zierrat: `affrontRetreat` liest
 * `status === "countered"` samt altem Angebot, der Trotz-Aufschlag wird aus ihm fortgeschrieben,
 * und die Verträge-Tabelle zeigt ihn als Vorschauzeile. Eine abgeschlossene Verhandlung redet
 * damit in die nächste hinein.
 */

/**
 * Nach der Unterschrift ist die Verhandlung vorbei — ihr Entwurf auch.
 *
 * Aufgerufen auf dem UNTERSCHRIFTSPFAD, also dort wo aus einem Angebot ein Vertrag wird: beim
 * Transferkauf und bei der manuellen Verlängerung.
 *
 * `rejected_bad_experience` bleibt bewusst UNANGETASTET. Das ist kein Verhandlungsgedächtnis,
 * sondern der Groll über eine geplatzte Verhandlung („Trotz ist Verhandlungsgedaechtnis, kein
 * Lebensgroll; dafuer gibt es rejected_bad_experience", `transfermarkt-local-service.ts`). In der
 * Praxis kann der Fall kaum eintreten — es gibt nur einen Entwurf je Season/Team/Spieler, und der
 * Unterschriftspfad hat ihn zuvor ohnehin überschrieben —, aber die Regel soll an der Stelle
 * stehen, an der sie gilt, und nicht davon abhängen, dass ein anderer Pfad sich richtig verhält.
 */
export function entferneEntwurfNachUnterschrift(
  gameState: GameState,
  ziel: { teamId: string; playerId: string },
): GameState {
  const entwuerfe = gameState.seasonState?.contractNegotiationDrafts;
  if (!Array.isArray(entwuerfe) || entwuerfe.length === 0) {
    return gameState;
  }
  const uebrig = entwuerfe.filter(
    (entwurf) =>
      entwurf.status === "rejected_bad_experience" ||
      entwurf.teamId !== ziel.teamId ||
      entwurf.playerId !== ziel.playerId,
  );
  if (uebrig.length === entwuerfe.length) {
    return gameState;
  }
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, contractNegotiationDrafts: uebrig },
  };
}
