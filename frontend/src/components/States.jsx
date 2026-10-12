import { CloudOff, RotateCw } from "lucide-react";

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="banner banner--error" role="alert">
      <CloudOff size={20} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          <RotateCw size={15} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={36} strokeWidth={1.5} aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function CardSkeletons({ count = 6 }) {
  return (
    <div className="shelf-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="item-card item-card--skeleton">
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--line skeleton--short" />
          <span className="skeleton skeleton--bar" />
        </div>
      ))}
    </div>
  );
}
