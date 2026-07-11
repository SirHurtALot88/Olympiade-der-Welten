"use client";

import FoundationTeamSettingsNewLook from "@/app/foundation/team-settings/FoundationTeamSettingsNewLook";
import FoundationTeamSettingsPanel, {
  type FoundationTeamSettingsPanelProps,
} from "@/app/foundation/team-settings/FoundationTeamSettingsPanel";
import { useNewLook } from "@/lib/ui/new-look-preference";

export type FoundationTeamSettingsHostProps = FoundationTeamSettingsPanelProps;

export default function FoundationTeamSettingsHost(props: FoundationTeamSettingsHostProps) {
  // "Neuer Look" (flag-gated, additiv): mit aktivem Runtime-Flag rendert der
  // Tab die NewLook-Variante — ohne Flag bleibt das bestehende Panel unverändert.
  const [newLook] = useNewLook();

  if (newLook) {
    return <FoundationTeamSettingsNewLook {...props} />;
  }

  return <FoundationTeamSettingsPanel {...props} />;
}
