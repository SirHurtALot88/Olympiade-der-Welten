/**
 * DAS OEFFNEN DER ARENA IST KEIN NACHSPIELEN — SONST BLEIBT DER ENDSCREEN LEER.
 *
 * GEMELDET VON CHRIS: „top spieler und verletzen marke auch einbauen! warum ist das immernoch
 * nicht da".
 *
 * NACHGEMESSEN IM BROWSER (Save `fresh-season-1-1786550453715`, Saison 2, Spieltag 4, Hockey und
 * Basketball beide gebucht, Arena frisch geoeffnet): die Arena meldete `activeSideScoredInSave =
 * true` und trotzdem `disciplineEnded = false`. `matchdayTopPlayers` war fertig gerechnet
 * (`data-md-top="true"`) — nur zeigte sie niemand. Mit ihr fehlten Highlights und der Weiter-Block.
 *
 * URSACHE: `DisciplineStageNativeArena` setzt sich beim Mount zurueck und meldete das dem Host wie
 * einen Druck auf „↻ Neu". Der Host merkte sich daraufhin `replayingDisciplineId = disciplineId`,
 * und `disciplineEnded` zaehlt ein laufendes Replay bewusst NICHT als abgeschlossen — richtig, aber
 * hier mit dem falschen Anlass gefuettert.
 *
 * DIESER TEST prueft den WERT, der darueber entscheidet, nicht den Quelltext, der ihn benutzt.
 * Er faehrt zusaetzlich die Gate-Regel selbst nach, damit die Folge sichtbar bleibt: derselbe
 * Spielstand, einmal frisch geoeffnet und einmal im Replay.
 */
import { describe, expect, it } from "vitest";

import { replayNachArenaReset } from "@/lib/foundation/discipline-stage/discipline-stage-replay-gate";

const HOCKEY = "hockey";

/**
 * Die Gate-Regel aus `DisciplineStageArena.tsx` (`const disciplineEnded = …`), hier nur
 * nachgefahren, um die FOLGE des Anlasses zu zeigen. Sie selbst ist woanders geprueft
 * (`arena-abschluss-nach-reload.test.ts`) — hier geht es um den Wert, den sie hereinbekommt.
 */
function gateOffen(input: {
  arenaEnded: boolean;
  endedDisciplineIds: ReadonlySet<string>;
  activeSideScoredInSave: boolean;
  replayingDisciplineId: string | null;
  disciplineId: string;
}): boolean {
  return (
    input.arenaEnded ||
    (input.endedDisciplineIds.has(input.disciplineId) && input.replayingDisciplineId !== input.disciplineId) ||
    (input.activeSideScoredInSave && input.replayingDisciplineId !== input.disciplineId)
  );
}

describe("Der Anlass eines Buehnen-Resets", () => {
  it("ein Mount macht KEINE Disziplin zum Nachspiel", () => {
    expect(replayNachArenaReset("mount", HOCKEY)).toBeNull();
  });

  it("der Knopf „↻ Neu“ macht genau die offene Disziplin zum Nachspiel", () => {
    expect(replayNachArenaReset("knopf", HOCKEY)).toBe(HOCKEY);
  });
});

describe("Die Folge fuer den Endscreen — derselbe Spielstand, zwei Anlaesse", () => {
  const gebuchterSpieltag = {
    arenaEnded: false,
    endedDisciplineIds: new Set<string>(),
    activeSideScoredInSave: true,
    disciplineId: HOCKEY,
  };

  it("frisch geoeffnet gilt eine im Save gewertete Disziplin als abgeschlossen", () => {
    // Genau der Fall aus der Messung: Seite geladen, nichts angeklickt, Ergebnis steht im Save.
    expect(
      gateOffen({ ...gebuchterSpieltag, replayingDisciplineId: replayNachArenaReset("mount", HOCKEY) }),
    ).toBe(true);
  });

  it("waehrend eines echten Replays bleibt sie verdeckt", () => {
    // Der Spoilerschutz, den es zu erhalten galt — wer nochmal zusieht, soll das Ende nicht
    // schon daneben stehen haben.
    expect(
      gateOffen({ ...gebuchterSpieltag, replayingDisciplineId: replayNachArenaReset("knopf", HOCKEY) }),
    ).toBe(false);
  });

  it("ohne gewertete Seite bleibt das Gate zu — der Mount deckt nichts vorzeitig auf", () => {
    expect(
      gateOffen({
        ...gebuchterSpieltag,
        activeSideScoredInSave: false,
        replayingDisciplineId: replayNachArenaReset("mount", HOCKEY),
      }),
    ).toBe(false);
  });

  it("ein Replay EINER Disziplin verdeckt nicht die andere", () => {
    expect(
      gateOffen({
        ...gebuchterSpieltag,
        disciplineId: "basketball",
        replayingDisciplineId: replayNachArenaReset("knopf", HOCKEY),
      }),
    ).toBe(true);
  });
});
