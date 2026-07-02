type FoundationPanelSkeletonProps = {
  variant?: "default" | "homeV2" | "marketV2" | "lineup" | "teams" | "seasonV2" | "trainingCompact";
  label?: string;
  testId?: string;
  id?: string;
  sectionClassName?: string;
};

export default function FoundationPanelSkeleton({
  variant = "default",
  label = "Ansicht wird vorbereitet…",
  testId,
  id,
  sectionClassName,
}: FoundationPanelSkeletonProps) {
  return (
    <div
      className={`foundation-panel-skeleton foundation-panel-skeleton--${variant}${sectionClassName ? ` ${sectionClassName}` : ""}`}
      id={id}
      data-testid={testId}
      aria-busy="true"
      aria-live="polite"
    >
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
        {variant === "seasonV2" ? (
          <>
            <div className="foundation-panel-skeleton__block is-wide is-tall" />
            <div className="foundation-panel-skeleton__block is-wide" />
          </>
        ) : null}
        {variant === "trainingCompact" ? (
          <>
            <div className="foundation-panel-skeleton__block is-wide" />
            <div className="foundation-panel-skeleton__block is-tall" />
            <div className="foundation-panel-skeleton__block is-tall" />
          </>
        ) : null}
      </div>
    </div>
  );
}
