import type { FoundationShellRouterBodyProps } from "@/app/foundation/foundation-shell-router-body-props";

/**
 * Legacy-Panel entfernt: Die Team-Einstellungen werden ausschließlich von
 * `FoundationTeamSettingsNewLook` gerendert (siehe `FoundationTeamSettingsHost`). Die
 * frühere `FoundationTeamSettingsPanel`-Komponente war toter Code — nur noch dieser
 * Props-Vertrag wird von NewLook/Host weiterverwendet.
 */
export type FoundationTeamSettingsPanelProps = FoundationShellRouterBodyProps;
