import { AlertTriangle, Boxes, CalendarClock, HandHeart, PackageX } from "lucide-react";

import { ErrorBanner } from "./States.jsx";

const TILES = [
  { key: "total_units", label: "Units on the shelf", icon: Boxes, tone: "ink" },
  { key: "expiring_soon", label: "Use within 7 days", icon: CalendarClock, tone: "warn" },
  { key: "expired", label: "Expired — pull today", icon: AlertTriangle, tone: "bad" },
  { key: "out_of_stock", label: "Out of stock", icon: PackageX, tone: "muted" },
  { key: "distributed_units_30d", label: "Handed out (30 days)", icon: HandHeart, tone: "ok" },
];

function headline(stats) {
  if (!stats) return "Checking the shelves…";
  if (stats.expired > 0) {
    return `${stats.expired} item${stats.expired > 1 ? "s have" : " has"} expired — pull before the next hand-out.`;
  }
  if (stats.expiring_soon > 0) {
    return `${stats.expiring_soon} item${stats.expiring_soon > 1 ? "s" : ""} should go out this week.`;
  }
  return "Every shelf is fresh. Nothing expires this week.";
}

export function KpiStrip({ stats, error, onRetry }) {
  return (
    <section className="overview" aria-labelledby="overview-title">
      <div className="overview__lead">
        <p className="eyebrow">Today at the pantry</p>
        <h1 id="overview-title">{headline(stats)}</h1>
      </div>
      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : (
        <ul className="kpis">
          {TILES.map(({ key, label, icon: Icon, tone }) => (
            <li key={key} className={`kpi kpi--${tone}`}>
              <Icon size={20} aria-hidden="true" />
              <span className="kpi__value" data-testid={`kpi-${key}`}>
                {stats ? stats[key].toLocaleString() : <span className="skeleton skeleton--num" />}
              </span>
              <span className="kpi__label">{label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
