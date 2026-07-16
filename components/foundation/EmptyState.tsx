type EmptyStateProps = {
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({ title, text, actionLabel, onAction, className = "" }: EmptyStateProps) {
  return (
    <div className={`foundation-empty-state${className ? ` ${className}` : ""}`} role="status">
      {title ? <strong className="foundation-empty-state-title">{title}</strong> : null}
      <p className="foundation-empty-state-text">{text}</p>
      {actionLabel && onAction ? (
        <button type="button" className="secondary-button inline-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
