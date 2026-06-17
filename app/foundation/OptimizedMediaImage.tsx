"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type OptimizedMediaImageProps = {
  src: string | null | undefined;
  alt: string;
  className: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  fallback?: ReactNode;
  onErrorClassName?: string;
};

export default function OptimizedMediaImage({
  src,
  alt,
  className,
  width,
  height,
  style,
  loading = "lazy",
  fetchPriority = "low",
  fallback = null,
  onErrorClassName,
}: OptimizedMediaImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <span className={onErrorClassName ?? className} aria-label={`${alt} Platzhalter`}>—</span>;
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}
