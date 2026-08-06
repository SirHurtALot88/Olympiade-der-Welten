"use client";

import { FoundationShellRouterBody } from "@/app/foundation/FoundationShellRouterBody";
import { FoundationStateProvider } from "@/lib/foundation/foundation-state-context";
import type { FoundationPageClientProps } from "@/lib/foundation/tabs/foundation-page-types";
import { useFoundationShellRouterBodyScope } from "@/lib/foundation/tabs/use-foundation-shell-router-body-scope";
import { useFoundationStateContextValue } from "@/lib/foundation/tabs/use-foundation-state-context-value";

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
  // Verdrahtet den bislang nirgends gemounteten `FoundationStateProvider` UM
  // `FoundationShellRouterBody` herum (nicht darin) — laut Split-Plan die
  // richtige Stelle: der Provider braucht denselben Root-State, den der Body
  // ohnehin schon als Props bekommt (`foundationShellRouterBodyProps` ist
  // `Record<string, any>`, deshalb hier die enge Typisierung über den
  // dedizierten Value-Builder). Ohne diesen Provider lieferte
  // `useFoundationStateOptional()` in tiefer liegenden, ausserhalb des Bodys
  // gerenderten Komponenten (Spieler-/Team-Profil) dauerhaft `null` — mehrere
  // Stellen tragen deshalb eigene Prop-Fallbacks, siehe die Kommentare in
  // `PlayerDetailDrawer.tsx`, `PlayerHeroNewLook.tsx` und `TeamProfileNewLook.tsx`.
  const foundationStateContextValue = useFoundationStateContextValue({
    gameState: foundationShellRouterBodyProps.gameState,
    setGameState: foundationShellRouterBodyProps.setGameState,
    activeSaveId: foundationShellRouterBodyProps.activeSaveId,
    activeSaveName: foundationShellRouterBodyProps.activeSaveName,
    foundationSaveMode: foundationShellRouterBodyProps.foundationSaveMode,
    readMeta: foundationShellRouterBodyProps.readMeta,
    selectedTeamId: foundationShellRouterBodyProps.selectedTeamId,
    activeManagerTeamId: foundationShellRouterBodyProps.activeManagerTeamId,
    isFoundationBootstrapState: foundationShellRouterBodyProps.isFoundationBootstrapState,
    foundationManageableTeamIds: foundationShellRouterBodyProps.foundationManageableTeamIds,
    loadSave: foundationShellRouterBodyProps.loadSave,
    reloadLiveSeasonState: foundationShellRouterBodyProps.reloadLiveSeasonState,
  });
  return (
    <FoundationStateProvider value={foundationStateContextValue}>
      <FoundationShellRouterBody {...foundationShellRouterBodyProps} />
    </FoundationStateProvider>
  );
}
