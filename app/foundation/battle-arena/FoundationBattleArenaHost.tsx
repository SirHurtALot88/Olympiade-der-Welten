"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FoundationBattleArenaSpriteGallery from "@/app/foundation/battle-arena/FoundationBattleArenaSpriteGallery";
import {
  buildArenaTeam,
  listeArenaTeams,
} from "@/lib/foundation/battle-arena/arena-kader-adapter";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  buildArenaAufstellung,
  buildArenaAufstellungBeide,
} from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import { buildMiniDmFfaPodMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import { resolveArenaHostSeeds } from "@/lib/battle/arena-host-seed";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";
import { buildMatchdayMutatorTraitsBySide } from "@/lib/lineups/legacy-lineup-modifiers";
import { baueFixtureIndex, findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildArenaHostSpielquelleHinweise } from "@/lib/foundation/battle-arena/arena-host-spielquelle-hinweis";
import {
  getMiniDmPodForTeam,
  resolveMiniDmFfaPlayerCountForMatchday,
} from "@/lib/season/mini-dm-pod-schedule";
import { buildSpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import { buildTeamRelationshipMap } from "@/lib/foundation/team-relationship";
import {
  buildArenaFixturesPanel,
  buildArenaStandingsPanel,
} from "@/lib/foundation/battle-arena/arena-live-panels";
import { useArenaStandingsPreview } from "@/lib/foundation/battle-arena/use-arena-standings-preview";

/**
 * BATTLE ARENA — der Entwurf des Battle Mode, im Spiel sichtbar.
 *
 * Warum hier und nicht nur als Link: Die Frage, die der Entwurf beantworten
 * soll, ist "wie fuehlt sich das im Spiel an?". Die laesst sich nur
 * beantworten, wenn er dort steht, wo die echte Arena steht — im selben
 * Rahmen, in derselben Navigation, mit demselben Weg dorthin.
 *
 * WAS NEU IST (Phase 2 der Fable-Architektur, s. docs/BATTLE_ARENA_UEBERGABE.md):
 * kein iframe mehr. public/mockups/battle-mode.html ist seit Phase 2 selbst nur
 * noch eine duenne Huelle (Markup + <link>/<script>), die auf zwei ausgelagerte
 * Dateien verweist: battle-mode.css (jede Regel unter .oly-battle-arena
 * gekapselt, damit sie nicht mit dem Rest der App kollidiert) und
 * battle-mode.engine.js (der unveraenderte Motor). Dieser Host LAEDT DIESELBE
 * HUELLE PER FETCH, zieht ihr Markup + ihre <link>/<script>-Verweise heraus und
 * haengt sie nativ ins DOM — er kennt keine Dateinamen, er liest sie aus der
 * Huelle. Eine Quelle bleibt eine Quelle: wer /mockups/battle-mode.html direkt
 * oeffnet (oder das veroeffentlichte Claude-Artefakt, dort per Build-Skript
 * wieder zu einer einzigen Datei zusammengesetzt), sieht exakt denselben Stand.
 *
 * Der Kader-Uebergang laeuft jetzt synchron per `window.__olyArenaKader`, das
 * VOR dem Einhaengen des Motor-Skripts gesetzt wird — kein Nachrichtenlaufweg,
 * kein Zeitlimit noetig (das war nur fuer den iframe-Fall relevant, s.
 * battle-mode.engine.js). Ein Team-Wechsel entfernt die alte Motor-Instanz
 * komplett aus dem DOM und haengt eine frische ein, statt ihren Zustand
 * umzubauen — der Motor traegt viel modulglobalen mutablen Zustand
 * (Aufstellung, Formkarten, Persoenlichkeiten), der an den ALTEN Kader hing.
 */

type ArenaTeamAuswahl = {
  teamId: string;
  name: string;
};

type ArenaHuelle = {
  markup: string;
  stylesheetHrefs: string[];
  scriptSrcs: string[];
};

let huelleCache: Promise<ArenaHuelle> | null = null;

function ladeArenaHuelle(): Promise<ArenaHuelle> {
  if (!huelleCache) {
    huelleCache = fetch("/mockups/battle-mode.html", { cache: "force-cache" })
      .then(async (response) => ({
        html: await response.text(),
        basis: response.url,
      }))
      .then(({ html, basis }) => {
        const dokument = new DOMParser().parseFromString(html, "text/html");
        const markupKnoten = dokument.querySelector(".oly-battle-arena");
        if (!markupKnoten) {
          throw new Error(
            "battle-mode.html enthaelt kein .oly-battle-arena-Element mehr.",
          );
        }
        // DOMParser gibt dem geparsten Dokument die Basis-URL der AKTUELLEN Seite, nicht die
        // der geladenen Datei — relative href/src (bewusst relativ, damit die Huelle direkt
        // unter /mockups/ funktioniert) muessen deshalb von Hand gegen `basis` aufgeloest
        // werden, sonst landen sie faelschlich im App-Root statt in /mockups/.
        const stylesheetHrefs = [
          ...dokument.querySelectorAll('link[rel="stylesheet"]'),
        ]
          .map((el) => el.getAttribute("href"))
          .filter((href): href is string => Boolean(href))
          .map((href) => new URL(href, basis).toString());
        const scriptSrcs = [...dokument.querySelectorAll("script[src]")]
          .map((el) => el.getAttribute("src"))
          .filter((src): src is string => Boolean(src))
          .map((src) => new URL(src, basis).toString());
        return { markup: markupKnoten.outerHTML, stylesheetHrefs, scriptSrcs };
      });
  }
  return huelleCache;
}

function sicherstelleStylesheet(href: string) {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export default function FoundationBattleArenaHost({
  gameState,
  activeManagerTeamId,
  saveId,
}: {
  gameState: GameState;
  activeManagerTeamId?: string | null;
  saveId?: string | null;
}) {
  const teams = useMemo<ArenaTeamAuswahl[]>(
    () => listeArenaTeams(gameState),
    [gameState],
  );

  const [heimTeamId, setHeimTeamId] = useState<string>(() => {
    if (
      activeManagerTeamId &&
      teams.some((team) => team.teamId === activeManagerTeamId)
    ) {
      return activeManagerTeamId;
    }
    return teams[0]?.teamId ?? "";
  });
  const [gastTeamId, setGastTeamId] = useState<string>(() => {
    const andere = teams.find((team) => team.teamId !== heimTeamId);
    return andere?.teamId ?? teams[0]?.teamId ?? "";
  });

  // MINI-DM 4-TEAM-FFA, "GEZEIGT = GEBUCHT" (PR 6 des 6-PR-Opus-Plans 21.10., "Buehnen-
  // Anzeige" — Nachtrag zu PR 5s Vorlauf-Verdrahtung). Bis hierher zog dieser Block ZWEI
  // WEITERE Teams rein aus der (nach Name sortierten) Team-Liste, zyklisch ab Gast — eine
  // Phantasie-Vierergruppe, die mit dem tatsaechlich gebuchten Mini-DM-Pod dieses Spieltags
  // (falls es ueberhaupt einer ist) nichts zu tun hatte: Chris sah live ein ANDERES
  // Mini-DM-Spiel als das, was gebucht wurde und in der Spieltagstabelle/im Ledger landet —
  // derselbe "gezeigt ≠ gebucht"-Fehlerfall, den A3 oben fuer die klassischen Zwei-Team-
  // Disziplinen schon einmal behoben hat (`arenaSeedByDisciplineId`).
  //
  // Der Fix: `getMiniDmPodForTeam()` (lib/season/mini-dm-pod-schedule.ts, dieselbe Funktion,
  // die die echte Pod-Bildung fuer die Buchung liest) sucht den ECHTEN Vierer-Pod, der
  // `heimTeamId` an DIESEM Spieltag traegt — unabhaengig von der UI-Auswahl `gastTeamId`:
  // ein Mini-DM-Pod ist eine EIGENE, zur normalen Fixture-Paarung parallele Gruppierung
  // (s. dortiger Datei-Kopfkommentar), `gastTeamId` muss darin gar nicht vorkommen. Gibt es
  // keinen echten Pod (Mini-DM steht an diesem Spieltag nicht an, oder die Liga ist nicht
  // durch 4 teilbar), bleibt `miniDmPod` `null` — die Buehne zeigt dann GAR KEINE
  // Mini-DM-FFA-Vierergruppe mehr (vorher wurde IMMER eine erfunden, sobald 4 Teams existierten,
  // unabhaengig davon, ob Mini-DM an diesem Spieltag ueberhaupt gespielt wird).
  const miniDmPod = useMemo(() => {
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!heimTeamId || !matchdayId || !saveId || saveId === "loading-save") return null;
    return getMiniDmPodForTeam(gameState, heimTeamId, matchdayId, { saveId });
  }, [gameState, heimTeamId, gameState.matchdayState?.matchdayId, saveId]);

  // Primitive Strings statt des Pod-Objekts selbst als Hook-Abhaengigkeiten weiter unten —
  // `miniDmPod` ist bei gleichen Eingaben zwar bereits memoisiert (dieselbe Referenz bleibt
  // ueber Re-Renders stabil), aber die VIER IDs einzeln zu fuehren haelt den Rest dieser Datei
  // im selben Stil wie das bisherige `dritteTeamId`/`vierteTeamId`-Paar.
  const [miniDmTeamId0, miniDmTeamId1, miniDmTeamId2, miniDmTeamId3] =
    miniDmPod?.teamIds ?? (["", "", "", ""] as const);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Die kompakte Initial-Payload streift attributeSheetStats bei jedem Team außer dem eigenen
  // (Fog-of-War-Payload-Slimming, siehe lib/persistence/foundation-initial-compact-state.ts).
  // Fuer die Arena braucht es aber BEIDE Kader vollstaendig — also bei jedem Team-Wechsel per
  // Bulk-Route nachladen, statt sich auf das zu verlassen, was ohnehin schon im gameState steckt.
  const [sheetsByPlayerId, setSheetsByPlayerId] = useState<
    Map<string, Player["attributeSheetStats"]>
  >(() => new Map());
  const [ladeKader, setLadeKader] = useState(false);

  useEffect(() => {
    if (!saveId || saveId === "loading-save") return;
    // Die (bis zu vier) Mini-DM-FFA-Pod-Teams werden HIER MIT nachgeladen (dieselbe Bulk-
    // Route, ein Promise.all-Schwung) statt in einem zweiten Effekt — sie tragen exakt
    // dasselbe Fog-of-War-Problem wie Heim/Gast und sollen nicht selbst einen zweiten
    // Ladezustand samt Race-Bedingung gegen diesen Effekt hier aufmachen. Heim/Gast koennen
    // mit den Pod-IDs ueberlappen (heimTeamId ist IMMER Teil des Pods, s. `miniDmPod`-
    // Kommentar oben) — das Set() entdoppelt.
    const teamIds = [
      ...new Set(
        [heimTeamId, gastTeamId, miniDmTeamId0, miniDmTeamId1, miniDmTeamId2, miniDmTeamId3].filter(
          Boolean,
        ),
      ),
    ];
    if (teamIds.length === 0) return;
    let abgebrochen = false;
    setLadeKader(true);
    Promise.all(
      teamIds.map(async (teamId) => {
        const params = new URLSearchParams({ saveId, teamId });
        if (activeManagerTeamId)
          params.set("requestingTeamId", activeManagerTeamId);
        const response = await fetch(
          `/api/singleplayer-state/team-roster-sheets?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok)
          return [] as {
            playerId: string;
            attributeSheetStats: Player["attributeSheetStats"];
          }[];
        const payload = (await response.json()) as {
          ok?: boolean;
          sheets?: {
            playerId: string;
            attributeSheetStats: Player["attributeSheetStats"];
          }[];
        };
        return payload.sheets ?? [];
      }),
    )
      .then((ergebnisse) => {
        if (abgebrochen) return;
        const naechsteMap = new Map<string, Player["attributeSheetStats"]>();
        for (const sheets of ergebnisse) {
          for (const sheet of sheets) {
            if (sheet.attributeSheetStats)
              naechsteMap.set(sheet.playerId, sheet.attributeSheetStats);
          }
        }
        setSheetsByPlayerId(naechsteMap);
      })
      .finally(() => {
        if (!abgebrochen) setLadeKader(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [
    saveId,
    heimTeamId,
    gastTeamId,
    miniDmTeamId0,
    miniDmTeamId1,
    miniDmTeamId2,
    miniDmTeamId3,
    activeManagerTeamId,
  ]);

  const heimKader = useMemo(
    () => buildArenaTeam(gameState, heimTeamId, sheetsByPlayerId),
    [gameState, heimTeamId, sheetsByPlayerId],
  );
  const gastKader = useMemo(
    () => buildArenaTeam(gameState, gastTeamId, sheetsByPlayerId),
    [gameState, gastTeamId, sheetsByPlayerId],
  );
  // Die vier Pod-Kader EINZELN aufgebaut (nicht ueber heimKader/gastKader, s. `miniDmPod`-
  // Kommentar oben: der Pod kann heimTeamId an JEDER der vier Positionen tragen, und
  // gastTeamId muss darin gar nicht vorkommen) — exakt dasselbe `buildArenaTeam()` wie
  // heimKader/gastKader, nur viermal mit den echten Pod-IDs.
  const miniDmKader0 = useMemo(
    () => (miniDmTeamId0 ? buildArenaTeam(gameState, miniDmTeamId0, sheetsByPlayerId) : []),
    [gameState, miniDmTeamId0, sheetsByPlayerId],
  );
  const miniDmKader1 = useMemo(
    () => (miniDmTeamId1 ? buildArenaTeam(gameState, miniDmTeamId1, sheetsByPlayerId) : []),
    [gameState, miniDmTeamId1, sheetsByPlayerId],
  );
  const miniDmKader2 = useMemo(
    () => (miniDmTeamId2 ? buildArenaTeam(gameState, miniDmTeamId2, sheetsByPlayerId) : []),
    [gameState, miniDmTeamId2, sheetsByPlayerId],
  );
  const miniDmKader3 = useMemo(
    () => (miniDmTeamId3 ? buildArenaTeam(gameState, miniDmTeamId3, sheetsByPlayerId) : []),
    [gameState, miniDmTeamId3, sheetsByPlayerId],
  );

  // MINI-DM 4-TEAM-FFA, Nutzlast fuer den Motor — NUR gesetzt, wenn ein echter Pod fuer
  // `heimTeamId` an diesem Spieltag existiert (s. `miniDmPod`-Kommentar oben) UND alle vier
  // Kader wirklich stehen (jeder mindestens einen Spieler mit vollstaendigem Attribut-Bogen)
  // — sonst liest der Motor (battle-mode.engine.js, `mdffaTeamEintraege()`)
  // `undefined`/unvollstaendig und faellt auf seinen eigenen, klar beschrifteten
  // Standalone-Ersatz zurueck, statt mit leeren oder erfundenen Teams zu rechnen.
  const miniDmFfaTeams = useMemo(() => {
    if (!miniDmPod) return null;
    const kaderByIndex = [miniDmKader0, miniDmKader1, miniDmKader2, miniDmKader3];
    const eintraege = miniDmPod.teamIds.map((teamId, index) => ({
      name: teams.find((t) => t.teamId === teamId)?.name ?? teamId,
      kader: kaderByIndex[index] ?? [],
    }));
    return eintraege.every((e) => e.kader.length > 0) ? eintraege : null;
  }, [miniDmPod, teams, miniDmKader0, miniDmKader1, miniDmKader2, miniDmKader3]);

  // DIE ECHTE KADERGROESSE k (2..6) DIESES MINI-DM-SPIELTAGS — dieselbe Funktion, die
  // `lib/resolve/mini-dm-ffa-matchday.ts` fuer die ZAEHLENDE Buchung aufruft (jetzt verschoben
  // nach `lib/season/mini-dm-pod-schedule.ts`, s. dortiger Kommentar, genau damit dieser
  // Client-Host sie importieren kann). `null`, wenn kein echter Pod existiert (dann liest der
  // Motor unten ohnehin kein `k` und faellt auf seinen alten Vierer-Pfad zurueck).
  const miniDmFfaK = useMemo(() => {
    if (!miniDmPod) return null;
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!matchdayId) return null;
    return resolveMiniDmFfaPlayerCountForMatchday(gameState, matchdayId, { saveId });
  }, [miniDmPod, gameState, gameState.matchdayState?.matchdayId, saveId]);

  // DIE GEBUCHTE POD-SAAT — `buildMiniDmFfaPodMatchSeed()` + `seedZuZahl()`
  // (`@/lib/battle/arena-seed`), DENSELBEN Funktionen, die `lib/resolve/mini-dm-ffa-matchday.ts`
  // fuer den ZAEHLENDEN Lauf aufruft (s. Kopfkommentar dort). Keine zweite Implementierung —
  // nur ein zweiter Aufrufer derselben Funktion mit denselben Argumenten, genau wie
  // `arenaSeedByDisciplineId` weiter unten fuer die klassischen Zwei-Team-Disziplinen.
  const miniDmFfaSaat = useMemo(() => {
    if (!miniDmPod || !saveId || saveId === "loading-save") return null;
    const seasonId = gameState.season?.id;
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!seasonId || !matchdayId) return null;
    return seedZuZahl(
      buildMiniDmFfaPodMatchSeed({ saveId, seasonId, matchdayId, podId: miniDmPod.id }),
    );
  }, [miniDmPod, saveId, gameState.season?.id, gameState.matchdayState?.matchdayId]);

  // DIE ECHTE AUFSTELLUNG, JE POD-TEAM EINZELN (nicht gemergt wie `buildArenaAufstellungBeide()`
  // — ein Mini-DM-Pod-Teilnehmer kennt nur seinen EIGENEN Kader, keine Namenskollision mit den
  // drei anderen Pod-Teams moeglich, s. `arena-headless-runner.ts`s
  // `MiniDmFfaPodFixtureInput`-Kopfkommentar "ein Pod-Teilnehmer kennt nur seinen EIGENEN
  // Kader"). `spieleMiniDmFfaEvent()`/`mdffaAuswahlVorbereiten()` (battle-mode.engine.js) lesen
  // `platzJeTeam[teamIdx]` POSITIONSGLEICH zu `vierTeams[teamIdx]` — die Reihenfolge hier MUSS
  // also exakt `miniDmPod.teamIds` folgen, wie `miniDmFfaTeams` oben.
  const miniDmFfaAufstellung = useMemo(() => {
    if (!miniDmPod) return null;
    const matchdayId = gameState.matchdayState?.matchdayId ?? null;
    return miniDmPod.teamIds.map((teamId) => buildArenaAufstellung(gameState, teamId, matchdayId));
  }, [miniDmPod, gameState, gameState.matchdayState?.matchdayId]);

  // A3 (docs/pm-briefings/opus-synthese-echtzeit-vs-rundenbasiert-19-09.md Abschnitt 5.3,
  // "die gebuchte Saat durch den Host reichen" — "Was Chris zuschaut, ist nicht das Spiel, das
  // gezählt hat"): DIE GEBUCHTE SAAT, keyed nach disciplineId, fuer GENAU DAS Team-Paar, das
  // gerade als Heim/Gast gewaehlt ist.
  //
  // F9-FIX (PR 3, K1 — Plan Abschnitt 5.2 "Host-Orientierung"): die Saat darf NICHT direkt aus
  // `heimTeamId`/`gastTeamId` (der UI-Auswahl) gebaut werden, sonst ergibt eine verkehrt herum
  // gewaehlte Reihenfolge einen ANDEREN Seed-String als der zaehlende Lauf. Fix:
  // `findeSpieltagsFixtures()`/`baueFixtureIndex()` (`lib/resolve/battle-mode-pps-duell.ts`,
  // bewusst ohne Fremd-Importe, s. dortiger Kommentar) sucht das ECHTE Fixture dieses Spieltags zu
  // `heimTeamId`; nur wenn es existiert UND sein Gegner GENAU `gastTeamId` ist (in beliebiger
  // Reihenfolge), wird die Saat aus `fixture.homeTeamId`/`fixture.awayTeamId` gebaut —
  // ORIENTIERUNGS-UNABHAENGIG von der UI-Auswahl, bitgleich mit dem, was der zaehlende Lauf
  // verwendet (`findLeagueFixturesForMatchday()` liest denselben `seasonState.schedule`).
  const spieltagFixtures = useMemo(
    () => findeSpieltagsFixtures(gameState, gameState.matchdayState?.matchdayId ?? ""),
    [gameState, gameState.matchdayState?.matchdayId],
  );
  const spieltagFixtureIndex = useMemo(() => baueFixtureIndex(spieltagFixtures), [spieltagFixtures]);

  // Die an DIESEM Spieltag arena-aufgeloesten Disziplinen-Slots (D1/D2) -- Vorstufe fuer
  // `resolveArenaHostSeeds()` unten, getrennt gehalten, damit die Hinweis-Anzeige (JSX weiter
  // unten) wissen kann, ob es ueberhaupt etwas zu warnen gibt (kein Arena-Slot -> kein Hinweis).
  const arenaDisziplinSlotsThisMatchday = useMemo(() => {
    const matchdayId = gameState.matchdayState?.matchdayId;
    const spieltag = gameState.seasonState?.disciplineSchedule?.find(
      (eintrag) => eintrag.matchdayId === matchdayId,
    );
    if (!spieltag) return [] as string[];
    return [spieltag.discipline1, spieltag.discipline2]
      .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot) && ARENA_RESOLVED_DISCIPLINE_IDS.has(slot!.disciplineId))
      .map((slot) => slot.disciplineId);
  }, [gameState.seasonState?.disciplineSchedule, gameState.matchdayState?.matchdayId]);

  // F9-FIX (PR 3, K1 — Plan Abschnitt 5.2 "Host-Orientierung") + PR4 "Determinismus-Feinschliff"
  // (Plan Abschnitt 5.3): die Saatberechnung selbst lebt seit PR4 als reine, eigenstaendig
  // getestete Funktion in `lib/battle/arena-host-seed.ts` (`tests/arena-seed-identitaet.test.ts`)
  // -- hier nur noch der Aufruf. `istKeinGewertetesDuell` ist neu gegenueber PR 3: vorher fiel
  // ein Nicht-Fixture-Paar STILL auf die Ersatzsaat 1337 zurueck (der Plan-Hinweis "kein
  // gewertetes Duell" aus Abschnitt 5.2 war bis hierher nie gebaut) -- jetzt zeigt die Buehne
  // einen Hinweis, s. JSX weiter unten.
  const arenaHostSeed = useMemo(() => {
    const seasonId = gameState.season?.id;
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!saveId || saveId === "loading-save" || !seasonId || !matchdayId) {
      return { seedByDisciplineId: {} as Record<string, number>, istKeinGewertetesDuell: false };
    }
    return resolveArenaHostSeeds({
      saveId,
      seasonId,
      matchdayId,
      disciplineIds: arenaDisziplinSlotsThisMatchday,
      heimTeamId,
      gastTeamId,
      fixtureIndex: spieltagFixtureIndex,
    });
  }, [
    saveId,
    gameState.season?.id,
    gameState.matchdayState?.matchdayId,
    arenaDisziplinSlotsThisMatchday,
    heimTeamId,
    gastTeamId,
    spieltagFixtureIndex,
  ]);
  const arenaSeedByDisciplineId = arenaHostSeed.seedByDisciplineId;
  // Nur ein echter Hinweis, wenn an diesem Spieltag ueberhaupt eine Arena-Disziplin steht --
  // sonst gibt es nichts, dessen Saat falsch sein koennte.
  const keinGewertetesDuell =
    arenaHostSeed.istKeinGewertetesDuell && arenaDisziplinSlotsThisMatchday.length > 0;

  // MUTATOR ORGANISCH (29.09., lib/battle/battle-mutator-organisch.ts): der ECHTE Spieltagswurf
  // je Disziplin dieses Spieltags — dieselbe Funktion mit denselben Argumenten wie Resolve
  // (`buildLegacyMatchdayResolvePreview`) und Spielplan (`rollMatchdayMutatorTraitsForSide`). Ohne
  // ihn wuerfelte der eingebettete Motor selbst und zeigte Mutator-Treffer, die es an diesem
  // Spieltag nicht gibt. Gelesen von `mutatorenFuerAktuelleDisziplin()` in battle-mode.engine.js;
  // eine Disziplin, die an diesem Spieltag nicht gespielt wird, bekommt dort keinen Mutator.
  const mutatorenByDisciplineId = useMemo(() => {
    const karte: Record<string, string[]> = {};
    const seasonId = gameState.season?.id;
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!saveId || saveId === "loading-save" || !seasonId || !matchdayId) return karte;
    const spieltag = gameState.seasonState?.disciplineSchedule?.find((eintrag) => eintrag.matchdayId === matchdayId);
    if (!spieltag) return karte;
    const d1DisciplineId = spieltag.discipline1?.disciplineId ?? null;
    const d2DisciplineId = spieltag.discipline2?.disciplineId ?? null;
    const wurf = buildMatchdayMutatorTraitsBySide({ saveId, seasonId, matchdayId, d1DisciplineId, d2DisciplineId });
    if (d1DisciplineId) karte[d1DisciplineId] = [...wurf.d1];
    if (d2DisciplineId) karte[d2DisciplineId] = [...wurf.d2];
    return karte;
  }, [saveId, gameState.season?.id, gameState.matchdayState?.matchdayId, gameState.seasonState?.disciplineSchedule]);

  /**
   * ARENA-HOST-HINWEIS ("gewertet per PPS-Duell, Arena nur Vorschau") — Task #159 Punkt 3,
   * eigener kleiner Posten, s. PR #1276s Beschreibung. Der Header-Text oben ("noch keine
   * offizielle Wertung … fließt nirgends in die Tabelle ein") gilt pauschal für JEDE Disziplin,
   * zu jeder Zeit — dieser Hinweis ist präziser: er sagt für die an DIESEM Spieltag gebuchten
   * Disziplinen, ob die ECHTE Wertung (die in die Tabelle fließt) überhaupt über die Arena
   * läuft, oder über die PPS-Duell-Brücke. Reine Logik + eigener Unit-Test in
   * `lib/foundation/battle-arena/arena-host-spielquelle-hinweis.ts` — hier nur der Aufruf.
   */
  const spielquelleHinweise = useMemo(
    () => buildArenaHostSpielquelleHinweise(gameState, heimTeamId),
    [gameState, heimTeamId],
  );

  /**
   * LIVE-PANELS ("Spieltagsergebnisse" + "Tabelle") — Chris' Freigabe 26.10. zum Mockup-Artefakt.
   * S. Dateikommentar in `lib/foundation/battle-arena/arena-live-panels.ts` für den
   * Machbarkeits-Befund (Batch-Buchung, kein "läuft/pausiert"-Zwischenzustand zwischen Fixtures).
   * Beide Panels bauen NUR eine Anzeige-Form aus bereits vorhandener Infrastruktur:
   * `buildSpieltagsUebersicht()` (Task #180, unverändert wiederverwendet — dieselbe Quelle, die der
   * Saisonstand-Tab "Spieltage" nutzt) und `/api/standings/preview` (`standings-preview-engine.ts`,
   * dieselbe Engine, die der Saisonstand-Tab für die Projektion nutzt).
   */
  const [zeigeSpieltagsergebnisse, setZeigeSpieltagsergebnisse] = useState(false);
  const [zeigeTabelle, setZeigeTabelle] = useState(false);

  const matchdayId = gameState.matchdayState?.matchdayId ?? null;

  const spieltagsUebersicht = useMemo(
    () => (matchdayId ? buildSpieltagsUebersicht(gameState, matchdayId, { saveId }) : null),
    [gameState, matchdayId, saveId],
  );

  const teamsById = useMemo(
    () => new Map(gameState.teams.map((team) => [team.teamId, { name: team.name, shortCode: team.shortCode }] as const)),
    [gameState.teams],
  );

  // Freund/Feind-Einstufung (`lib/foundation/team-relationship.ts`, dieselbe, die die native
  // Spieltags-Arena fuer Rahmenfarben nutzt) -- hier nur fuer "Rivalen-Spiel hervorheben" im
  // Spieltagsergebnisse-Panel. Bezugspunkt ist das gemanagte Team, falls bekannt, sonst das
  // gerade gewaehlte Heimteam.
  const relationshipByTeamId = useMemo(
    () =>
      buildTeamRelationshipMap(
        { teams: gameState.teams, teamControlSettings: gameState.seasonState?.teamControlSettings ?? {} },
        activeManagerTeamId ?? heimTeamId,
      ),
    [gameState.teams, gameState.seasonState?.teamControlSettings, activeManagerTeamId, heimTeamId],
  );

  const fixturesPanel = useMemo(
    () =>
      buildArenaFixturesPanel({
        uebersicht: spieltagsUebersicht,
        teamsById,
        heimTeamId,
        gastTeamId,
        relationshipByTeamId,
      }),
    [spieltagsUebersicht, teamsById, heimTeamId, gastTeamId, relationshipByTeamId],
  );

  // Standings-Preview nur ON-DEMAND (erst wenn das Tabelle-Panel wirklich offen ist) -- s.
  // `useArenaStandingsPreview`-Dateikommentar.
  const standingsPreviewAbfrage = useArenaStandingsPreview({
    enabled: zeigeTabelle,
    saveId,
    seasonId: gameState.season?.id,
    matchdayId,
  });

  const standingsPanel = useMemo(
    () =>
      buildArenaStandingsPanel({
        teams: gameState.teams,
        standings: gameState.seasonState?.standings ?? {},
        currentMatchdayNumber: gameState.season?.currentMatchday ?? null,
        ownTeamId: activeManagerTeamId ?? null,
        preview: standingsPreviewAbfrage.preview
          ? {
              matchdayResultFound: standingsPreviewAbfrage.preview.summary.matchdayResultFound,
              items: standingsPreviewAbfrage.preview.items.map((item) => ({
                teamId: item.teamId,
                projectedRank: item.projectedRank,
                projectedPoints: item.projectedPoints,
                resultStatus: item.resultStatus,
              })),
            }
          : null,
      }),
    [
      gameState.teams,
      gameState.seasonState?.standings,
      gameState.season?.currentMatchday,
      activeManagerTeamId,
      standingsPreviewAbfrage.preview,
    ],
  );

  const keineTeams = teams.length === 0;
  // "Vollstaendig geladen, aber leer" (Team hat wirklich keinen Spieler mit Attribut-Bogen)
  // nur waehrend NICHT gerade nachgeladen wird — sonst zeigt buildArenaTeam() eine falsche
  // Leermeldung fuer jeden Sekundenbruchteil, in dem sheetsByPlayerId noch die Boegen des
  // VORHERIGEN Team-Paars traegt (s. gerenderterKader-Kommentar unten fuer den zweiten,
  // gravierenderen Effekt derselben Ursache).
  const keinHeimKader =
    !ladeKader && heimTeamId !== "" && heimKader.length === 0;
  const keinGastKader =
    !ladeKader && gastTeamId !== "" && gastKader.length === 0;

  // Die Huelle wird EINMAL geladen (nicht bei jedem Team-Wechsel neu awaited) und als
  // fertig aufgeloester Wert gehalten, nicht als Promise.
  const [huelle, setHuelle] = useState<ArenaHuelle | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    ladeArenaHuelle().then((geladen) => {
      if (!abgebrochen) setHuelle(geladen);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  // DER GERENDERTE KADER — bewusst getrennt von heimKader/gastKader (den ROH-Werten fuer
  // das GERADE GEWAEHLTE Team-Paar).
  //
  // heimKader/gastKader kollabieren fuer einen Wimpernschlag auf [] IMMER dann, wenn sich
  // heimTeamId/gastTeamId aendert: buildArenaTeam() rechnet sofort mit dem neuen Team, aber
  // sheetsByPlayerId traegt bis zum Ende des Nachladens noch die Boegen des ALTEN Paars —
  // das neue Team hat darin schlicht noch keine Eintraege. Haengt der Mount-Effekt direkt an
  // heimKader/gastKader, reisst er den laufenden (voellig intakten) Motor genau in diesem
  // Wimpernschlag ab und haengt SOFORT ein neues <script> ein, dessen Markup aber noch gar
  // nicht steht. Trifft die eigentliche (asynchrone) Skript-Ausfuehrung dieses verworfenen
  // Motors dann auf den laengst wieder veraenderten oder geleerten Container, schlaegt
  // `document.getElementById("cv").getContext(...)` mit "cv is null" fehl — genau der
  // Absturz, den der Tauschen-Button zuverlaessig ausloeste (zwei Team-Wechsel in einem
  // Klick, siehe tauscheTeams unten).
  //
  // Der Mount-Effekt haengt deshalb an DIESEM Wert, der erst committet wird, wenn beide
  // Kader wirklich vollstaendig und nicht mehr im Nachladen sind. Bis dahin laeuft der
  // ALTE Motor unveraendert weiter — kein Ab-/Aufbau nur wegen eines Ladevorgangs.
  const [gerenderterKader, setGerenderterKader] = useState<{
    heimTeamId: string;
    gastTeamId: string;
    heimKader: typeof heimKader;
    gastKader: typeof gastKader;
  } | null>(null);
  useEffect(() => {
    if (ladeKader) return;
    if (heimKader.length === 0 || gastKader.length === 0) {
      setGerenderterKader(null);
      return;
    }
    setGerenderterKader({ heimTeamId, gastTeamId, heimKader, gastKader });
  }, [ladeKader, heimKader, gastKader, heimTeamId, gastTeamId]);

  // War schon einmal eine Motor-Instanz eingehaengt? Nur dann gibt es ueberhaupt etwas,
  // auf dessen Fertigwerden das naechste Einhaengen warten muesste (s. Kommentar im
  // Mount-Effekt unten).
  const motorLiefBereitsRef = useRef(false);

  // Haengt den Motor nativ ein, sobald der gerenderte Kader UND die Huelle stehen — und
  // reisst ihn komplett wieder ab, sobald sich der gerenderte Kader aendert (s. Kommentar
  // oben am Host: der Motor haelt zu viel mutablen Zustand fuer ein In-place-Update). Haengt
  // bewusst an `gerenderterKader`, NICHT an heimTeamId/gastTeamId/heimKader/gastKader direkt
  // — s. dessen Kommentar: genau diese Entkopplung verhindert den Ab-/Wiederaufbau mitten in
  // einem Nachlade-Vorgang.
  //
  // Das reicht ALLEIN aber nicht: der Motor selbst braucht nach dem Einhaengen noch bis zu
  // ~1 s (Sprite-Decodierung, Diszipilin-Matrizen), bevor er fertig ist — erkennbar an
  // `window.__arena`, das er ALS LETZTEN Schritt seiner Initialisierung setzt. Folgen zwei
  // Team-Wechsel schneller aufeinander als dieses Fenster (mehrfaches schnelles Klicken auf
  // Tauschen/Auswahl), reisst der zweite Wechsel den Container ab, WAEHREND die erste
  // Instanz noch mitten in ihrem einmaligen `document.getElementById(...)`-Aufbau steckt —
  // sie greift dann ins Leere ("cv is null"). Deshalb wartet jeder Mount ausser dem
  // allerersten erst auf das Fertig-Signal der VORHERIGEN Instanz, bevor er sie abreisst.
  useEffect(() => {
    if (!gerenderterKader || !huelle) return;
    const container = containerRef.current;
    if (!container) return;
    let abgebrochen = false;

    (async () => {
      if (motorLiefBereitsRef.current) {
        const start = Date.now();
        while (
          typeof (window as unknown as { __arena?: unknown }).__arena ===
            "undefined" &&
          Date.now() - start < 4000
        ) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      }
      if (abgebrochen) return;

      const { heimTeamId, gastTeamId, heimKader, gastKader } = gerenderterKader;

      const heimName =
        teams.find((team) => team.teamId === heimTeamId)?.name ?? "";
      const gastName =
        teams.find((team) => team.teamId === gastTeamId)?.name ?? "";

      const heimTeam = gameState.teams.find(
        (team) => team.teamId === heimTeamId,
      );
      const gastTeam = gameState.teams.find(
        (team) => team.teamId === gastTeamId,
      );
      const standings = gameState.seasonState?.standings ?? {};
      const rundePunkte = (wert: unknown) =>
        typeof wert === "number" && Number.isFinite(wert)
          ? Math.round(wert * 10) / 10
          : null;

      huelle.stylesheetHrefs.forEach(sicherstelleStylesheet);
      container.innerHTML = huelle.markup;
      // Der Foundation-Shell ist permanent dunkel (Velo) — der Entwurf soll seine
      // Flaechen daran ausrichten statt an der OS-Einstellung des Browsers, sonst
      // saesse bei hellem System ein helles Rechteck mitten in der dunklen App.
      // `im-spiel` schaltet zusaetzlich den Einbettungs-Modus der battle-mode.css
      // ein (kein eigener Seitengrund, kein doppelter Hero — der Host traegt die
      // Ueberschrift schon). Standalone/Artefakt fehlen Attribut wie Klasse, dort
      // gilt weiter prefers-color-scheme mit hellem Standard.
      const wurzel = container.querySelector<HTMLElement>(".oly-battle-arena");
      if (wurzel) {
        wurzel.setAttribute("data-theme", "dark");
        wurzel.classList.add("im-spiel");
      }
      delete (window as unknown as { __arena?: unknown }).__arena;
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = {
        heim: heimKader,
        gast: gastKader,
        // MINI-DM 4-TEAM-FFA (s. `miniDmPod`-Kommentar oben): vier echte Kader des ECHTEN
        // Spieltags-Pods, nur gesetzt, wenn ein Pod existiert und alle vier Kader stehen.
        // Der Motor liest das ausschliesslich, wenn die Disziplin "mini-dm" aktiv ist
        // (spieleMiniDmFfaEvent statt der klassischen Zwei-Seiten-Aufstellung); jede
        // andere Disziplin ignoriert dieses Feld vollstaendig.
        miniDmFfaTeams,
        // "GEZEIGT = GEBUCHT" fuer Mini-DM (PR 6, s. `miniDmFfaK`/`miniDmFfaSaat`/
        // `miniDmFfaAufstellung`-Kommentare oben): dieselbe Kadergroesse k, Saat und
        // Aufstellung, die auch der zaehlende Lauf verwendet hat — gelesen von
        // `gebuchteMiniDmFfaKontext()` in `renderMiniDmFfa()` (battle-mode.engine.js).
        // Alle drei `null`, wenn kein echter Pod existiert; der Motor faellt dann auf
        // seinen alten Verhalten zurueck (Ersatzsaat 1337, Vierer-Rollenpfad, kein `platzJeTeam`).
        miniDmFfaK,
        miniDmFfaSaat,
        miniDmFfaAufstellung,
        // DIE AUFSTELLUNG, die der Manager gesetzt hat — bis hierher reichte der
        // Umschlag nur Kader durch. Der Motor fragt sie in `slotFuer` (bauFeldspiel)
        // laengst ab und fiel mangels Daten immer auf Reihum zurueck; Chris' Zuweisung
        // hatte deshalb auf das Spiel keine Wirkung. Fehlt der Spieltag oder der
        // Aufstellungsentwurf, kommt ein leeres Objekt und alles bleibt wie bisher.
        aufstellung: buildArenaAufstellungBeide(
          gameState,
          heimTeamId,
          gastTeamId,
          gameState.matchdayState?.matchdayId ?? null,
        ),
        // kurz/platz/punkte/spieltag sind reine ANZEIGE-Daten fuer den Motor (Einlauf-
        // Tafel, Anzeigetafel, Kopfzeilen): shortCode bestimmt dort auch das Wappen
        // unter /team-logos/<kurz>.jpg, Platz und Punkte kommen aus denselben
        // seasonState.standings wie Saisonstand und Home-KPI. Fehlt eine Zahl, laesst
        // der Motor die Zeile weg, statt die Beispielwerte zu zeigen.
        meta: {
          heimTeamId,
          gastTeamId,
          heimName,
          gastName,
          heimKurz: heimTeam?.shortCode ?? null,
          gastKurz: gastTeam?.shortCode ?? null,
          heimPlatz: standings[heimTeamId]?.rank ?? null,
          gastPlatz: standings[gastTeamId]?.rank ?? null,
          heimPunkte: rundePunkte(standings[heimTeamId]?.points),
          gastPunkte: rundePunkte(standings[gastTeamId]?.points),
          ligaGroesse: teams.length,
          spieltag: gameState.season?.currentMatchday ?? null,
        },
        // A3: die gebuchte Saat je Disziplin (s. `arenaSeedByDisciplineId`-Kommentar oben) —
        // leer, wenn dieses Team-Paar an diesem Spieltag keine gebuchte Arena-Disziplin ist.
        // Gelesen von `gebuchteSaatFuerAktuelleDisziplin()` in battle-mode.engine.js.
        seedByDisciplineId: arenaSeedByDisciplineId,
        // MUTATOR ORGANISCH (29.09.): der echte Wurf je Disziplin, s. `mutatorenByDisciplineId` oben.
        mutatorenByDisciplineId,
      };
      motorLiefBereitsRef.current = true;
      for (const src of huelle.scriptSrcs) {
        const script = document.createElement("script");
        script.src = src;
        // REIHENFOLGE ERZWINGEN. Die Huelle laedt seit dem Rezept-Umzug ZWEI Skripte:
        // erst battle-mode.rezepte.js (setzt window.__ARENA_REZEPTE), dann den Motor,
        // der die Rezepte beim Aufbau seiner Chassis-Tabellen liest. Per
        // createElement erzeugte <script src> sind aber standardmaessig `async`, laufen
        // also in ZUFAELLIGER Reihenfolge (wer zuerst geladen ist, laeuft zuerst) — ohne
        // diese Zeile koennte der Motor vor den Daten starten und faende sie nicht.
        // `async = false` stellt die Dokument-Reihenfolge wieder her.
        script.async = false;
        container.appendChild(script);
      }
    })();

    // Absichtlich OHNE DOM-Aufraeumen hier: das erledigt der NAECHSTE Mount-Durchlauf
    // selbst (Leeren direkt gefolgt von Neubefuellen, ohne Zwischenzustand — derselbe
    // Grund wie beim gerenderterKader-Fix oben). Echtes Aufraeumen beim Verlassen der
    // Seite uebernimmt der eigene Effekt mit leerem Dependency-Array weiter unten.
    return () => {
      abgebrochen = true;
    };
  }, [
    gerenderterKader,
    huelle,
    teams,
    gameState,
    arenaSeedByDisciplineId,
    mutatorenByDisciplineId,
    miniDmFfaTeams,
    miniDmFfaK,
    miniDmFfaSaat,
    miniDmFfaAufstellung,
  ]);

  // Reines Verlassen-Aufraeumen: laeuft NUR beim echten Unmount der Komponente (leeres
  // Dependency-Array), nicht bei jedem Team-Wechsel — der raeumt sich selbst auf (s. oben).
  useEffect(() => {
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
      delete (window as unknown as { __olyArenaKader?: unknown })
        .__olyArenaKader;
    };
  }, []);

  // Heim und Gast in einem Zug tauschen — beide States gleichzeitig, damit nur EIN
  // Neuaufbau des Motors folgt (React batcht die beiden Setter in einem Render).
  const tauscheTeams = () => {
    setHeimTeamId(gastTeamId);
    setGastTeamId(heimTeamId);
  };
  const spiegelduell = heimTeamId !== "" && heimTeamId === gastTeamId;

  return (
    <>
      <section className="panel" aria-label="Battle Arena — Entwurf">
        <header style={{ marginBottom: 12 }}>
          <h2 style={{ margin: "0 0 4px" }}>Battle Arena — Entwurf</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
            Ein Entwurf zum Anschauen und Zerreden, noch keine offizielle
            Wertung. Aufstellung mit Reihen, Persönlichkeiten und Befehlen;
            darunter ein Kampf, der aus den echten zwölf Attributen der
            gewählten Kader gerechnet wird — kein Kampfwert ist erfunden. Der
            Ausgang fließt nirgends in die Tabelle ein.
          </p>
        </header>

        {/* Team-Wahl als Duell-Zeile: Heim (Bernstein) gegen Gast (Cyan) — dieselbe
            Zwei-Seiten-Kodierung, die der Entwurf darunter durchgehend nutzt (HP-Balken,
            Feed, Wertung). Die Selects tragen die App-Klasse .input und damit exakt das
            Feld-Styling des restlichen Foundation-Shells; das kleine Stylesheet hier ist
            komplett unter .oly-arena-* gescopet und blutet nirgendwohin. */}
        <style>{`
          .oly-arena-teamwahl{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:4px}
          .oly-arena-teamwahl .oly-arena-feld{display:flex;flex-direction:column;gap:6px;flex:0 1 300px;min-width:220px}
          .oly-arena-feldname{display:inline-flex;align-items:center;gap:7px;font-size:0.72rem;
            letter-spacing:0.08em;text-transform:uppercase}
          .oly-arena-punkt{width:9px;height:9px;border-radius:50%;flex:none;box-shadow:0 0 0 3px rgba(255,255,255,0.06)}
          .oly-arena-punkt.heim{background:#F2A03D}
          .oly-arena-punkt.gast{background:#45B0C9}
          .oly-arena-teamwahl select.input{cursor:pointer;transition:border-color 150ms ease}
          .oly-arena-teamwahl select.input:hover{border-color:rgba(255,255,255,0.32)}
          .oly-arena-tausch{min-height:48px;min-width:48px;border-radius:14px;cursor:pointer;
            border:1px solid rgba(255,255,255,0.14);background:#2f2f2f;color:#f4f4f4;
            font-size:1.15rem;line-height:1;display:inline-flex;align-items:center;justify-content:center;
            transition:border-color 150ms ease,background-color 150ms ease,transform 80ms ease}
          .oly-arena-tausch:hover{border-color:rgba(255,255,255,0.34);background:#3a3a3a}
          .oly-arena-tausch:active{transform:translateY(1px)}
          .oly-arena-status{display:flex;align-items:center;gap:10px;margin-top:12px;padding:12px 14px;
            border:1px dashed rgba(255,255,255,0.16);border-radius:12px;font-size:0.92rem}
          .oly-arena-spin{width:14px;height:14px;flex:none;border-radius:50%;
            border:2px solid rgba(255,255,255,0.18);border-top-color:#F2A03D;
            animation:olyArenaDrehen 800ms linear infinite}
          @keyframes olyArenaDrehen{to{transform:rotate(360deg)}}
          @media (prefers-reduced-motion:reduce){.oly-arena-spin{animation:none}}
        `}</style>
        <div className="oly-arena-teamwahl">
          <label className="oly-arena-feld">
            <span className="oly-arena-feldname muted">
              <i className="oly-arena-punkt heim" aria-hidden />
              Heim
            </span>
            <select
              className="input"
              value={heimTeamId}
              onChange={(event) => setHeimTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="oly-arena-tausch"
            onClick={tauscheTeams}
            title="Heim und Gast tauschen"
            aria-label="Heim und Gast tauschen"
            disabled={keineTeams}
          >
            ⇄
          </button>
          <label className="oly-arena-feld">
            <span className="oly-arena-feldname muted">
              <i className="oly-arena-punkt gast" aria-hidden />
              Gast
            </span>
            <select
              className="input"
              value={gastTeamId}
              onChange={(event) => setGastTeamId(event.target.value)}
            >
              {teams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {spiegelduell ? (
          <p
            className="muted"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            Spiegelduell — beide Seiten treten mit demselben Kader an.
          </p>
        ) : null}
        {keinGewertetesDuell ? (
          <p
            className="muted"
            data-testid="oly-arena-kein-gewertetes-duell-hinweis"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            {/* PR4 "Determinismus-Feinschliff" (Plan Abschnitt 5.2, Host-Orientierung): dieses
                Paar ist an diesem Spieltag kein gebuchtes Fixture -- der Motor spielt deshalb
                nicht mit der gezaehlten Saat, sondern mit seiner Ersatzsaat. Das gezeigte Spiel
                ist also ANDERS als das, was fuer die Tabelle zaehlt (oder zaehlen wird). */}
            Kein gewertetes Duell — dieses Team-Paar steht an diesem Spieltag nicht im Spielplan.
            Die Arena zeigt hier ein beliebiges Spiel, keine Vorschau der echten Wertung.
          </p>
        ) : null}
        {miniDmFfaTeams ? (
          <p
            className="muted"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            Mini-DM tritt hier als 4-Team-FFA an — die fuer diesen Spieltag
            tatsächlich gebuchte Vierergruppe:{" "}
            {miniDmFfaTeams.map((team, index) => (
              <span key={team.name + index}>
                {index > 0 ? ", " : ""}
                <strong>{team.name}</strong>
              </span>
            ))}
            {" "}
            (nur in der Mini-DM-Ansicht der Arena unten, ohne Auswirkung auf
            die übrigen Disziplinen; Heim/Gast muss darin nicht beide
            vorkommen — Mini-DM-Pods sind eine eigene, von der Heim/Gast-Wahl
            unabhängige Gruppierung).
          </p>
        ) : null}
        {spielquelleHinweise.length > 0 ? (
          <p
            className="muted"
            data-testid="oly-arena-spielquelle-hinweis"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            {/* Opus-Review zu PR #1282 (17.10.): der "nur Vorschau"-Zusatz muss je Disziplin
                stehen, nicht als EIN Schlusssatz hinter allen Hinweisen — sonst liest sich das
                an einem Spieltag mit einer echt per Arena UND einer per Brücke gewerteten
                Disziplin so, als wäre auch die Arena-Disziplin nur Vorschau. */}
            {spielquelleHinweise.map((hinweis, index) => (
              <span key={hinweis.disciplineId}>
                {index > 0 ? " · " : ""}
                <strong>{hinweis.disciplineName}</strong> {hinweis.text} — hier nur Vorschau.
              </span>
            ))}
          </p>
        ) : null}

        {keineTeams ? (
          <div className="oly-arena-status muted" role="status">
            Keine Teams im Spielstand gefunden.
          </div>
        ) : ladeKader ? (
          <div className="oly-arena-status muted" role="status">
            <span className="oly-arena-spin" aria-hidden />
            Kader werden geladen …
          </div>
        ) : keinHeimKader || keinGastKader ? (
          <div className="oly-arena-status muted" role="status">
            {keinHeimKader && keinGastKader
              ? "Beide gewählten Teams haben keinen Spieler mit vollständigem Attribut-Bogen."
              : keinHeimKader
                ? "Das Heim-Team hat keinen Spieler mit vollständigem Attribut-Bogen."
                : "Das Gast-Team hat keinen Spieler mit vollständigem Attribut-Bogen."}
          </div>
        ) : null}
      </section>

      {/* AUSSERHALB von .panel: die App setzt global Regeln wie ".foundation-shell .panel
          h1/h2/h3/strong" und ".foundation-shell button:focus-visible" — die wuerden sonst in
          den Entwurf HINEIN bluten (nicht nur der ueblicherweise befuerchtete Fall, dass der
          Entwurf NACH AUSSEN blutet). battle-mode.css ist zwar mit .oly-battle-arena
          gekapselt, aber Nachfahren-Selektoren der App reichen trotzdem hinein, solange dieser
          Container irgendwo unter .panel haengt — deshalb steht er bewusst daneben, nicht
          darin. */}
      {/* Bewusst OHNE eigenen Rahmen: seit die battle-mode.css im Einbettungs-Modus
          (im-spiel) die Flaechen-Tokens des Shells uebernimmt und ihren eigenen
          Seitengrund weglaesst, fliessen die Rahmen/Karten des Entwurfs direkt im
          Seitenlayout — ein zusaetzlicher Kasten drumherum saehe wieder nach Embed aus. */}
      {/* Haengt an gerenderterKader statt an kaderBereit/ladeKader: dieser div bleibt beim
          Team-Wechsel durchgaengig im DOM (React reisst ihn sonst bei jedem Zwischen-Ladezustand
          selbst ab, egal was der Mount-Effekt oben tut) — der alte Kampf laeuft sichtbar weiter,
          bis der neue Kader wirklich steht. Siehe gerenderterKader-Kommentar weiter oben. */}
      {gerenderterKader ? (
        <div ref={containerRef} style={{ marginTop: 14 }} />
      ) : null}

      <section className="panel" style={{ marginTop: 14 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Lässt sich auch direkt öffnen unter{" "}
          <code>/mockups/battle-mode.html</code> — dort laufen weiterhin die
          beiden Beispielkader, ganz ohne Spielstand.
        </p>
        <FoundationBattleArenaSpriteGallery />
      </section>

      {/* LIVE-PANELS: "Spieltagsergebnisse" + "Tabelle" (Chris' Freigabe 26.10. zum
          Mockup-Artefakt). Fixed unten rechts, damit sie beim Scrollen ueber dem eingebetteten
          Motor stehen bleiben -- der Motor haengt als eigenes <div ref={containerRef}> daneben,
          nicht darunter, dieser Block bleibt also ausserhalb seines DOM und blutet nirgendwohin. */}
      <style>{`
        .oly-arena-live-buttons{position:fixed;right:16px;bottom:16px;z-index:40;display:flex;
          flex-direction:column;align-items:flex-end;gap:8px}
        .oly-arena-live-knopf{min-height:40px;padding:0 16px;border-radius:999px;cursor:pointer;
          border:1px solid rgba(255,255,255,0.16);background:#262626;color:#f4f4f4;font-size:0.82rem;
          font-weight:600;letter-spacing:0.01em;display:inline-flex;align-items:center;gap:7px;
          box-shadow:0 4px 14px rgba(0,0,0,0.35);transition:border-color 150ms ease,background-color 150ms ease}
        .oly-arena-live-knopf:hover{border-color:rgba(255,255,255,0.34);background:#323232}
        .oly-arena-live-knopf.ist-aktiv{border-color:#F2A03D;background:#3a2c17}
        .oly-arena-live-panel{width:min(440px,calc(100vw - 32px));max-height:min(60vh,520px);
          overflow-y:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.14);
          background:#1c1c1c;color:#f0f0f0;box-shadow:0 10px 28px rgba(0,0,0,0.45);
          padding:12px 14px 14px}
        .oly-arena-live-panel-kopf{display:flex;align-items:center;justify-content:space-between;
          gap:10px;margin-bottom:8px}
        .oly-arena-live-panel-titel{font-size:0.88rem;font-weight:700;margin:0}
        .oly-arena-live-schliessen{background:none;border:none;color:#bdbdbd;cursor:pointer;
          font-size:1rem;line-height:1;padding:2px 6px;border-radius:6px}
        .oly-arena-live-schliessen:hover{color:#fff;background:rgba(255,255,255,0.08)}
        .oly-arena-live-hinweis{font-size:0.74rem;color:#bdbdbd;margin:0 0 8px}
        .oly-arena-live-hinweis.ist-vorlaeufig{color:#F2A03D}
        .oly-arena-live-zeile{display:flex;align-items:center;gap:8px;padding:6px 4px;
          border-radius:8px;font-size:0.8rem}
        .oly-arena-live-zeile.ist-eigen{background:rgba(242,160,61,0.14)}
        .oly-arena-live-zeile.ist-rivale:not(.ist-eigen){background:rgba(229,62,62,0.1)}
        .oly-arena-live-chip{flex:none;font-size:0.65rem;font-weight:700;letter-spacing:0.03em;
          text-transform:uppercase;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,0.08);
          color:#d8d8d8}
        .oly-arena-live-chip.ist-beendet{background:rgba(72,187,120,0.18);color:#8de3ab}
        .oly-arena-live-paarung{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .oly-arena-live-teams{display:flex;align-items:baseline;gap:5px;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis}
        .oly-arena-live-ergebnis{font-size:0.72rem;color:#aeaeae}
        .oly-arena-live-tabelle{width:100%;border-collapse:collapse;font-size:0.8rem}
        .oly-arena-live-tabelle th{text-align:left;font-size:0.65rem;letter-spacing:0.04em;
          text-transform:uppercase;color:#9a9a9a;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.1)}
        .oly-arena-live-tabelle td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,0.06)}
        .oly-arena-live-tabelle tr.ist-eigenes-team td{background:rgba(242,160,61,0.14)}
        .oly-arena-live-tabelle td.num{text-align:right;font-variant-numeric:tabular-nums}
      `}</style>

      <div className="oly-arena-live-buttons">
        {zeigeSpieltagsergebnisse ? (
          <div className="oly-arena-live-panel" data-testid="oly-arena-live-panel-spieltagsergebnisse">
            <div className="oly-arena-live-panel-kopf">
              <p className="oly-arena-live-panel-titel">
                {fixturesPanel ? fixturesPanel.matchdayLabel : "Spieltagsergebnisse"}
              </p>
              <button
                type="button"
                className="oly-arena-live-schliessen"
                onClick={() => setZeigeSpieltagsergebnisse(false)}
                aria-label="Spieltagsergebnisse schließen"
              >
                ✕
              </button>
            </div>
            {fixturesPanel ? (
              <>
                <p className="oly-arena-live-hinweis">
                  Alle Paarungen dieses Spieltags — dein Duell und ein Rivalen-Spiel sind
                  hervorgehoben. Ein Spieltag wird immer komplett auf einmal gewertet, es gibt
                  also kein „läuft gerade“ einzelner Paarungen — nur „gewertet“ oder „offen“.
                </p>
                {fixturesPanel.rows.length === 0 ? (
                  <p className="muted" style={{ fontSize: "0.8rem" }}>
                    Keine Paarungen an diesem Spieltag gefunden.
                  </p>
                ) : (
                  fixturesPanel.rows.map((row) => (
                    <div
                      key={row.fixtureId}
                      className={[
                        "oly-arena-live-zeile",
                        row.isOwnMatch && "ist-eigen",
                        row.isRivalMatch && "ist-rivale",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={`oly-arena-live-chip${row.gespielt ? " ist-beendet" : ""}`}>
                        {row.gespielt ? "Gewertet" : "Offen"}
                      </span>
                      <div className="oly-arena-live-paarung">
                        <span className="oly-arena-live-teams">
                          <strong>{row.homeTeamCode}</strong> – <strong>{row.awayTeamCode}</strong>
                          {row.isOwnMatch ? " · dein Duell" : row.isRivalMatch ? " · Rivale" : ""}
                        </span>
                        {row.resultLabel ? (
                          <span className="oly-arena-live-ergebnis">{row.resultLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <p className="muted" style={{ fontSize: "0.8rem" }}>
                Für diesen Spielstand gibt es keinen Spieltags-Spielplan (z. B. ein Manager-Save
                ohne Battle-Fixtures).
              </p>
            )}
          </div>
        ) : null}

        {zeigeTabelle ? (
          <div className="oly-arena-live-panel" data-testid="oly-arena-live-panel-tabelle">
            <div className="oly-arena-live-panel-kopf">
              <p className="oly-arena-live-panel-titel">Tabelle</p>
              <button
                type="button"
                className="oly-arena-live-schliessen"
                onClick={() => setZeigeTabelle(false)}
                aria-label="Tabelle schließen"
              >
                ✕
              </button>
            </div>
            <p
              className={`oly-arena-live-hinweis${standingsPanel.isProvisional ? " ist-vorlaeufig" : ""}`}
            >
              {standingsPreviewAbfrage.loading ? "Lädt …" : standingsPanel.hinweisText}
            </p>
            <table className="oly-arena-live-tabelle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th style={{ textAlign: "right" }}>Sp</th>
                  <th style={{ textAlign: "right" }}>Diff</th>
                  <th style={{ textAlign: "right" }}>Pkt</th>
                </tr>
              </thead>
              <tbody>
                {standingsPanel.rows.map((row) => (
                  <tr key={row.teamId} className={row.isOwnTeam ? "ist-eigenes-team" : ""}>
                    <td>{row.rank ?? "–"}</td>
                    <td title={row.teamName}>{row.teamCode}</td>
                    <td className="num">{row.sp ?? "–"}</td>
                    <td className="num">{row.diff != null ? row.diff.toFixed(1) : "–"}</td>
                    <td className="num">{row.points != null ? row.points.toFixed(1) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <button
          type="button"
          className={`oly-arena-live-knopf${zeigeSpieltagsergebnisse ? " ist-aktiv" : ""}`}
          onClick={() => setZeigeSpieltagsergebnisse((wert) => !wert)}
          data-testid="oly-arena-live-knopf-spieltagsergebnisse"
        >
          ⚑ Spieltagsergebnisse
        </button>
        <button
          type="button"
          className={`oly-arena-live-knopf${zeigeTabelle ? " ist-aktiv" : ""}`}
          onClick={() => setZeigeTabelle((wert) => !wert)}
          data-testid="oly-arena-live-knopf-tabelle"
        >
          ▤ Tabelle
        </button>
      </div>
    </>
  );
}
