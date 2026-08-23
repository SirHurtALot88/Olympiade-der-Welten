"use client";

import MerklisteClient, { type MerklisteClientProps } from "@/app/foundation/merkliste-v2/MerklisteClient";

export type FoundationMerklisteHostProps = MerklisteClientProps;

export default function FoundationMerklisteHost(props: FoundationMerklisteHostProps) {
  return <MerklisteClient {...props} />;
}
