import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { PlayerDirectorySliceResponse } from "@/lib/foundation/player-directory-slice";
import type { SeasonRatingsSliceResponse } from "@/lib/foundation/season-ratings-slice";
import type { TeamOverviewSliceResponse } from "@/lib/foundation/team-overview-slice";
import { seedPlayerDirectorySliceCache } from "@/lib/foundation/use-player-directory-slice";
import { seedSeasonRatingsSliceCache } from "@/lib/foundation/use-season-ratings-slice";
import { seedSeasonStandingsOverviewCache } from "@/lib/foundation/use-season-standings-overview";
import { seedTeamOverviewSliceCache } from "@/lib/foundation/use-team-overview-slice";
import { fetchSeasonSliceJson } from "@/lib/foundation/season-slice-http";
import {
  buildMatchdayArenaBaseSessionKey,
  getMatchdayArenaBaseBundle,
  setMatchdayArenaBaseBundle,
} from "@/lib/foundation/matchday-arena-session-cache";

const panelPrefetchByView: Partial<Record<FoundationViewId, () => Promise<unknown>>> = {
  homeV2: () => import("@/app/foundation/home-v2/FoundationHomeV2Panel"),
  teams: () => import("@/app/foundation/teams-v2/FoundationTeamsDetailPanel"),
  players: () => import("@/app/foundation/players-table/FoundationPlayersTablePanel"),
  marketV2: () => import("@/app/foundation/transfermarkt-v2/FoundationTransfermarktV2Panel"),
  lineup: () => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"),
  lineupV2: () => import("@/app/foundation/legacy-lineup-lab/FoundationLineupPanel"),
  matchdayArena: () => import("@/app/foundation/discipline-stage/FoundationDisciplineStageHost"),
  seasonV2: () => import("@/app/foundation/season-v2/FoundationSeasonV2Panel"),
  trainingCompact: () => import("@/app/foundation/training-compact/TrainingCompactClient"),
  trainingV2: () => import("@/app/foundation/facilities-v2/FacilitiesV2Client"),
  facilitiesOverviewV2: () => import("@/app/foundation/facilities-overview-v2/FacilitiesOverviewV2Client"),
  scoutingCenterV2: () => import("@/app/foundation/scouting-center-v2/ScoutingCenterV2Client"),
  inboxV2: () => import("@/app/foundation/inbox-v2/InboxV2Client"),
  historyV2: () => import("@/app/foundation/transfer-history-v2/TransferHistoryV2Client"),
};

const prefetchedViews = new Set<FoundationViewId>();
let marketBrowseIndexPrefetchScheduled = false;
const prefetchedSeasonStandingsKeys = new Set<string>();
const prefetchedPlayerDirectoryKeys = new Set<string>();
const prefetchedMatchdayArenaBaseKeys = new Set<string>();
// Bug bug-2026-08-04T15-59-37-826Z-2tlf67: Portrait-/Logo-Bilder fuer Hover-Karten
// und den Drawer der Disziplin-Buehne. `Session` = disziplinweit (ein Eintrag pro
// laufender Disziplin), `Urls` zusaetzlich URL-genau, damit ein Spieler, der in
// Etappe 1 UND 2 vorkommt, kein zweites Mal angestossen wird.
const prefetchedDisciplineMediaSessionKeys = new Set<string>();
const prefetchedDisciplineMediaUrls = new Set<string>();

export function clearPrefetchedMatchdayArenaBaseKeys(input?: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
}) {
  if (!input?.saveId && !input?.seasonId && !input?.matchdayId) {
    prefetchedMatchdayArenaBaseKeys.clear();
    return;
  }

  for (const key of prefetchedMatchdayArenaBaseKeys) {
    if (input.saveId && !key.startsWith(`${input.saveId}:`)) {
      continue;
    }
    if (input.seasonId && !key.includes(`:${input.seasonId}:`)) {
      continue;
    }
    if (input.matchdayId && !key.includes(`:${input.matchdayId}:`)) {
      continue;
    }
    prefetchedMatchdayArenaBaseKeys.delete(key);
  }
}

