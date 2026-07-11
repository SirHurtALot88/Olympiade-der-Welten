"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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
  onErrorClassName?: string;
};

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
  onErrorClassName,
}: OptimizedMediaImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src, placeholderSrc]);

  if (!src || failed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <span className={onErrorClassName ?? className} aria-label={`${alt} Platzhalter`}>—</span>;
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
          className={`${className} is-full-layer`}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </span>
    );
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
