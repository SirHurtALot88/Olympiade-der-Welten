"use client";

import FoundationTeamSettingsNewLook from "@/app/foundation/team-settings/FoundationTeamSettingsNewLook";
import type { FoundationTeamSettingsPanelProps } from "@/app/foundation/team-settings/FoundationTeamSettingsPanel";

export type FoundationTeamSettingsHostProps = FoundationTeamSettingsPanelProps;

export default function FoundationTeamSettingsHost(props: FoundationTeamSettingsHostProps) {
  return <FoundationTeamSettingsNewLook {...props} />;
}
