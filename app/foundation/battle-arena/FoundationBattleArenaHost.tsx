"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ArenaSpieltagAnsicht } from "@/lib/foundation/battle-arena/arena-spieltag-ansicht";
import ArenaRegieleiste, { type ArenaRegie } from "@/app/foundation/battle-arena/ArenaRegieleiste";
import { ArenaLadebild, ArenaVorstellung, type VorraumAusblick } from "@/app/foundation/battle-arena/ArenaVorraum";
import { baueLadeSchritte, baueVorraumTeams } from "@/lib/foundation/battle-arena/arena-vorraum";

import ArenaVollflaecheBuehne from "@/app/foundation/battle-arena/ArenaVollflaecheBuehne";
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
import { buildArenaStrategieBeide } from "@/lib/foundation/battle-arena/arena-strategie-adapter";
import { ermittleArenaVerletzungsstand, type ArenaVerletzungsstand } from "@/lib/fatigue/fatigue-injury-service";
import { buildBahnPodMatchSeed, buildBattlefieldPodMatchSeed, buildMiniDmFfaPodMatchSeed, seedZuZahl } from "@/lib/battle/arena-seed";
import { resolveArenaHostSeeds } from "@/lib/battle/arena-host-seed";
import { ARENA_RESOLVED_DISCIPLINE_IDS, battlefieldPodFormatOption } from "@/lib/battle/arena-resolved-disciplines";
import { buildMatchdayMutatorTraitsBySide } from "@/lib/lineups/legacy-lineup-modifiers";
import { baueFixtureIndex, findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildArenaHostSpielquelleHinweise } from "@/lib/foundation/battle-arena/arena-host-spielquelle-hinweis";
import {
  getMiniDmPodForTeam,
  resolveMiniDmFfaPlayerCountForMatchday,
  resolvePodPlayerCountForMatchday,
} from "@/lib/season/mini-dm-pod-schedule";
import { buildSpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import { buildTeamRelationshipMap } from "@/lib/foundation/team-relationship";
import {
  buildArenaFixturesPanel,
  buildArenaStandingsPanel,
} from "@/lib/foundation/battle-arena/arena-live-panels";
import { useArenaStandingsPreview } from "@/lib/foundation/battle-arena/use-arena-standings-preview";
import { findeArenaPodMitVorschau } from "@/lib/foundation/battle-arena/arena-pod-vorschau";

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
    huelleCache = fetch("/mockups/battle-mode.html", { cache: "no-cache" })
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

type ArenaFenster = {
  __arena?: {
    setDisc?: (disziplin: string) => void;
    schnellDurch?: () => Promise<unknown>;
    spielEndeStand?: () => { disziplin: string; done: boolean; sieger: 0 | 1 | null };
    // Beendet die Motor-Instanz (Zeichenschleife, Timer, Ton); idempotent. Der Host ruft sie VOR
    // jedem Abreissen/Neuaufbau, sonst laeuft die alte Instanz unsichtbar weiter.
    stopp?: () => boolean;
  };
  __olyArenaKader?: unknown;
};

// Beendet die aktuell laufende Motor-Instanz (`window.__arena` gehoert immer der neuesten). Aeltere
// Instanzen stoppen sich selbst, sobald ihr Canvas nicht mehr im Dokument haengt.
function stoppeLaufendenMotor(): void {
  try {
    (window as unknown as ArenaFenster).__arena?.stopp?.();
  } catch {
    // Aufraeumen darf den Neuaufbau nie verhindern.
  }
}

async function warteAufMotor(fristMs: number): Promise<boolean> {
  const start = Date.now();
  while (typeof (window as unknown as ArenaFenster).__arena === "undefined") {
    if (Date.now() - start > fristMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return true;
}

// VORSCHAU OHNE AUFSTELLUNG (Review N2, 17.11.): zeigt die Arena die Vierergruppe eines KUENFTIGEN
// Spieltags und hat dort noch nicht jedes Team einen Aufstellungsentwurf (`buildArenaAufstellung`
// liefert dann `{}`), laeuft das Bild mit der Ersatzaufstellung nach Eignung. Gebucht wird spaeter die
// Aufstellung, die bis dahin steht -- "gezeigt = gebucht" gilt dann nur unter dieser Annahme, und der
// Hinweistext sagt es.
/**
 * Index des gesteuerten Teams und seines Spieltagsgegners in einer Vierergruppe (Pod-Reihenfolge der
 * Buchung). Nur fuer die Anzeige (Vorstellung im Motor, `einlaufSeiten()`), s. `podGegnerTeamId`.
 */
function podSeitenFuer(
  podTeamIds: readonly string[],
  eigenesTeamId: string | null | undefined,
  gegnerTeamId: string | null | undefined,
): { eigeneSeite: number | null; gegnerSeite: number | null } {
  const eigeneSeite = eigenesTeamId ? podTeamIds.indexOf(eigenesTeamId) : -1;
  const gegnerSeite = gegnerTeamId ? podTeamIds.indexOf(gegnerTeamId) : -1;
  return {
    eigeneSeite: eigeneSeite >= 0 ? eigeneSeite : null,
    gegnerSeite: gegnerSeite >= 0 && gegnerSeite !== eigeneSeite ? gegnerSeite : null,
  };
}

function aufstellungNochOffen(pod: {
  aufstellung: Record<string, unknown>[];
  vorschau: { art: "heute" | "vorschau" | "rueckblick" } | null;
}): boolean {
  return pod.vorschau?.art === "vorschau" && pod.aufstellung.some((a) => Object.keys(a ?? {}).length === 0);
}

export default function FoundationBattleArenaHost({
  gameState,
  activeManagerTeamId,
  saveId,
  spieltag = null,
}: {
  gameState: GameState;
  activeManagerTeamId?: string | null;
  saveId?: string | null;
  /**
   * SPIELTAGS-ANSICHT (02.11.): gesetzt, wenn dieser Host NICHT als eigenstaendiger Entwurfsreiter
   * laeuft, sondern in der Arena des normalen Spieltagsablaufs (`DisciplineStageArena.tsx`) das
   * GEBUCHTE Spiel zeigt. Dann sind Heim/Gast fest (Fixture-Orientierung wie im zaehlenden Lauf),
   * die Pods werden fuer das eigene Team gesucht, der Motor zeigt genau `disciplineId`, Eingriffe
   * ins Spiel sind aus (`nurZuschauen`), und das Ende des Spiels meldet sich per `onEnde`. Ohne
   * diese Prop ist alles wie bisher. S. `lib/foundation/battle-arena/arena-spieltag-ansicht.ts`.
   */
  spieltag?: (ArenaSpieltagAnsicht & {
    disziplinName?: string | null;
    /** Gebuchte Vierergruppe (Reihenfolge der Buchung), nur beim Pod -- Quelle fuer Kopf und Vorstellung. */
    podTeamIds?: string[] | null;
    /** Regieleiste (Ort, drei Schritte, Mitspieler, "Du steuerst"). */
    regie?: ArenaRegie | null;
    disziplinNr?: number;
    disziplinAnzahl?: number;
    /** Ausblick auf Disziplin 2 im Ladebild. */
    ausblick?: VorraumAusblick | null;
    onEnde?: ((info: { disziplin: string; sieger: 0 | 1 | null }) => void) | null;
  }) | null;
}) {
  const teams = useMemo<ArenaTeamAuswahl[]>(
    () => listeArenaTeams(gameState),
    [gameState],
  );

  const [heimTeamId, setHeimTeamId] = useState<string>(() => {
    if (spieltag) return spieltag.heimTeamId;
    if (
      activeManagerTeamId &&
      teams.some((team) => team.teamId === activeManagerTeamId)
    ) {
      return activeManagerTeamId;
    }
    return teams[0]?.teamId ?? "";
  });
  const [gastTeamId, setGastTeamId] = useState<string>(() => {
    if (spieltag) return spieltag.gastTeamId;
    const andere = teams.find((team) => team.teamId !== heimTeamId);
    return andere?.teamId ?? teams[0]?.teamId ?? "";
  });
  // Spieltags-Ansicht: Heim/Gast folgen der Prop (Fixture-Orientierung), keine freie Wahl.
  const spieltagHeim = spieltag?.heimTeamId ?? null;
  const spieltagGast = spieltag?.gastTeamId ?? null;
  useEffect(() => {
    if (spieltagHeim) setHeimTeamId(spieltagHeim);
    if (spieltagGast) setGastTeamId(spieltagGast);
  }, [spieltagHeim, spieltagGast]);
  // Bezugsteam fuer die Pod-Suche (Mini-DM, Battlefield, Bahn-Pod). Im Entwurfsreiter das gewaehlte
  // Heimteam wie bisher; in der Spieltags-Ansicht das EIGENE Team -- Heim ist dort das Heimteam des
  // Fixtures, und das kann der Gegner sein, dessen Pod ein anderer ist.
  const podBezugTeamId = spieltag?.podTeamId ?? heimTeamId;
  // EIGENES TEAM UND SEIN GEGNER IN DER VIERERGRUPPE (18.11., Chris' Live-Befund D2 Battlefield: die
  // Vorstellung zeigte "Mayhem Mavericks vs Project Suicide" -- die ersten beiden Teams der Gruppe --,
  // obwohl er Nunchuck Ninjas steuert). Der Motor bekommt je Pod den Index des gesteuerten Teams und
  // seines Spieltagsgegners in der Gruppe mit (`eigeneSeite`/`gegnerSeite`, gelesen von
  // `einlaufSeiten()` in battle-mode.engine.js). Reine Anzeige: Gruppenreihenfolge, Saat und
  // Aufstellung bleiben die der Buchung ("gezeigt = gebucht").
  const podGegnerTeamId = podBezugTeamId === heimTeamId ? gastTeamId : heimTeamId;

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
    if (!podBezugTeamId || !matchdayId || !saveId || saveId === "loading-save") return null;
    return getMiniDmPodForTeam(gameState, podBezugTeamId, matchdayId, { saveId });
  }, [gameState, podBezugTeamId, gameState.matchdayState?.matchdayId, saveId]);

  // Primitive Strings statt des Pod-Objekts selbst als Hook-Abhaengigkeiten weiter unten —
  // `miniDmPod` ist bei gleichen Eingaben zwar bereits memoisiert (dieselbe Referenz bleibt
  // ueber Re-Renders stabil), aber die VIER IDs einzeln zu fuehren haelt den Rest dieser Datei
  // im selben Stil wie das bisherige `dritteTeamId`/`vierteTeamId`-Paar.
  const [miniDmTeamId0, miniDmTeamId1, miniDmTeamId2, miniDmTeamId3] =
    miniDmPod?.teamIds ?? (["", "", "", ""] as const);

  // BATTLEFIELD 4-TEAM-FFA (02.11., docs/design/battlefield-pod-ffa-02-11.md). Chris: "auch bei
  // battlefield reicht kein hinweistext! da sollen 4 teams gleichzeitig FFA machen". Derselbe Weg
  // wie `miniDmPod` oben: `getPodForTeam(..., "battlefield")` ist dieselbe Funktion, mit der Resolve
  // die Vierergruppe bucht (`getPodsForMatchday`). Gibt es an diesem Spieltag keinen Battlefield-Pod
  // fuer `heimTeamId`, bleibt alles `null` und der Motor zeigt Battlefield wie bisher als Duell.
  //
  // VORSCHAU (17.11., `findeArenaPodMitVorschau`): steht Battlefield HEUTE nicht an, zeigt der
  // Entwurfsreiter die Vierergruppe des naechsten Battlefield-Spieltags -- samt dessen Saat, k und
  // Aufstellung, also genau das Gefecht, das dort gebucht wird. In der Spieltags-Ansicht nur "heute".
  const battlefieldPodTreffer = useMemo(() => {
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!podBezugTeamId || !matchdayId || !saveId || saveId === "loading-save") return null;
    return findeArenaPodMitVorschau(gameState, podBezugTeamId, matchdayId, "battlefield", {
      saveId,
      nurHeute: spieltag != null,
    });
  }, [gameState, podBezugTeamId, gameState.matchdayState?.matchdayId, saveId, spieltag]);
  const battlefieldPod = battlefieldPodTreffer?.pod ?? null;
  const [bfPodTeamId0, bfPodTeamId1, bfPodTeamId2, bfPodTeamId3] =
    battlefieldPod?.teamIds ?? (["", "", "", ""] as const);

  // BAHN-POD (Liga-Verdrahtung 02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6):
  // Takeshi's Castle und Staffel werden an Pod-Tagen als ECHTES Vier-Team-Rennen GEBUCHT
  // (lib/resolve/bahn-pod-resolve.ts) -- die Arena zeigt deshalb genau dieses Rennen: dieselbe
  // Vierergruppe (`getPodForTeam`, wie die Buchung), dieselbe Saat (`buildBahnPodMatchSeed`, auch
  // Formkarten), dieselbe Aufstellung je Team und dieselbe Kopfzahl k wie der zaehlende Lauf
  // (`runBahnPodFixtures`). Ohne Pod fuer `heimTeamId` bleibt es beim Duell.
  // VORSCHAU (17.11.): wie bei Battlefield -- steht die Disziplin heute nicht an, die Vierergruppe des
  // naechsten Spieltags, an dem sie als Pod gebucht wird (s. `findeArenaPodMitVorschau`). Genau das war
  // Chris' Befund "in takeshi ... nur 2 teams": am Live-Stand (Spieltag 1) stand weder Takeshi noch
  // Staffel an, die Suche nur am aktuellen Spieltag fand keinen Pod, und der Motor zeigte das Duell.
  const bahnPodTakeshiTreffer = useMemo(() => {
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!podBezugTeamId || !matchdayId || !saveId || saveId === "loading-save") return null;
    return findeArenaPodMitVorschau(gameState, podBezugTeamId, matchdayId, "takeshis-castle", {
      saveId,
      nurHeute: spieltag != null,
    });
  }, [gameState, podBezugTeamId, gameState.matchdayState?.matchdayId, saveId, spieltag]);
  const bahnPodStaffelTreffer = useMemo(() => {
    const matchdayId = gameState.matchdayState?.matchdayId;
    if (!podBezugTeamId || !matchdayId || !saveId || saveId === "loading-save") return null;
    return findeArenaPodMitVorschau(gameState, podBezugTeamId, matchdayId, "staffel", {
      saveId,
      nurHeute: spieltag != null,
    });
  }, [gameState, podBezugTeamId, gameState.matchdayState?.matchdayId, saveId, spieltag]);
  const bahnPodTakeshi = bahnPodTakeshiTreffer?.pod ?? null;
  const bahnPodStaffel = bahnPodStaffelTreffer?.pod ?? null;
  const bahnPodTeamIdsSchluessel = [...(bahnPodTakeshi?.teamIds ?? []), ...(bahnPodStaffel?.teamIds ?? [])].join("|");

  // ENTWURFS-VIERERGRUPPE (17.11.), nur noch LETZTER Rueckfall: findet `findeArenaPodMitVorschau` in
  // der ganzen Saison keinen Pod (kein Spielplan, Liga nicht durch 4 teilbar), zeigt der Entwurfsreiter
  // eine Vierergruppe aus Heim, Gast und den naechsten zwei Teams der Liste. Nur Anzeige: nichts davon
  // wird gebucht, der Hinweistext sagt es. In der Spieltags-Ansicht (`spieltag` gesetzt) gibt es sie
  // nie -- dort gilt weiter "gezeigt = gebucht".
  const entwurfsGruppeTeamIds = useMemo<string[] | null>(() => {
    if (spieltag || teams.length < 4) return null;
    const ids = [heimTeamId, gastTeamId].filter((id, i, alle) => id && alle.indexOf(id) === i);
    for (const team of teams) {
      if (ids.length >= 4) break;
      if (!ids.includes(team.teamId)) ids.push(team.teamId);
    }
    return ids.length === 4 ? ids : null;
  }, [spieltag, teams, heimTeamId, gastTeamId]);
  const entwurfsGruppeSchluessel = entwurfsGruppeTeamIds?.join("|") ?? "";

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
        [
          heimTeamId,
          gastTeamId,
          miniDmTeamId0,
          miniDmTeamId1,
          miniDmTeamId2,
          miniDmTeamId3,
          bfPodTeamId0,
          bfPodTeamId1,
          bfPodTeamId2,
          bfPodTeamId3,
          ...bahnPodTeamIdsSchluessel.split("|"),
          ...entwurfsGruppeSchluessel.split("|"),
        ].filter(Boolean),
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
    bfPodTeamId0,
    bfPodTeamId1,
    bfPodTeamId2,
    bfPodTeamId3,
    bahnPodTeamIdsSchluessel,
    entwurfsGruppeSchluessel,
    activeManagerTeamId,
  ]);

  // VERLETZUNG IM MOTOR (Chris, 18.11., docs/design/verletzung-regel-18-11.md Luecke D/B): derselbe
  // Verletzungsstand wie Vorlauf, Arena-Eingabe-Hash und Buchung (`ermittleArenaVerletzungsstand`,
  // deterministisch aus Saat und Spielstand) — ein heute Verletzter tritt auch auf der Buehne mit 50 %
  // seiner Eignung an, ein aus einem Vorspieltag Gesperrter gar nicht. Gezeigt = gebucht.
  // Je Spieltag einmal gerechnet (Pods koennen einen Vorschau-Spieltag zeigen, s. unten).
  const verletzungsstandFuer = useMemo(() => {
    const cache = new Map<string, ArenaVerletzungsstand>();
    const seasonId = gameState.season?.id;
    return (matchdayId: string | null | undefined): ArenaVerletzungsstand | null => {
      if (!matchdayId || !seasonId || !saveId || saveId === "loading-save") return null;
      const vorhanden = cache.get(matchdayId);
      if (vorhanden) return vorhanden;
      const stand = ermittleArenaVerletzungsstand({ gameState, saveId, seasonId, matchdayId });
      cache.set(matchdayId, stand);
      return stand;
    };
  }, [gameState, saveId]);
  const verletzungsstandHeute = useMemo(
    () => verletzungsstandFuer(gameState.matchdayState?.matchdayId ?? null),
    [verletzungsstandFuer, gameState.matchdayState?.matchdayId],
  );

  const heimKader = useMemo(
    () => buildArenaTeam(gameState, heimTeamId, sheetsByPlayerId, verletzungsstandHeute),
    [gameState, heimTeamId, sheetsByPlayerId, verletzungsstandHeute],
  );
  const gastKader = useMemo(
    () => buildArenaTeam(gameState, gastTeamId, sheetsByPlayerId, verletzungsstandHeute),
    [gameState, gastTeamId, sheetsByPlayerId, verletzungsstandHeute],
  );
  // Die vier Pod-Kader EINZELN aufgebaut (nicht ueber heimKader/gastKader, s. `miniDmPod`-
  // Kommentar oben: der Pod kann heimTeamId an JEDER der vier Positionen tragen, und
  // gastTeamId muss darin gar nicht vorkommen) — exakt dasselbe `buildArenaTeam()` wie
  // heimKader/gastKader, nur viermal mit den echten Pod-IDs.
  const miniDmKader0 = useMemo(
    () => (miniDmTeamId0 ? buildArenaTeam(gameState, miniDmTeamId0, sheetsByPlayerId, verletzungsstandHeute) : []),
    [gameState, miniDmTeamId0, sheetsByPlayerId, verletzungsstandHeute],
  );
  const miniDmKader1 = useMemo(
    () => (miniDmTeamId1 ? buildArenaTeam(gameState, miniDmTeamId1, sheetsByPlayerId, verletzungsstandHeute) : []),
    [gameState, miniDmTeamId1, sheetsByPlayerId, verletzungsstandHeute],
  );
  const miniDmKader2 = useMemo(
    () => (miniDmTeamId2 ? buildArenaTeam(gameState, miniDmTeamId2, sheetsByPlayerId, verletzungsstandHeute) : []),
    [gameState, miniDmTeamId2, sheetsByPlayerId, verletzungsstandHeute],
  );
  const miniDmKader3 = useMemo(
    () => (miniDmTeamId3 ? buildArenaTeam(gameState, miniDmTeamId3, sheetsByPlayerId, verletzungsstandHeute) : []),
    [gameState, miniDmTeamId3, sheetsByPlayerId, verletzungsstandHeute],
  );

  // BATTLEFIELD 4-TEAM-FFA, Nutzlast fuer den Motor (`echterKader.battlefieldPod`, gelesen von
  // `bfPodAnzeigeKontext()` in battle-mode.engine.js): vier Kader in Pod-Reihenfolge, die Kopfzahl k
  // aus dem Spielplan-Slot, eine reproduzierbare Saat je Pod und die echte Aufstellung je Team.
  // `null`, solange nicht alle vier Kader stehen — dann zeigt der Motor das Duell wie bisher.
  const battlefieldPodNutzlast = useMemo(() => {
    // Ohne echten Pod im Entwurfsreiter: die Entwurfs-Vierergruppe (s. `entwurfsGruppeTeamIds`).
    const entwurf = !battlefieldPod && entwurfsGruppeTeamIds != null;
    const podTeamIds = battlefieldPod?.teamIds ?? entwurfsGruppeTeamIds;
    if (!podTeamIds) return null;
    // Saat, k und Aufstellung vom Spieltag, an dem DIESE Gruppe gebucht wird (heute oder Vorschau).
    const matchdayId = battlefieldPodTreffer?.matchdayId ?? gameState.matchdayState?.matchdayId ?? null;
    const seasonId = gameState.season?.id;
    if (!seasonId || !saveId || saveId === "loading-save") return null;
    if (!matchdayId && !entwurf) return null;
    const podTeams = podTeamIds.map((teamId) => {
      const team = teams.find((t) => t.teamId === teamId);
      return {
        name: team?.name ?? teamId,
        kurz: gameState.teams.find((t) => t.teamId === teamId)?.shortCode ?? null,
        kader: buildArenaTeam(gameState, teamId, sheetsByPlayerId, verletzungsstandFuer(matchdayId)),
      };
    });
    if (!podTeams.every((t) => t.kader.length > 0)) return null;
    return {
      teams: podTeams,
      k: matchdayId ? resolvePodPlayerCountForMatchday(gameState, matchdayId, "battlefield", { saveId }) : null,
      saat: seedZuZahl(
        buildBattlefieldPodMatchSeed({
          saveId,
          seasonId,
          matchdayId: matchdayId ?? "entwurf",
          podId: battlefieldPod?.id ?? `entwurf-${podTeamIds.join("-")}`,
        }),
      ),
      aufstellung: podTeamIds.map((teamId) => buildArenaAufstellung(gameState, teamId, matchdayId)),
      entwurf,
      vorschau: battlefieldPodTreffer && battlefieldPodTreffer.art !== "heute" ? battlefieldPodTreffer : null,
      ...podSeitenFuer(podTeamIds, podBezugTeamId, podGegnerTeamId),
      // Format-Umschalter (17.11.): dieselbe Konstante wie die Buchung (BATTLEFIELD_POD_FORMAT); im
      // Standard "orte3" fehlt das Feld, der Motor zeigt dann das Gefecht je Ort wie bisher.
      ...battlefieldPodFormatOption(),
    };
  }, [battlefieldPod, battlefieldPodTreffer, entwurfsGruppeTeamIds, gameState, saveId, teams, sheetsByPlayerId, podBezugTeamId, podGegnerTeamId, verletzungsstandFuer]);

  // BAHN-POD, Nutzlast fuer den Motor (`echterKader.bahnPodByDisciplineId[bd]`, gelesen von
  // `bahnPodAnzeigeKontext()` in battle-mode.engine.js): je Bahn-Pod-Disziplin dieses Spieltags die
  // vier Kader in Pod-Reihenfolge, k, die Wertungssaat und die Aufstellung je Team. Fehlt ein Kader
  // noch (Bulk-Laden laeuft), bleibt die Disziplin draussen und der Motor zeigt das Duell.
  const bahnPodNutzlast = useMemo(() => {
    const heuteMatchdayId = gameState.matchdayState?.matchdayId ?? null;
    const seasonId = gameState.season?.id;
    if (!heuteMatchdayId || !seasonId || !saveId || saveId === "loading-save") return null;
    const karte: Record<
      string,
      {
        teams: { name: string; kurz: string | null; kader: ReturnType<typeof buildArenaTeam> }[];
        k: number | null;
        saat: number;
        aufstellung: ReturnType<typeof buildArenaAufstellung>[];
        /** Entwurfs-Vierergruppe statt gebuchtem Pod (nur im Entwurfsreiter, nur Hinweistext). */
        entwurf: boolean;
        /** Gebuchter Pod eines anderen Spieltags (Vorschau/Rueckblick), sonst null. */
        vorschau: { spieltagNummer: number; art: "heute" | "vorschau" | "rueckblick" } | null;
        /** Index des gesteuerten Teams / seines Spieltagsgegners in der Gruppe (nur Anzeige). */
        eigeneSeite: number | null;
        gegnerSeite: number | null;
      }
    > = {};
    for (const [disciplineId, treffer] of [
      ["takeshis-castle", bahnPodTakeshiTreffer],
      ["staffel", bahnPodStaffelTreffer],
    ] as const) {
      const pod = treffer?.pod ?? null;
      // Saat, k und Aufstellung vom Spieltag, an dem DIESE Gruppe gebucht wird (heute oder Vorschau).
      const matchdayId = treffer?.matchdayId ?? heuteMatchdayId;
      // Ohne echten Pod im Entwurfsreiter: die Entwurfs-Vierergruppe (s. `entwurfsGruppeTeamIds`).
      const entwurf = !pod && entwurfsGruppeTeamIds != null;
      const podTeamIds = pod?.teamIds ?? entwurfsGruppeTeamIds;
      if (!podTeamIds) continue;
      const podTeams = podTeamIds.map((teamId) => ({
        name: teams.find((t) => t.teamId === teamId)?.name ?? teamId,
        kurz: gameState.teams.find((t) => t.teamId === teamId)?.shortCode ?? null,
        kader: buildArenaTeam(gameState, teamId, sheetsByPlayerId, verletzungsstandFuer(matchdayId)),
      }));
      if (!podTeams.every((t) => t.kader.length > 0)) continue;
      karte[disciplineId] = {
        teams: podTeams,
        k: resolvePodPlayerCountForMatchday(gameState, matchdayId, disciplineId, { saveId }),
        saat: seedZuZahl(
          buildBahnPodMatchSeed({
            saveId,
            seasonId,
            matchdayId,
            disciplineId,
            podId: pod?.id ?? `entwurf-${podTeamIds.join("-")}`,
          }),
        ),
        aufstellung: podTeamIds.map((teamId) => buildArenaAufstellung(gameState, teamId, matchdayId)),
        entwurf,
        vorschau: treffer && treffer.art !== "heute" ? treffer : null,
        ...podSeitenFuer(podTeamIds, podBezugTeamId, podGegnerTeamId),
      };
    }
    return Object.keys(karte).length > 0 ? karte : null;
  }, [bahnPodTakeshiTreffer, bahnPodStaffelTreffer, entwurfsGruppeTeamIds, gameState, saveId, teams, sheetsByPlayerId, podBezugTeamId, podGegnerTeamId, verletzungsstandFuer]);

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
      return {
        seedByDisciplineId: {} as Record<string, number>,
        kulisseByDisciplineId: {} as Record<string, string>,
        istKeinGewertetesDuell: false,
      };
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
  // OBERFLAECHEN-EFFEKTE (08.11., lib/battle/arena-kulisse.ts): die gebuchte Kulissen-Variante je
  // Disziplin -- dieselbe, die der Runner der Wertung mitgibt, damit die Arena genau den Platz
  // zeigt, auf dem gewertet wird. Leer fuer Disziplinen ohne Kulissen-Profil.
  const arenaKulisseByDisciplineId = arenaHostSeed.kulisseByDisciplineId;
  // STRATEGIE-VORLAGEN (Pilot Wettessen, 17.11., lib/foundation/battle-arena/arena-strategie-adapter.ts):
  // dieselbe Funktion wie Vorlauf/Buchung (`bereiteFixturesVor`), damit gezeigt = gebucht. `null` bei
  // Flagge aus (Standard) oder neutral -- dann fehlt das Feld im Umschlag ganz (Signatur unveraendert).
  const arenaStrategieByDisciplineId = useMemo(
    () =>
      buildArenaStrategieBeide(
        gameState,
        heimTeamId,
        gastTeamId,
        gameState.matchdayState?.matchdayId ?? null,
        arenaDisziplinSlotsThisMatchday,
      ),
    [gameState, heimTeamId, gastTeamId, arenaDisziplinSlotsThisMatchday],
  );
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

  // SPIELTAGS-ANSICHT: welche Motor-Instanz steht gerade (Signatur der Nutzlast ohne Anzeige-Meta),
  // welche Disziplin ihr zuletzt gesetzt wurde, und ob sie bereit ist. Ein neuer gameState nach
  // einer Buchung (Tabellenstand, Spieltagsergebnis) aendert an der Nutzlast nichts -- der Motor
  // darf dann NICHT neu aufgebaut werden, sonst verschwaende der Endstand, den der Spieler gerade
  // gesehen und damit gebucht hat.
  const istSpieltag = spieltag != null;
  const spieltagDisziplinId = spieltag?.disciplineId ?? null;
  const gemounteteSignaturRef = useRef<string | null>(null);
  const mountNrRef = useRef(0);
  const aktuelleDisziplinRef = useRef<string | null>(spieltagDisziplinId);
  aktuelleDisziplinRef.current = spieltagDisziplinId;
  const gesetzteDisziplinRef = useRef<string | null>(null);
  const [motorBereit, setMotorBereit] = useState(false);
  const onEndeRef = useRef(spieltag?.onEnde ?? null);
  onEndeRef.current = spieltag?.onEnde ?? null;
  const [spultVor, setSpultVor] = useState(false);
  const [endeInfo, setEndeInfo] = useState<{ disziplin: string; sieger: 0 | 1 | null } | null>(null);
  // VORSTELLUNG (18.11., Mockup Screen 2): bis "Zur Arena" bzw. Quick-Sim liegt sie ueber der Buehne; mit jedem
  // Disziplinwechsel (D1 -> D2) beginnt sie neu. Kein Spoiler: der Motor steht bis dahin am Anfang.
  const [vorstellungFuerDisziplin, setVorstellungFuerDisziplin] = useState<string | null>(null);
  const vorstellungErledigt = vorstellungFuerDisziplin != null && vorstellungFuerDisziplin === spieltagDisziplinId;
  const setVorstellungErledigt = (_erledigt: boolean) => setVorstellungFuerDisziplin(spieltagDisziplinId);

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

      const umschlag = {
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
        // BATTLEFIELD 4-TEAM-FFA (s. `battlefieldPodNutzlast` oben): nur fuer Battlefield gelesen,
        // `null` ohne echten Pod an diesem Spieltag (dann Duell wie bisher).
        battlefieldPod: battlefieldPodNutzlast,
        // BAHN-POD (s. `bahnPodNutzlast` oben): nur fuer Takeshi's Castle/Staffel gelesen, `null`
        // ohne Pod an diesem Spieltag (dann Duell wie bisher).
        bahnPodByDisciplineId: bahnPodNutzlast,
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
        // A3: die gebuchte Saat je Disziplin (s. `arenaSeedByDisciplineId`-Kommentar oben) —
        // leer, wenn dieses Team-Paar an diesem Spieltag keine gebuchte Arena-Disziplin ist.
        // Gelesen von `gebuchteSaatFuerAktuelleDisziplin()` in battle-mode.engine.js.
        seedByDisciplineId: arenaSeedByDisciplineId,
        // Gelesen von `kulisseSpielId()`/`kulisseWaehlen()` in battle-mode.engine.js.
        kulisseByDisciplineId: arenaKulisseByDisciplineId,
        // Gelesen von `strategieVorlageVon()` in battle-mode.engine.js; nur mit Vorlage gesetzt.
        ...(arenaStrategieByDisciplineId ? { strategieByDisciplineId: arenaStrategieByDisciplineId } : {}),
        // MUTATOR ORGANISCH (29.09.): der echte Wurf je Disziplin, s. `mutatorenByDisciplineId` oben.
        mutatorenByDisciplineId,
        // SPIELTAGS-ANSICHT: keine Eingriffe ins gebuchte Spiel (s. `nurZuschauen` im Motor).
        nurZuschauen: istSpieltag,
      };
      // Spieltags-Ansicht: steht schon ein Motor mit genau dieser Nutzlast, bleibt er stehen (s.
      // `gemounteteSignaturRef`). Die Anzeige-Meta (Tabellenplatz, Punkte) zaehlt dafuer nicht.
      const signatur = istSpieltag ? JSON.stringify(umschlag) : null;
      if (
        signatur != null &&
        signatur === gemounteteSignaturRef.current &&
        container.querySelector(".oly-battle-arena")
      ) {
        return;
      }

      huelle.stylesheetHrefs.forEach(sicherstelleStylesheet);
      // Alte Motor-Instanz beenden, BEVOR ihr DOM verschwindet (sonst Zombie-Schleife, s. `stopp`).
      stoppeLaufendenMotor();
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
        if (istSpieltag) wurzel.classList.add("im-spieltag");
      }
      delete (window as unknown as { __arena?: unknown }).__arena;
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = {
        ...umschlag,
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

      // SPIELTAGS-ANSICHT: auf den Motor warten, dann direkt in die Arena (nicht in die Aufstellung,
      // die im Zuschau-Modus ohnehin ausgeblendet ist) und auf die Disziplin des Spieltags stellen.
      // Ein Mount-Zaehler statt `abgebrochen`: ein spaeterer Effektlauf, der wegen gleicher
      // Signatur NICHT neu aufbaut, darf diesen Schritt nicht verwerfen.
      if (istSpieltag) {
        mountNrRef.current += 1;
        const meineNr = mountNrRef.current;
        gemounteteSignaturRef.current = signatur;
        gesetzteDisziplinRef.current = null;
        setMotorBereit(false);
        setEndeInfo(null);
        const bereit = await warteAufMotor(15000);
        if (!bereit || meineNr !== mountNrRef.current) return;
        container.querySelector<HTMLElement>("#t2")?.click();
        const disziplin = aktuelleDisziplinRef.current;
        if (disziplin) {
          (window as unknown as ArenaFenster).__arena?.setDisc?.(disziplin);
          gesetzteDisziplinRef.current = disziplin;
        }
        setMotorBereit(true);
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
    arenaKulisseByDisciplineId,
    arenaStrategieByDisciplineId,
    mutatorenByDisciplineId,
    miniDmFfaTeams,
    miniDmFfaK,
    miniDmFfaSaat,
    miniDmFfaAufstellung,
    battlefieldPodNutzlast,
    bahnPodNutzlast,
    istSpieltag,
  ]);

  // SPIELTAGS-ANSICHT: Disziplinwechsel (D1 -> D2) stellt den LAUFENDEN Motor um, statt ihn neu
  // aufzubauen -- dieselbe Nutzlast traegt Saat, Mutatoren und Pods beider Spieltags-Disziplinen.
  useEffect(() => {
    if (!istSpieltag || !motorBereit || !spieltagDisziplinId) return;
    if (gesetzteDisziplinRef.current === spieltagDisziplinId) return;
    (window as unknown as ArenaFenster).__arena?.setDisc?.(spieltagDisziplinId);
    gesetzteDisziplinRef.current = spieltagDisziplinId;
    setEndeInfo(null);
  }, [istSpieltag, motorBereit, spieltagDisziplinId]);

  // SPIELTAGS-ANSICHT: das Ende des sichtbaren Spiels (`oly-arena:ende`, s. meldeSpielEnde() im
  // Motor) an die Arena melden -- nur fuer die Disziplin, die gerade gezeigt wird.
  useEffect(() => {
    if (!istSpieltag) return;
    const beimEnde = (ereignis: Event) => {
      const info = (ereignis as CustomEvent<{ disziplin?: string; sieger?: 0 | 1 | null }>).detail;
      if (!info?.disziplin || info.disziplin !== aktuelleDisziplinRef.current) return;
      const ende = { disziplin: info.disziplin, sieger: info.sieger === 0 || info.sieger === 1 ? info.sieger : null };
      setEndeInfo(ende);
      onEndeRef.current?.(ende);
    };
    window.addEventListener("oly-arena:ende", beimEnde);
    return () => window.removeEventListener("oly-arena:ende", beimEnde);
  }, [istSpieltag]);

  const starteQuickSim = () => {
    const motor = (window as unknown as ArenaFenster).__arena;
    if (!motor?.schnellDurch || spultVor) return;
    setSpultVor(true);
    void motor
      .schnellDurch()
      .catch((error: unknown) => console.error("[Battle Arena] Quick-Sim fehlgeschlagen", error))
      .finally(() => setSpultVor(false));
  };

  // Reines Verlassen-Aufraeumen: laeuft NUR beim echten Unmount der Komponente (leeres
  // Dependency-Array), nicht bei jedem Team-Wechsel — der raeumt sich selbst auf (s. oben).
  useEffect(() => {
    return () => {
      stoppeLaufendenMotor();
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

  if (spieltag) {
    const heimName = teams.find((team) => team.teamId === heimTeamId)?.name ?? heimTeamId;
    const gastName = teams.find((team) => team.teamId === gastTeamId)?.name ?? gastTeamId;
    const disziplin = spieltag.disciplineId;
    // Die Gruppe im Kopf kommt aus der GEBUCHTEN Gruppe (`spieltag.podTeamIds`, Wertungszeile des eigenen
    // Teams), nicht aus Heim/Gast und nicht aus einer zweiten Pod-Suche -- Chris' D2-Befund 18.11.: der Kopf
    // nannte "N-N vs <D1-Gegner>", die Vorstellung eine dritte Paarung. Erst ohne Buchungsangabe der
    // Nutzlast-Rueckfall wie bisher.
    const bahnPod = bahnPodNutzlast?.[disziplin] ?? null;
    const podTeams = spieltag.podTeamIds?.length
      ? spieltag.podTeamIds.map((id) => teams.find((team) => team.teamId === id)?.name ?? id)
      : disziplin === "mini-dm" && miniDmFfaTeams
        ? miniDmFfaTeams.map((team) => team.name)
        : disziplin === "battlefield" && battlefieldPodNutzlast
          ? battlefieldPodNutzlast.teams.map((team) => team.name)
          : bahnPod
            ? bahnPod.teams.map((team) => team.name)
            : null;
    const eigenesTeamId = spieltag.podTeamId;
    const vorraumArt: "duell" | "pod" = podTeams ? "pod" : "duell";
    const vorraumTeamIds = spieltag.podTeamIds?.length
      ? spieltag.podTeamIds
      : [eigenesTeamId, heimTeamId === eigenesTeamId ? gastTeamId : heimTeamId];
    const vorraumTeams = baueVorraumTeams({
      gameState,
      teamIds: vorraumTeamIds,
      ownTeamId: eigenesTeamId,
      disciplineId: disziplin,
    });
    const kaderFehlt = keinHeimKader || keinGastKader;
    const vorraumPhase: "laden" | "vorstellung" | null = kaderFehlt
      ? null
      : ladeKader || !motorBereit
        ? "laden"
        : !vorstellungErledigt && endeInfo == null
          ? "vorstellung"
          : null;
    const quickSimMitStart = () => {
      setVorstellungErledigt(true);
      starteQuickSim();
    };
    return (
      <>
        <style>{`
          .oly-arena-spieltag-kopf{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 6px}
          .oly-arena-spieltag-kopf h3{margin:0;font-size:1.02rem}
          .oly-arena-spieltag-knopf{min-height:40px;padding:0 16px;border-radius:10px;cursor:pointer;
            border:1px solid var(--nl-accent,#F2A03D);background:color-mix(in srgb,var(--nl-accent,#F2A03D) 16%,transparent);
            color:inherit;font-weight:800;font-size:0.86rem;margin-left:auto}
          .oly-arena-spieltag-knopf[disabled]{opacity:0.55;cursor:progress}
          .oly-arena-spieltag-status{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:8px;
            border:1px dashed rgba(255,255,255,0.16);border-radius:12px;font-size:0.9rem}
          .oly-battle-arena.im-spieltag .tabs,
          .oly-battle-arena.im-spieltag .lede{display:none}
        `}</style>
        <section
          className="panel"
          aria-label="Battle Arena — Spieltag"
          data-testid="oly-arena-spieltag"
          data-disziplin={disziplin}
          data-motor-bereit={String(motorBereit)}
          data-spiel-ende={endeInfo ? String(endeInfo.sieger ?? "offen") : ""}
          style={{ marginBottom: 0 }}
        >
          <div className="oly-arena-spieltag-kopf">
            <h3>
              Battle Arena · {spieltag.disziplinName ?? disziplin}
            </h3>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {podTeams ? (
                <>Vierergruppe: {podTeams.map((name, index) => (
                  <span key={name + index}>{index > 0 ? ", " : ""}<strong>{name}</strong></span>
                ))}</>
              ) : (
                <><strong>{heimName}</strong> gegen <strong>{gastName}</strong></>
              )}
            </span>
            <button
              type="button"
              className="oly-arena-spieltag-knopf"
              data-testid="oly-arena-spieltag-quicksim"
              onClick={quickSimMitStart}
              disabled={!motorBereit || spultVor || endeInfo != null}
              title="Spult das Spiel bis zum Ende vor — derselbe Verlauf wie beim Zuschauen, nur schneller."
            >
              {spultVor ? "⏩ spult vor …" : endeInfo ? "✓ Spiel zu Ende" : "⏩ Quick-Sim"}
            </button>
          </div>
          {ladeKader || !motorBereit ? (
            <div className="oly-arena-spieltag-status muted" role="status">
              <span className="oly-arena-spin" aria-hidden />
              {ladeKader ? "Kader werden geladen …" : "Arena wird aufgebaut …"}
            </div>
          ) : null}
          {keinHeimKader || keinGastKader ? (
            <div className="oly-arena-spieltag-status muted" role="status">
              Ein Team dieses Spiels hat keinen Spieler mit vollständigem Attribut-Bogen.
            </div>
          ) : null}
        </section>
        <style>{`
          .oly-arena-spin{width:14px;height:14px;flex:none;border-radius:50%;
            border:2px solid rgba(255,255,255,0.18);border-top-color:#F2A03D;
            animation:olyArenaDrehen 800ms linear infinite}
          @keyframes olyArenaDrehen{to{transform:rotate(360deg)}}
          @media (prefers-reduced-motion:reduce){.oly-arena-spin{animation:none}}
        `}</style>
        {/* VOLLFLAECHE (Chris 18.11., s. ArenaVollflaecheBuehne): im Arena-Reiter liegt der Motor als
            Buehne ueber dem ganzen Fenster; Titel, Paarung und Quick-Sim wandern in ihre 40-px-Leiste. */}
        <ArenaVollflaecheBuehne
          istSpieltag
          titel={
            spieltag.regie ? (
              <ArenaRegieleiste regie={spieltag.regie} aktuellerTitel={spieltag.disziplinName ?? disziplin} />
            ) : (
              <>Battle Arena · {spieltag.disziplinName ?? disziplin}</>
            )
          }
          paarung={
            spieltag.regie ? undefined : podTeams ? `Vierergruppe: ${podTeams.join(", ")}` : `${heimName} gegen ${gastName}`
          }
          seiteHervorheben={endeInfo != null}
          zusatz={
            <button
              type="button"
              className="ist-akzent"
              data-testid="oly-arena-buehne-quicksim"
              onClick={quickSimMitStart}
              disabled={!motorBereit || spultVor || endeInfo != null}
              title="Spult das Spiel bis zum Ende vor — derselbe Verlauf wie beim Zuschauen, nur schneller."
            >
              {spultVor ? "⏩ spult vor …" : endeInfo ? "✓ Spiel zu Ende" : "⏩ Quick-Sim"}
            </button>
          }
        >
          {vorraumPhase === "laden" ? (
            <ArenaLadebild
              disziplinName={spieltag.disziplinName ?? disziplin}
              disziplinNr={spieltag.disziplinNr ?? 1}
              disziplinAnzahl={spieltag.disziplinAnzahl ?? 1}
              art={vorraumArt}
              teams={vorraumTeams}
              schritte={baueLadeSchritte({
                kaderGeladen: !ladeKader,
                aufstellungDa: gerenderterKader != null,
                motorBereit,
              })}
              ausblick={spieltag.ausblick ?? null}
            />
          ) : vorraumPhase === "vorstellung" ? (
            <ArenaVorstellung
              disziplinName={spieltag.disziplinName ?? disziplin}
              disziplinNr={spieltag.disziplinNr ?? 1}
              disziplinAnzahl={spieltag.disziplinAnzahl ?? 1}
              art={vorraumArt}
              teams={vorraumTeams}
              hinweis={
                vorraumArt === "pod"
                  ? "Deine Vierergruppe dieses Spieltags · gezeigt = gebucht"
                  : "Das ist das gewertete Spiel deines Teams · gezeigt = gebucht"
              }
              onStart={() => setVorstellungErledigt(true)}
              onQuickSim={quickSimMitStart}
              quickSimGesperrt={spultVor}
            />
          ) : null}
          {gerenderterKader ? <div ref={containerRef} style={{ marginTop: 10 }} /> : null}
        </ArenaVollflaecheBuehne>
      </>
    );
  }

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
        {entwurfsGruppeTeamIds &&
        (battlefieldPodNutzlast?.entwurf || Object.values(bahnPodNutzlast ?? {}).some((pod) => pod.entwurf)) ? (
          <p
            className="muted"
            data-testid="oly-arena-entwurf-vierergruppe"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            Takeshi&apos;s Castle, Staffel und Battlefield laufen hier als 4-Team-Format (Punkte 2-1-0-0 nach
            Platz). Steht die Disziplin am aktuellen Spieltag nicht an, ist es eine Entwurfs-Vierergruppe
            aus Heim, Gast und zwei weiteren Teams — nur zum Ansehen, nichts davon wird gebucht:{" "}
            {entwurfsGruppeTeamIds.map((teamId, index) => (
              <span key={teamId}>
                {index > 0 ? ", " : ""}
                <strong>{teams.find((t) => t.teamId === teamId)?.name ?? teamId}</strong>
              </span>
            ))}
            .
          </p>
        ) : null}
        {battlefieldPodNutzlast && !battlefieldPodNutzlast.entwurf ? (
          <p
            className="muted"
            data-testid="oly-arena-battlefield-pod"
            style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
          >
            Battlefield läuft hier als 4-Team-FFA — alle vier Teams der gebuchten Vierergruppe
            {battlefieldPodNutzlast.vorschau
              ? ` von Spieltag ${battlefieldPodNutzlast.vorschau.spieltagNummer} (${
                  battlefieldPodNutzlast.vorschau.art === "vorschau" ? "Vorschau" : "Rückblick"
                }: Battlefield steht heute nicht an${
                  aufstellungNochOffen(battlefieldPodNutzlast) ? "; Aufstellung noch offen" : ""
                })`
              : ""}{" "}
            kämpfen gleichzeitig um die Orte, und gewertet wird genau dieses Gefecht:{" "}
            {battlefieldPodNutzlast.teams.map((team, index) => (
              <span key={team.name + index}>
                {index > 0 ? ", " : ""}
                <strong>{team.name}</strong>
              </span>
            ))}
            .
          </p>
        ) : null}
        {bahnPodNutzlast
          ? Object.entries(bahnPodNutzlast).filter(([, pod]) => !pod.entwurf).map(([disciplineId, pod]) => (
              <p
                key={disciplineId}
                className="muted"
                data-testid={`oly-arena-bahn-pod-${disciplineId}`}
                style={{ margin: "8px 0 0", fontSize: "0.85rem" }}
              >
                {disciplineId === "staffel" ? "Staffel" : "Takeshi's Castle"} läuft hier als 4-Team-Rennen —{" "}
                gezeigt wird die gebuchte Vierergruppe
                {pod.vorschau
                  ? ` von Spieltag ${pod.vorschau.spieltagNummer} (${
                      pod.vorschau.art === "vorschau" ? "Vorschau" : "Rückblick"
                    }: die Disziplin steht heute nicht an${
                      aufstellungNochOffen(pod) ? "; Aufstellung noch offen" : ""
                    })`
                  : ""}{" "}
                (2-1-0-0 nach Platz):{" "}
                {pod.teams.map((team, index) => (
                  <span key={team.name + index}>
                    {index > 0 ? ", " : ""}
                    <strong>{team.name}</strong>
                  </span>
                ))}
                .
              </p>
            ))
          : null}
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
                <strong>{hinweis.disciplineName}</strong> {hinweis.text}
                {hinweis.nurVorschau === false ? "." : " — hier nur Vorschau."}
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
      <ArenaVollflaecheBuehne
        titel="Battle Arena · Test"
        paarung={`${teams.find((team) => team.teamId === heimTeamId)?.name ?? heimTeamId} gegen ${
          teams.find((team) => team.teamId === gastTeamId)?.name ?? gastTeamId
        }`}
      >
        {gerenderterKader ? <div ref={containerRef} style={{ marginTop: 14 }} /> : null}
      </ArenaVollflaecheBuehne>

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
        .oly-arena-live-buttons{position:fixed;right:16px;bottom:16px;z-index:65;display:flex;
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
