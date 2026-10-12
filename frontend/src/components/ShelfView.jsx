import { useEffect, useState } from "react";
import { PackageOpen, Plus, Search } from "lucide-react";

import { api } from "../lib/api.js";
import { CATEGORIES } from "../lib/meta.js";
import { CardSkeletons, EmptyState, ErrorBanner } from "./States.jsx";
import { ItemCard } from "./ItemCard.jsx";
import { ItemDrawer } from "./ItemDrawer.jsx";
import { DistributeDialog } from "./DistributeDialog.jsx";
import { useToast } from "../lib/toast.js";

const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "expiring", label: "Use soon" },
  { id: "expired", label: "Expired" },
  { id: "out_of_stock", label: "Out of stock" },
  { id: "ok", label: "Fresh" },
];

export function ShelfView({ revision, donors, onChanged }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | item
  const [handingOut, setHandingOut] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    api
      .listItems({ category, status, q: debounced })
      .then((data) => {
        if (!alive) return;
        setItems(data);
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [category, status, debounced, revision, retry]);

  const remove = async (item) => {
    try {
      await api.deleteItem(item.id);
      toast(`Removed “${item.name}” from the shelf`);
      onChanged();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const filtered = category || status || debounced;

  return (
    <section className="panel" aria-labelledby="shelf-title">
      <div className="panel__head">
        <div>
          <h2 id="shelf-title">Shelf</h2>
          <p className="muted">Soonest expiry first, so the oldest stock goes out first.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" /> Log donation
        </button>
      </div>

      <div className="filters">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search item or shelf code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search items"
          />
        </label>
        <div className="segmented" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              type="button"
              className={status === f.id ? "is-on" : ""}
              aria-pressed={status === f.id}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setRetry((r) => r + 1)} />
      ) : items === null ? (
        <CardSkeletons />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={filtered ? "Nothing matches these filters" : "The shelf is empty"}
          action={
            !filtered && (
              <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
                <Plus size={18} aria-hidden="true" /> Log the first donation
              </button>
            )
          }
        >
          {filtered
            ? "Try another category or clear the search."
            : "Donations you log appear here."}
        </EmptyState>
      ) : (
        <div className="shelf-grid">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onHandOut={() => setHandingOut(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ItemDrawer
          item={editing === "new" ? null : editing}
          donors={donors}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            toast(created ? `Logged “${saved.name}”` : `Updated “${saved.name}”`);
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {handingOut && (
        <DistributeDialog
          item={handingOut}
          onClose={() => setHandingOut(null)}
          onDone={(d) => {
            toast(`Handed out ${d.quantity} × ${d.item_name} to ${d.recipient}`);
            setHandingOut(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
