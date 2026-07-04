"use client";

import { useCallback, useState } from "react";

import type { GameInboxItem, Team } from "@/lib/data/olyDataTypes";
import { FoundationDeferredMount } from "@/lib/foundation/FoundationDeferredMount";
import { FoundationTabActiveHost } from "@/lib/foundation/foundation-tab-active-host";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import FoundationHomeV2Host, { type FoundationHomeV2HostProps } from "@/app/foundation/home-v2/FoundationHomeV2Host";
import FoundationTeamsViewHost, {
  type FoundationTeamsViewHostProps,
} from "@/app/foundation/teams-v2/FoundationTeamsViewHost";
import FoundationTeamsViewPanel from "@/app/foundation/teams-v2/FoundationTeamsViewPanel";
import FoundationCockpitHost, {
  type FoundationCockpitHostProps,
} from "@/app/foundation/cockpit-v2/FoundationCockpitHost";
import FoundationInboxV2Host, {
  type FoundationInboxV2HostProps,
} from "@/app/foundation/inbox-v2/FoundationInboxV2Host";
import FoundationSeasonV2Host, {
  type FoundationSeasonV2HostProps,
} from "@/app/foundation/season-v2/FoundationSeasonV2Host";
import FoundationPrizeFinanceShellHost, {
  type FoundationPrizeFinanceShellHostProps,
} from "@/app/foundation/prize-v2/FoundationPrizeFinanceShellHost";
import FoundationLineupShellHost, {
  type FoundationLineupShellHostProps,
} from "@/app/foundation/legacy-lineup-lab/FoundationLineupShellHost";
import FoundationMarketV2ShellHost, {
  type FoundationMarketV2ShellHostProps,
} from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";
import FoundationMarketBuyShellHost, {
  type FoundationMarketBuyShellHostProps,
} from "@/app/foundation/transfermarkt-v2/FoundationMarketBuyShellHost";
import FoundationMarketSellShellHost, {
  type FoundationMarketSellShellHostProps,
} from "@/app/foundation/transfermarkt-v2/FoundationMarketSellShellHost";
import FoundationMatchdayArenaShellHost, {
  type FoundationMatchdayArenaShellHostProps,
} from "@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaShellHost";
import FoundationMatchdayResultShellHost, {
  type FoundationMatchdayResultShellHostProps,
} from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import FoundationHistoryV2ShellHost, {
  type FoundationHistoryV2ShellHostProps,
} from "@/app/foundation/transfer-history-v2/FoundationHistoryV2ShellHost";
import FoundationSeasonPreviewShellHost, {
  type FoundationSeasonPreviewShellHostProps,
} from "@/app/foundation/season-preview-v2/FoundationSeasonPreviewShellHost";
import FoundationTrainingCompactShellHost, {
  type FoundationTrainingCompactShellHostProps,
} from "@/app/foundation/training-compact/FoundationTrainingCompactShellHost";

export type FoundationWarningInboxItem = {
  id: string;
  title: string;
  detail: string;
  severity: "blocked" | "warning" | "info";
  targetView: string;
  targetTeamId?: string | null;
  targetPanel?: string | null;
  inboxItem?: GameInboxItem;
};

type FoundationShellRouterHomeV2BaseProps = {
  active: boolean;
};

export type FoundationShellRouterHomeV2WarningsProps = FoundationShellRouterHomeV2BaseProps & {
  placement: "warnings";
  warningItems: FoundationWarningInboxItem[];
  onWarningItemClick: (item: FoundationWarningInboxItem) => void;
};

export type FoundationShellRouterHomeV2ContentProps = FoundationShellRouterHomeV2BaseProps & {
  placement: "content";
  hostProps: FoundationHomeV2HostProps;
};

export type FoundationShellRouterHomeV2Props =
  | FoundationShellRouterHomeV2WarningsProps
  | FoundationShellRouterHomeV2ContentProps;

/**
 * Incremental Phase 5.3 shell slice: Home V2 route with unmount gate.
 * `placement="warnings"` renders above `foundation-content`; `placement="content"` renders the tab host.
 */