function scheduleIdleTask(task: () => void) {
  if (typeof globalThis !== "undefined" && "requestIdleCallback" in globalThis) {
    globalThis.requestIdleCallback(() => task(), { timeout: 4000 });
    return;
  }
  globalThis.setTimeout(task, 250);
}

export function prefetchFoundationPanel(view: FoundationViewId) {
  const loader = panelPrefetchByView[view];
  if (!loader || prefetchedViews.has(view)) {
    return;
  }
  prefetchedViews.add(view);
  void loader();
  if (view === "seasonV2") {
    // Panel chunk only; API warmup happens via prefetchSeasonStandingsData after save load.
  }
}

export function prefetchFoundationMarketBrowseIndex(saveId?: string) {
  if (marketBrowseIndexPrefetchScheduled || !saveId) {
    return;
  }
  marketBrowseIndexPrefetchScheduled = true;
  scheduleIdleTask(() => {
    const params = new URLSearchParams({
      saveId,
      source: "sqlite",
      limit: "1",
      offset: "0",
    });
    void fetch(`/api/transfermarkt/free-agents?${params.toString()}`, { cache: "no-store" }).catch(() => undefined);
  });
}

export function prefetchSeasonStandingsData(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  source?: "sqlite" | "prisma";
}) {
  if (!input.saveId || input.seasonId === "loading") {
    return;
  }

  const cacheKey = `${input.saveId}:${input.seasonId}:${input.contentSignature}:${input.source ?? "sqlite"}`;
  if (prefetchedSeasonStandingsKeys.has(cacheKey)) {
    return;
  }
  prefetchedSeasonStandingsKeys.add(cacheKey);

  scheduleIdleTask(() => {
    const overviewParams = new URLSearchParams({
      saveId: input.saveId,
      seasonId: input.seasonId,
      source: input.source ?? "sqlite",
      contentSignature: input.contentSignature,
    });
    const sliceParams = new URLSearchParams({
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
    });
    const snapshotParams = new URLSearchParams({ saveId: input.saveId });

    void Promise.all([
      fetchSeasonSliceJson({
        cacheKey: `${input.saveId}:${input.seasonId}:${input.contentSignature}:${input.source ?? "sqlite"}`,
        url: `/api/season/standings-overview?${overviewParams.toString()}`,
        contentSignature: input.contentSignature,
      })
        .then((result) => {
          seedSeasonStandingsOverviewCache(
            {
              saveId: input.saveId,
              seasonId: input.seasonId,
              contentSignature: input.contentSignature,
              source: input.source,
            },
            result.payload as Parameters<typeof seedSeasonStandingsOverviewCache>[1],
          );
        })
        .catch(() => undefined),
      fetchSeasonSliceJson({
        cacheKey: `${input.saveId}:${input.seasonId}:${input.contentSignature}`,
        url: `/api/season/team-overview-slice?${sliceParams.toString()}`,
        contentSignature: input.contentSignature,
      })
        .then(async (result) => {
          const body = result.payload as TeamOverviewSliceResponse;
          if (Array.isArray(body.rows)) {
            seedTeamOverviewSliceCache(
              {
                saveId: input.saveId,
                seasonId: input.seasonId,
                contentSignature: input.contentSignature,
              },
              body,
            );
          }
        })
        .catch(() => undefined),
      fetch(`/api/season/snapshots?${snapshotParams.toString()}`, { cache: "no-store" }).catch(() => undefined),
      fetchSeasonSliceJson({
        cacheKey: `${input.saveId}:${input.seasonId}:${input.contentSignature}:sqlite:`,
        url: `/api/season/ratings-slice?${sliceParams.toString()}&source=${encodeURIComponent(input.source ?? "sqlite")}`,
        contentSignature: input.contentSignature,
      })
        .then(async (result) => {
          const body = result.payload as SeasonRatingsSliceResponse;
          if (body.scope?.saveId && body.scope.seasonId && body.scope.contentSignature) {
            seedSeasonRatingsSliceCache(
              {
                saveId: body.scope.saveId,
                seasonId: body.scope.seasonId,
                contentSignature: body.scope.contentSignature,
                source: input.source ?? "sqlite",
                playerIdsKey: "",
              },
              body,
            );
          }
        })
        .catch(() => undefined),
    ]);
  });
}

