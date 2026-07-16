"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { withPortraitLoadBudget } from "@/lib/foundation/portrait-load-budget";

type BudgetedMediaImageProps = Omit<ComponentProps<typeof OptimizedMediaImage>, "src"> & {
  src: string | null | undefined;
  /** Skip viewport wait — use for above-the-fold hero portraits. */
  eager?: boolean;
};

export default function BudgetedMediaImage({ src, eager = false, ...props }: BudgetedMediaImageProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(eager);
  const [allowedSrc, setAllowedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setIsVisible(false);
      return;
    }
    if (eager) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, src]);

  useEffect(() => {
    if (!src || !isVisible) {
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
  }, [isVisible, src]);

  return (
    <span ref={containerRef} className="budgeted-media-image-anchor">
      <OptimizedMediaImage {...props} src={allowedSrc} />
    </span>
  );
}
