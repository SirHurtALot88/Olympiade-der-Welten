"use client";

import type { ReactNode } from "react";

export default function DraftWorkspace({ children }: { children: ReactNode }) {
  return <div className="legacy-lineup-draft-workspace">{children}</div>;
}
