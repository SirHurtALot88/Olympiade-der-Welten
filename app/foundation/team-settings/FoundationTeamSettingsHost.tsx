"use client";

import FoundationTeamSettingsPanel, {
  type FoundationTeamSettingsPanelProps,
} from "@/app/foundation/team-settings/FoundationTeamSettingsPanel";

export type FoundationTeamSettingsHostProps = FoundationTeamSettingsPanelProps;

export default function FoundationTeamSettingsHost(props: FoundationTeamSettingsHostProps) {
  return <FoundationTeamSettingsPanel {...props} />;
}
