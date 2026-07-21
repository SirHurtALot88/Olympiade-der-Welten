"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { acquirePortraitLoadSlot } from "@/lib/foundation/portrait-load-budget";

type BudgetedMediaImageProps = Omit<ComponentProps<typeof OptimizedMediaImage>, "src"> & {
  src: string | null | undefined;
  /** Skip viewport wait — use for above-the-fold hero portraits. */
  eager?: boolean;
};

export default function BudgetedMediaImage({ src, eager = false, ...props }: BudgetedMediaImageProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [isVisible, setIsVisible] = useState(eager);
  const [allowedSrc, setAllowedSrc] = useState<string | null>(null);
  // Der reservierte Ladeslot wird erst freigegeben, wenn das Bild wirklich
  // fertig ist (onSettled) — oder beim Aufräumen, falls das Bild vorher
  // verschwindet. release() ist idempotent.
  const releaseRef = useRef<(() => void) | null>(null);

  const releaseSlot = useCallback(() => {
    if (releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
  }, []);

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
      releaseSlot();
      setAllowedSrc(null);
      return;
    }

    let cancelled = false;
    void acquirePortraitLoadSlot().then((release) => {
      if (cancelled) {
        // Vor dem Slot-Erhalt abgebrochen → Slot sofort wieder freigeben.
        release();
        return;
      }
      releaseRef.current = release;
      setAllowedSrc(src);
    });

    return () => {
      cancelled = true;
      // Slot freigeben, falls das Bild noch nicht fertig geladen war.
      releaseSlot();
      setAllowedSrc(null);
    };
  }, [isVisible, src, releaseSlot]);

  return (
    <span ref={containerRef} className="budgeted-media-image-anchor">
      <OptimizedMediaImage {...props} src={allowedSrc} onSettled={releaseSlot} />
    </span>
  );
}
