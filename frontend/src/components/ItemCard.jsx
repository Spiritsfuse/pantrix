import { useState } from "react";
import { HandHeart, MapPin, Pencil, Trash2 } from "lucide-react";

import { STATUS, categoryMeta, expiryText, freshness } from "../lib/meta.js";

export function ItemCard({ item, onEdit, onHandOut, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const { label: catLabel, icon: CatIcon } = categoryMeta(item.category);
  const status = STATUS[item.status];
  const canHandOut = item.status === "ok" || item.status === "expiring";

  return (
    <article className={`item-card item-card--${status.tone}`} data-testid="item-card">
      <header className="item-card__top">
        <span className="cat-badge">
          <CatIcon size={15} aria-hidden="true" /> {catLabel}
        </span>
        <span className={`pill pill--${status.tone}`}>{status.label}</span>
      </header>

      <h3 className="item-card__name">{item.name}</h3>
      <p className="item-card__qty">
        <strong>{item.quantity}</strong> {item.unit}
        {item.location && (
          <span className="item-card__loc">
            <MapPin size={13} aria-hidden="true" /> {item.location}
          </span>
        )}
      </p>

      <div className="shelf-life" aria-label={expiryText(item)}>
        <div className="shelf-life__track">
          <span className="shelf-life__fill" style={{ width: `${freshness(item) * 100}%` }} />
        </div>
        <span className="shelf-life__text">{expiryText(item)}</span>
      </div>

      {item.donor_name && <p className="item-card__donor">from {item.donor_name}</p>}

      <footer className="item-card__actions">
        {confirming ? (
          <>
            <span className="confirm-text">Remove this item?</span>
            <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>
              Remove
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--soft btn--sm"
              onClick={onHandOut}
              disabled={!canHandOut}
              title={canHandOut ? "Record a hand-out" : "Only fresh stock can be handed out"}
            >
              <HandHeart size={15} aria-hidden="true" /> Hand out
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onEdit}
              aria-label={`Edit ${item.name}`}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${item.name}`}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