export function prefetchPlayerDirectoryData(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
}) {
  if (!input.saveId || input.seasonId === "loading") {
    return;
  }

  const cacheKey = `${input.saveId}:${input.seasonId}:${input.contentSignature}`;
  if (prefetchedPlayerDirectoryKeys.has(cacheKey)) {
    return;
  }
  prefetchedPlayerDirectoryKeys.add(cacheKey);

  scheduleIdleTask(() => {
    const params = new URLSearchParams({
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
    });
    void fetch(`/api/season/player-directory-slice?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const body = (await response.json()) as PlayerDirectorySliceResponse;
        if (body.scope?.saveId && body.scope.seasonId && body.scope.contentSignature) {
          seedPlayerDirectorySliceCache(
            {
              saveId: body.scope.saveId,
              seasonId: body.scope.seasonId,
              contentSignature: body.scope.contentSignature,
            },
            body,
          );
        }
      })
      .catch(() => undefined);
  });
}

export function prefetchMatchdayArenaBase(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  source?: "sqlite" | "prisma";
  /**
   * `true` holt das VOLLE Bundle inkl. `resolvePreview`/`standingsPreview` — genau das, was die Arena
   * beim Öffnen braucht. Für den beiläufigen Hintergrund-Prefetch bleibt es aus (Light-Bundle, billiger).
   * Der Session-Key unterscheidet beide Varianten, ein Light-Treffer kann die Arena also nicht belegen.
   */
  includeDetails?: boolean;
  /**
   * Stand der Aufstellungen (siehe `buildMatchdayLineupRevision`). Geht in den Session-Key ein,
   * damit ein vorgeholtes Bundle eine spaetere Aenderung an den Aufstellungen nicht ueberlebt.
   */
  lineupRevision?: string;
  /**
   * Sofort statt im Idle-Slot laden — für den Lineup→Arena-Übergang, wo die Zeit knapp ist.
   * Nur dann wird ein Promise zurückgegeben, auf das der Aufrufer warten kann.
   */
  immediate?: boolean;
}): Promise<void> | undefined {
  if (!input.saveId || !input.seasonId || !input.matchdayId || !input.teamId) {
    return;
  }
  if (input.seasonId === "loading" || input.saveId === "loading-save") {
    return;
  }

  const source = input.source ?? "sqlite";
  const includeDetails = input.includeDetails === true;
  const sessionKey = buildMatchdayArenaBaseSessionKey({
    saveId: input.saveId,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
    source,
    includeDetails,
    lineupRevision: input.lineupRevision,
  });
  if (prefetchedMatchdayArenaBaseKeys.has(sessionKey) || getMatchdayArenaBaseBundle(sessionKey)) {
    return;
  }
  prefetchedMatchdayArenaBaseKeys.add(sessionKey);

  const run = (): Promise<void> => {
    const params = new URLSearchParams({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId: input.teamId,
      source,
      includeDetails: includeDetails ? "1" : "0",
    });
    return fetch(`/api/matchday/arena-base?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          // Fehlgeschlagenen Versuch nicht als "erledigt" stehen lassen, sonst blockiert der
          // Merker jeden weiteren Prefetch für diesen Schlüssel in dieser Session.
          prefetchedMatchdayArenaBaseKeys.delete(sessionKey);
          return;
        }
        const payload = await response.json();
        if (payload?.context) {
          setMatchdayArenaBaseBundle(sessionKey, payload);
        }
      })
      .catch(() => {
        prefetchedMatchdayArenaBaseKeys.delete(sessionKey);
      });
  };

  if (input.immediate) {
    return run();
  }
  scheduleIdleTask(run);
  return undefined;
}