export function FoundationShellRouterHomeV2(props: FoundationShellRouterHomeV2Props) {
  if (!props.active) {
    return null;
  }

  if (props.placement === "warnings") {
    if (props.warningItems.length === 0) {
      return null;
    }

    return (
      <section className="foundation-warning-inbox" aria-label="Offene Hinweise">
        <div className="foundation-warning-inbox-summary">
          <span className="eyebrow">Hinweise</span>
          <strong>{props.warningItems.length} offen</strong>
        </div>
        <div className="foundation-warning-inbox-list">
          {props.warningItems.map((item) => (
            <button
              key={item.id}
              className={`foundation-warning-inbox-item is-${item.severity}`}
              type="button"
              title={item.detail}
              onClick={() => props.onWarningItemClick(item)}
            >
              <span className={`foundation-warning-dot is-${item.severity}`} aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <FoundationTabActiveHost active={props.active}>
      <FoundationHomeV2Host {...props.hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterTeamsProps = {
  active: boolean;
  selectedTeam: Team | null;
  hostProps: Omit<FoundationTeamsViewHostProps, "selectedTeam">;
};

/**
 * Incremental Phase 5.3 shell slice: Teams route with unmount gate.
 */
function FoundationShellRouterTeamsContent({
  selectedTeam,
  hostProps,
}: {
  selectedTeam: Team;
  hostProps: Omit<FoundationTeamsViewHostProps, "selectedTeam">;
}) {
  const [hostMounted, setHostMounted] = useState(false);
  const handleHostMounted = useCallback(() => {
    setHostMounted(true);
  }, []);

  return (
    <>
      {!hostMounted ? (
        <FoundationTeamsViewPanel active teamTab={hostProps.selectedTeamDetailTab}>
          <FoundationPanelSkeleton variant="default" label="Teams werden geladen…" />
        </FoundationTeamsViewPanel>
      ) : null}
      <FoundationDeferredMount onMounted={handleHostMounted}>
        <FoundationTeamsViewHost {...hostProps} selectedTeam={selectedTeam} />
      </FoundationDeferredMount>
    </>
  );
}

export function FoundationShellRouterTeams({ active, selectedTeam, hostProps }: FoundationShellRouterTeamsProps) {
  if (!active || !selectedTeam) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationShellRouterTeamsContent selectedTeam={selectedTeam} hostProps={hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterCockpitProps = {
  active: boolean;
  hostProps: FoundationCockpitHostProps;
};

/**
 * Shell-first slice: Cockpit route with unmount gate. Renders a lightweight
 * skeleton immediately, then defers the heavy status/derivation host by a
 * frame (same pattern as the Teams shell-first fix).
 */
function FoundationShellRouterCockpitContent({ hostProps }: { hostProps: FoundationCockpitHostProps }) {
  const [hostMounted, setHostMounted] = useState(false);
  const handleHostMounted = useCallback(() => {
    setHostMounted(true);
  }, []);

  return (
    <>
      {!hostMounted ? (
        <section className="panel" id="foundation-cockpit" data-testid="foundation-cockpit">
          <FoundationPanelSkeleton variant="default" label="Cockpit wird geladen…" />
        </section>
      ) : null}
      <FoundationDeferredMount onMounted={handleHostMounted}>
        <FoundationCockpitHost {...hostProps} />
      </FoundationDeferredMount>
    </>
  );
}

export function FoundationShellRouterCockpit({ active, hostProps }: FoundationShellRouterCockpitProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationShellRouterCockpitContent hostProps={hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterInboxV2Props = {
  active: boolean;
  hostProps: FoundationInboxV2HostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Inbox V2 route with unmount gate.
 */
export function FoundationShellRouterInboxV2({ active, hostProps }: FoundationShellRouterInboxV2Props) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationInboxV2Host {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterSeasonV2Props = {
  active: boolean;
  hostProps: FoundationSeasonV2HostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Season V2 route with unmount gate.
 */
export function FoundationShellRouterSeasonV2({ active, hostProps }: FoundationShellRouterSeasonV2Props) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationSeasonV2Host {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterPrizeProps = {
  active: boolean;
  hostProps: FoundationPrizeFinanceShellHostProps;
};

/**
 * Shell-first slice: Prize route with unmount gate. Renders a lightweight
 * skeleton immediately, then defers the heavy prize/sponsor derivation host
 * by a frame (same pattern as the Cockpit shell-first fix).
 */
function FoundationShellRouterPrizeContent({ hostProps }: { hostProps: FoundationPrizeFinanceShellHostProps }) {
  const [hostMounted, setHostMounted] = useState(false);
  const handleHostMounted = useCallback(() => {
    setHostMounted(true);
  }, []);

  return (
    <>
      {!hostMounted ? (
        <section className="panel" id="foundation-prize" data-testid="foundation-prize">
          <FoundationPanelSkeleton variant="default" label="Sponsoren & Preisgeld werden geladen…" />
        </section>
      ) : null}
      <FoundationDeferredMount onMounted={handleHostMounted}>
        <FoundationPrizeFinanceShellHost {...hostProps} />
      </FoundationDeferredMount>
    </>
  );
}

export function FoundationShellRouterPrize({ active, hostProps }: FoundationShellRouterPrizeProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationShellRouterPrizeContent hostProps={hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterLineupProps = {
  active: boolean;
  hostProps: FoundationLineupShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Lineup route with unmount gate.
 */
export function FoundationShellRouterLineup({ active, hostProps }: FoundationShellRouterLineupProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationLineupShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterTrainingProps = {
  active: boolean;
  selectedTeam: Team | null;
  hostProps: Omit<FoundationTrainingCompactShellHostProps, "selectedTeam">;
};

/**
 * Shell-first slice: Training-compact route with unmount gate (Foundation
 * Perf Phase 3). Renders a lightweight skeleton immediately, then defers the
 * heavy whole-roster forecast host by a frame (same pattern as the
 * Cockpit/Prize shell-first fixes).
 */
function FoundationShellRouterTrainingContent({
  selectedTeam,
  hostProps,
}: {
  selectedTeam: Team;
  hostProps: Omit<FoundationTrainingCompactShellHostProps, "selectedTeam">;
}) {
  const [hostMounted, setHostMounted] = useState(false);
  const handleHostMounted = useCallback(() => {
    setHostMounted(true);
  }, []);

  return (
    <>
      {!hostMounted ? (
        <section
          className="panel foundation-training-compact-panel"
          id="foundation-training-compact"
          data-testid="foundation-training-compact"
        >
          <FoundationPanelSkeleton variant="default" label="Training wird geladen…" />
        </section>
      ) : null}
      <FoundationDeferredMount onMounted={handleHostMounted}>
        <FoundationTrainingCompactShellHost {...hostProps} selectedTeam={selectedTeam} />
      </FoundationDeferredMount>
    </>
  );
}

export function FoundationShellRouterTraining({ active, selectedTeam, hostProps }: FoundationShellRouterTrainingProps) {
  if (!active || !selectedTeam) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationShellRouterTrainingContent selectedTeam={selectedTeam} hostProps={hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterMarketV2Props = {
  active: boolean;
  hostProps: FoundationMarketV2ShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Market V2 route with unmount gate.
 */
export function FoundationShellRouterMarketV2({ active, hostProps }: FoundationShellRouterMarketV2Props) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationMarketV2ShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterMatchdayArenaProps = {
  active: boolean;
  hostProps: FoundationMatchdayArenaShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Matchday Arena route with unmount gate.
 */
export function FoundationShellRouterMatchdayArena({ active, hostProps }: FoundationShellRouterMatchdayArenaProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationMatchdayArenaShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterMatchdayResultProps = {
  active: boolean;
  hostProps: FoundationMatchdayResultShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Matchday Result route with unmount gate.
 */
export function FoundationShellRouterMatchdayResult({ active, hostProps }: FoundationShellRouterMatchdayResultProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationMatchdayResultShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterHistoryV2Props = {
  active: boolean;
  hostProps: FoundationHistoryV2ShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Transfer history route with unmount gate.
 */
export function FoundationShellRouterHistoryV2({ active, hostProps }: FoundationShellRouterHistoryV2Props) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationHistoryV2ShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterSeasonPreviewProps = {
  active: boolean;
  hostProps: FoundationSeasonPreviewShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Season preview route with unmount gate.
 */
export function FoundationShellRouterSeasonPreview({ active, hostProps }: FoundationShellRouterSeasonPreviewProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationSeasonPreviewShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterMarketSellProps = {
  active: boolean;
  hostProps: FoundationMarketSellShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Market sell drilldown with unmount gate.
 */
export function FoundationShellRouterMarketSell({ active, hostProps }: FoundationShellRouterMarketSellProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationMarketSellShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}

export type FoundationShellRouterMarketBuyProps = {
  active: boolean;
  hostProps: FoundationMarketBuyShellHostProps;
};

/**
 * Incremental Phase 5.3 shell slice: Market buy/offer drilldown with unmount gate.
 */
export function FoundationShellRouterMarketBuy({ active, hostProps }: FoundationShellRouterMarketBuyProps) {
  if (!active) {
    return null;
  }

  return (
    <FoundationTabActiveHost active={active}>
      <FoundationMarketBuyShellHost {...hostProps} />
    </FoundationTabActiveHost>
  );
}
