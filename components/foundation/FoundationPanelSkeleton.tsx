type FoundationPanelSkeletonProps = {
  variant?: "default" | "homeV2" | "marketV2" | "lineup" | "teams";
  label?: string;
};

export default function FoundationPanelSkeleton({
  variant = "default",
  label = "Ansicht wird vorbereitet…",
}: FoundationPanelSkeletonProps) {
  return (
    <div className={`foundation-panel-skeleton foundation-panel-skeleton--${variant}`} aria-busy="true" aria-live="polite">
      <span className="foundation-panel-skeleton__pill">{label}</span>
      <div className="foundation-panel-skeleton__grid">
        <div className="foundation-panel-skeleton__block is-wide" />
        <div className="foundation-panel-skeleton__block" />
        <div className="foundation-panel-skeleton__block" />
        {variant === "marketV2" ? (
          <>
            <div className="foundation-panel-skeleton__block is-tall" />
            <div className="foundation-panel-skeleton__block is-tall" />
            <div className="foundation-panel-skeleton__block is-tall" />
          </>
        ) : null}
        {variant === "lineup" ? (
          <>
            <div className="foundation-panel-skeleton__block is-tall" />
            <div className="foundation-panel-skeleton__block is-tall" />
          </>
        ) : null}
      </div>
    </div>
  );
}
