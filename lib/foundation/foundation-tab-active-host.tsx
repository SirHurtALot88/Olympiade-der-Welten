"use client";

import type { ReactNode } from "react";

/**
 * Unmount wrapper for foundation tab hosts (Strangler Phase 5.1).
 * Inactive tabs render `null` so their hooks and JSX leave the tree.
 */
export function FoundationTabActiveHost({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? children : null;
}
