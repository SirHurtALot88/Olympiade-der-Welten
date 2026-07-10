"use client";

import { Suspense, type ComponentProps, type ReactNode } from "react";

import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import { isFoundationViewActive } from "@/lib/foundation/foundation-view-active";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

type FoundationViewMountProps = {
  activeView: FoundationViewId;
  views: FoundationViewId[];
  className?: string;
  id?: string;
  testId?: string;
  children: ReactNode;
  skeletonLabel?: string;
  skeletonVariant?: ComponentProps<typeof FoundationPanelSkeleton>["variant"];
  suspend?: boolean;
  when?: boolean;
};

export default function FoundationViewMount({
  activeView,
  views,
  className,
  id,
  testId,
  children,
  skeletonLabel,
  skeletonVariant = "default",
  suspend = true,
  when = true,
}: FoundationViewMountProps) {
  if (!when || !isFoundationViewActive(activeView, ...views)) {
    return null;
  }

  const body = suspend ? (
    <Suspense fallback={<FoundationPanelSkeleton variant={skeletonVariant} label={skeletonLabel} />}>{children}</Suspense>
  ) : (
    children
  );

  if (!className && !id && !testId) {
    return body;
  }

  return (
    <section className={className} id={id} data-testid={testId}>
      {body}
    </section>
  );
}
