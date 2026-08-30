/**
 * BATTLE-MODUS: EIN ECHTER DURCHLAUF, VOM NEUSPIEL BIS ZU GEFUELLTEN KI-KADERN.
 *
 * WARUM DIESE DATEI EXISTIERT: bis hierher pruefte kein einziger Test den KI-Draft auf einem
 * Battle-Spielstand. Es gab Pruefungen fuer das Anlegen und fuer die Persistenz — beide enden,
 * bevor irgendetwas mit dem Spielstand ARBEITET. Der Draft ist aber der erste Verbraucher, der
 * ueber `gameState.teams` laeuft und dabei die Besitzrechte liest: genau die Stelle, an der
 * Geister-Zeilen (Besitz fuer Teams, die es im Save nicht gibt) und eine schiefe 2-gegen-4-
 * Aufteilung wehtun wuerden.
 *
 * BEWUSST OHNE ATTRAPPE fuer den Draft: eine Attrappe bewiese nur, dass wir sie richtig aufrufen.
 * Der Lauf geht durch `fuehreLigaSetupDraftAus` und damit durch denselben Produktionspfad, den
 * `startRoom` und die HTTP-Route nehmen — nur `await`-bar statt losgeloest. Er dauert entsprechend.
 */
import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { BATTLE_MODE_SPIELTAG_ANZAHL, BATTLE_MODE_TEAM_ANZAHL } from "@/lib/season/battle-mode-spielplan";

const JETZT = "2026-01-01T00:00:00.000Z";

describe("battle + online_4v4: anlegen, speichern, KI-Kader draften", () => {
  it(
    "legt einen 4-gegen-4-Battle-Save an und fuellt danach jeden KI-Kader — die menschlichen bleiben leer",
    async () => {
      const persistence = createPersistenceService();

      // 1. VORSCHAU — sie liefert den Bestaetigungscode, ohne den `applyNewGameSetup` nicht
      //    anfaesst. Derselbe Zwei-Schritt, den auch die HTTP-Route geht.
      const vorschau = previewNewGameSetup({ presetId: "online_4v4", playMode: "battle", now: JETZT });
      expect(vorschau.blockers).toEqual([]);
      expect(vorschau.playMode).toBe("battle");
      expect(vorschau.chrisTeamIds).toHaveLength(4);
      expect(vorschau.frankyTeamIds).toHaveLength(4);

      // 2. ANLEGEN.
      const ergebnis = applyNewGameSetup(
        { presetId: "online_4v4", playMode: "battle", now: JETZT, confirmToken: vorschau.confirmToken },
        persistence,
      );
      const saveId = ergebnis.save.saveId;

      const angelegt = persistence.getSaveById(saveId)!;
      expect(angelegt.gameState.playMode).toBe("battle");
      expect(angelegt.gameState.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
      expect(angelegt.gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);

      const teamIds = new Set(angelegt.gameState.teams.map((team) => team.teamId));

      /**
       * NEBENBEFUND, HIER FESTGEHALTEN STATT STILL UEBERGANGEN: `scenarioMeta.teamOwnership`
       * ueberlebt die Persistenz NICHT — der gespeicherte `scenarioMeta` traegt nur
       * scenarioType/label/description/createdAt/isStableTestPoint/allowTestWrites/
       * containsFinalStandings/containsSeasonHistory/activeSeasonId/activeMatchday/gamePhase.
       * Nachgemessen fuer BEIDE Spielarten, also unveraendertes Verhalten und keine Battle-Frage;
       * die Besitzrechte fuer einen laufenden Save kommen aus `seasonState.teamControlSettings`
       * (und im Raum aus `room.state.teamOwnership`), nicht von hier.
       *
       * Die Geister-Zeilen-Pruefung (A3) gehoert deshalb an den ERZEUGTEN Zustand und steht in
       * `tests/battle-mode-preset-teamzuteilung.test.ts`. Hier bleibt die Gegenprobe, dass der
       * gespeicherte Stand die Aufteilung ueberhaupt traegt — ueber die Steuerungs-Einstellungen,
       * den Weg, den der Spielstand wirklich nimmt.
       */
      const menschlichLautSave = Object.entries(angelegt.gameState.seasonState.teamControlSettings ?? {})
        .filter(([, einstellung]) => einstellung?.controlMode === "manual")
        .map(([teamId]) => teamId);
      expect(menschlichLautSave.sort()).toEqual(
        [...ergebnis.preview.chrisTeamIds, ...ergebnis.preview.frankyTeamIds].sort(),
      );
      for (const teamId of menschlichLautSave) {
        expect(teamIds.has(teamId), `${teamId} steht in den Einstellungen, existiert aber nicht`).toBe(true);
      }

      // 3. DER DRAFT — derselbe Produktionspfad wie in der Route/`startRoom`, nur awaitbar.
      const menschlich = [...ergebnis.preview.chrisTeamIds, ...ergebnis.preview.frankyTeamIds];
      const draft = await fuehreLigaSetupDraftAus({
        persistence,
        saveId,
        seasonId: ergebnis.preview.seasonSetup.seasonId,
        callerWritableTeamIds: angelegt.gameState.teams
          .map((team) => team.teamId)
          .filter((teamId) => !menschlich.includes(teamId)),
        excludeTeamIds: menschlich,
        logPrefix: "[test-battle-e2e]",
      });
      expect(draft.status).toBe("ready");

      // 4. DAS ERGEBNIS AM GESPEICHERTEN STAND, nicht am Rueckgabewert.
      const nachDraft = persistence.getSaveById(saveId)!;
      const kaderGroesse = new Map<string, number>();
      for (const eintrag of nachDraft.gameState.rosters ?? []) {
        kaderGroesse.set(eintrag.teamId, (kaderGroesse.get(eintrag.teamId) ?? 0) + 1);
      }

      for (const team of nachDraft.gameState.teams) {
        const anzahl = kaderGroesse.get(team.teamId) ?? 0;
        if (menschlich.includes(team.teamId)) {
          // Chris' und Frankys Teams draften ihren Grundkader NICHT automatisch mit -- Chris:
          // „niemals soll mit gepickt werden für" die menschlichen Teams.
          expect(anzahl, `${team.teamId} (menschlich) haette leer bleiben muessen`).toBe(0);
        } else {
          expect(anzahl, `${team.teamId} (KI) hat keinen Kader bekommen`).toBeGreaterThan(0);
        }
      }

      // Kein Spieler landet bei einem Team, das es im Save gar nicht gibt.
      for (const teamId of kaderGroesse.keys()) {
        expect(teamIds.has(teamId), `Kader fuer Geister-Team ${teamId}`).toBe(true);
      }
    },
    600_000,
  );
});
