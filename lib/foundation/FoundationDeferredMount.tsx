"use client";

import { useEffect, useState, type ReactNode } from "react";

type FoundationDeferredMountProps = {
  children: ReactNode;
  onMounted?: () => void;
};

/**
 * Defers child mount until after the next animation frame so shell markers
 * (e.g. audit ready selectors) can paint before heavy tab derivations run.
 */
export function FoundationDeferredMount({ children, onMounted }: FoundationDeferredMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setMounted(true);
      onMounted?.();
    });
    return () => cancelAnimationFrame(frameId);
  }, [onMounted]);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
