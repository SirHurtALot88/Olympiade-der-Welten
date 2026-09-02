"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import FoundationBattleArenaSpriteGallery from "@/app/foundation/battle-arena/FoundationBattleArenaSpriteGallery";
import {
  buildArenaTeam,
  listeArenaTeams,
} from "@/lib/foundation/battle-arena/arena-kader-adapter";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellungBeide } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

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
    const teamIds = [...new Set([heimTeamId, gastTeamId].filter(Boolean))];
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
  }, [saveId, heimTeamId, gastTeamId, activeManagerTeamId]);

  const heimKader = useMemo(
    () => buildArenaTeam(gameState, heimTeamId, sheetsByPlayerId),
    [gameState, heimTeamId, sheetsByPlayerId],
  );
  const gastKader = useMemo(
    () => buildArenaTeam(gameState, gastTeamId, sheetsByPlayerId),
    [gameState, gastTeamId, sheetsByPlayerId],
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
  }, [gerenderterKader, huelle, teams, gameState]);

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
    </>
  );
}
