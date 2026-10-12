import { MapPin } from "lucide-react";

export function Header({ tabs, active, onSelect }) {
  return (
    <header className="masthead">
      <div className="masthead__inner">
        <a className="brand" href="#/shelf" aria-label="Pantrix home">
          <img src="/pantrix.svg" alt="" width="36" height="36" />
          <span className="brand__text">
            <span className="brand__name">Pantrix</span>
            <span className="brand__tag">community pantry ledger</span>
          </span>
        </a>
        <nav className="tabs" aria-label="Sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`tab ${active === id ? "tab--active" : ""}`}
              aria-current={active === id ? "page" : undefined}
              onClick={() => onSelect(id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <span className="hub-chip" title="Demo hub">
          <MapPin size={14} aria-hidden="true" /> Pilani demo hub
        </span>
      </div>
    </header>
  );
}
