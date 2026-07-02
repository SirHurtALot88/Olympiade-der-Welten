"use client";

import { useEffect, useState, type ComponentProps } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { withPortraitLoadBudget } from "@/lib/foundation/portrait-load-budget";

type BudgetedMediaImageProps = Omit<ComponentProps<typeof OptimizedMediaImage>, "src"> & {
  src: string | null | undefined;
};

export default function BudgetedMediaImage({ src, ...props }: BudgetedMediaImageProps) {
  const [allowedSrc, setAllowedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setAllowedSrc(null);
      return;
    }

    let cancelled = false;
    void withPortraitLoadBudget(() => {
      if (cancelled) {
        return;
      }
      setAllowedSrc(src);
    });

    return () => {
      cancelled = true;
      setAllowedSrc(null);
    };
  }, [src]);

  return <OptimizedMediaImage {...props} src={allowedSrc} />;
}
