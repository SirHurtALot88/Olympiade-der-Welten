"use client";

import { FoundationShellRouterBody } from "@/app/foundation/FoundationShellRouterBody";
import type { FoundationPageClientProps } from "@/lib/foundation/tabs/foundation-page-types";
import { useFoundationShellRouterBodyScope } from "@/lib/foundation/tabs/use-foundation-shell-router-body-scope";

export {
  setFoundationView,
  syncFoundationViewInUrl,
} from "@/app/foundation/foundation-page-client-exports";

export type {
  DisciplineCategoryFilter,
  FacilityId,
  FoundationView,
  FoundationViewId,
  GameFlowView,
  NewGamePresetId,
  PlayerProfileTabId,
  PlayerTableScope,
  SpecialistWingVariant,
  TeamControlFilter,
  TeamStrategyProfile,
} from "@/app/foundation/foundation-page-client-exports";

export default function FoundationPageClient(props: FoundationPageClientProps) {
  const foundationShellRouterBodyProps = useFoundationShellRouterBodyScope(props);
  return <FoundationShellRouterBody {...foundationShellRouterBodyProps} />;
}