/**
 * Laedt Spieler-Portraits + Team-Logos im Idle-Slot vor, WAEHREND eine Disziplin
 * laeuft — gemeldet in bug-2026-08-04T15-59-37-826Z-2tlf67: Hover-Karten und der
 * Drawer der Disziplin-Buehne mussten beim Oeffnen erst nachladen, obwohl waehrend
 * des Reveals reichlich Leerlaufzeit da ist.
 *
 * WICHTIG: `urls` muss exakt das liefern, was `getPlayerPortraitBrowserUrl` /
 * `getTeamLogoBrowserUrl` beim echten Rendern der Karten auch liefern (der
 * Aufrufer baut die URLs, diese Funktion generiert keine eigenen) — nur bei
 * identischer URL trifft der Browser-Cache. Die Medien-Route setzt ohnehin schon
 * `Cache-Control: public, max-age=3600` + ETag (siehe lib/media/serveMediaAsset.ts),
 * das Vorladen verschiebt also nur den ZEITPUNKT des ohnehin faelligen Downloads
 * nach vorne, es lädt nichts zusätzlich, was der Drawer nicht sowieso holen würde.
 *
 * Begrenzt von Natur aus: der Aufrufer übergibt nur die Bilder der Teams/Spieler,
 * die in DIESER Disziplin tatsächlich antreten (max. 32 Teams × Disziplin-
 * Slotzahl, siehe PRIM_GEO/NATIVE_PRIMITIVE-Kommentare) — kein Vorladen des
 * gesamten Spielerkaders.
 *
 * `sessionKey` (z. B. `${saveId}:${matchdayId}:${disciplineId}`) sorgt dafür, dass
 * ein Re-Render (Reveal-Tick, Hover, Score-Update) die Liste nicht erneut anstößt;
 * `prefetchedDisciplineMediaUrls` verhindert zusätzlich doppelte Downloads über
 * mehrere Disziplinen hinweg (derselbe Spieler tritt oft in D1 UND D2 an).
 */
export function prefetchDisciplineStageMedia(input: {
  sessionKey: string;
  urls: (string | null | undefined)[];
}) {
  if (!input.sessionKey || prefetchedDisciplineMediaSessionKeys.has(input.sessionKey)) {
    return;
  }
  prefetchedDisciplineMediaSessionKeys.add(input.sessionKey);

  const freshUrls = Array.from(
    new Set(input.urls.filter((url): url is string => url != null && url !== "" && !prefetchedDisciplineMediaUrls.has(url))),
  );
  if (freshUrls.length === 0) {
    return;
  }
  for (const url of freshUrls) {
    prefetchedDisciplineMediaUrls.add(url);
  }

  // Idle statt sofort: der Reveal (rAF-Glide/FX) soll keine einzige Frame verlieren,
  // weil nebenbei 100+ Bild-Downloads angestossen werden.
  scheduleIdleTask(() => {
    if (typeof Image === "undefined") {
      return;
    }
    for (const url of freshUrls) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  });
}

export function prefetchFoundationDefaultPanels(saveId?: string) {
  prefetchFoundationPanel("homeV2");
  prefetchFoundationPanel("teams");
  prefetchFoundationPanel("players");
  prefetchFoundationPanel("lineup");
  prefetchFoundationPanel("seasonV2");
  prefetchFoundationPanel("trainingCompact");
  prefetchFoundationPanel("trainingV2");
  prefetchFoundationPanel("marketV2");
  prefetchFoundationMarketBrowseIndex(saveId);
}
