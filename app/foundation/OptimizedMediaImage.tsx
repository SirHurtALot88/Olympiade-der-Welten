"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type OptimizedMediaImageProps = {
  src: string | null | undefined;
  placeholderSrc?: string | null;
  alt: string;
  className: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  fallback?: ReactNode;
  /**
   * Sauberes Kürzel (Kurzcode/Initialen) für den Platzhalter, wenn Quelle fehlt
   * oder das Bild 404t. Ohne diesen Wert werden Initialen aus `alt` abgeleitet.
   */
  fallbackLabel?: string;
  onErrorClassName?: string;
  /**
   * Feuert genau einmal pro `src`, sobald das Bild fertig geladen ODER
   * gescheitert ist. Wird von `BudgetedMediaImage` genutzt, um den Ladeslot
   * erst nach der echten Netzwerkarbeit freizugeben.
   */
  onSettled?: () => void;
};

/**
 * Leitet ein sauberes Kürzel aus dem Alt-Text ab (z. B. "Armageddon Aftermath
 * Logo" → "AA"). Angehängte Rollen-Wörter (Logo/Wappen/Crest/Porträt …) werden
 * entfernt, damit der Platzhalter nie den Roh-Alt-Text zeigt.
 */
function deriveInitialsFromAlt(alt: string): string {
  const cleaned = alt
    .replace(/\b(Logo|Wappen|Crest|Platzhalter|Portrait|Porträt|Foto|Bild)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function OptimizedMediaImage({
  src,
  placeholderSrc,
  alt,
  className,
  width,
  height,
  style,
  loading = "lazy",
  fetchPriority = "low",
  fallback = null,
  fallbackLabel,
  onErrorClassName,
  onSettled,
}: OptimizedMediaImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Merkt sich die bereits "abgeschlossene" Quelle, damit onSettled je src
  // genau einmal feuert — race-frei ohne Reset-Effekt.
  const settledSrcRef = useRef<string | null | undefined>(undefined);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const settle = () => {
    if (settledSrcRef.current === src) {
      return;
    }
    settledSrcRef.current = src;
    onSettledRef.current?.();
  };

  // Ein per SSR gerendertes Bild kann bereits 404en, bevor React hydriert und
  // den onError-Handler anhängt — das Fehler-Event geht dann verloren, sodass
  // der Platzhalter nie greifen würde. Wir setzen den Fehlerzustand daher nicht
  // blind zurück, sondern prüfen beim Mount/Quellwechsel direkt am DOM-Knoten,
  // ob das aktuelle Bild bereits fehlgeschlagen ist (complete + naturalWidth 0).
  useEffect(() => {
    setLoaded(false);
    const node = imgRef.current;
    if (node && node.complete && node.naturalWidth === 0) {
      setFailed(true);
      // Bild ist schon vor dem Hydrieren gescheitert — onError feuert nicht
      // mehr, also den Ladeslot hier freigeben.
      settle();
    } else if (node && node.complete && node.naturalWidth > 0) {
      // Bereits (aus dem Cache) geladen, bevor onLoad greifen konnte.
      setFailed(false);
      settle();
    } else {
      setFailed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, placeholderSrc]);

  if (!src || failed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    const initials = fallbackLabel?.trim() || deriveInitialsFromAlt(alt);
    return (
      <span
        className={`${onErrorClassName ?? className} optimized-media-image-fallback`}
        style={style}
        aria-label={alt.trim() ? alt : undefined}
      >
        {initials}
      </span>
    );
  }

  const progressivePlaceholder =
    placeholderSrc && placeholderSrc !== src ? placeholderSrc : null;

  if (progressivePlaceholder) {
    return (
      <span
        className={`optimized-media-image is-progressive${loaded ? " is-loaded" : ""}`}
        style={style}
      >
        <img
          className={`${className} is-placeholder-layer`}
          src={progressivePlaceholder}
          alt=""
          aria-hidden
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority === "high" ? "high" : "low"}
        />
        <img
          ref={imgRef}
          className={`${className} is-full-layer`}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          onLoad={() => {
            setLoaded(true);
            settle();
          }}
          onError={() => {
            setFailed(true);
            settle();
          }}
        />
      </span>
    );
  }

  return (
    <img
      ref={imgRef}
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onLoad={() => settle()}
      onError={() => {
        setFailed(true);
        settle();
      }}
    />
  );
}
