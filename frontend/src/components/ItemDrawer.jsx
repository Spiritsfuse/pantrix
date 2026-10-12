import { useState } from "react";

import { api } from "../lib/api.js";
import { CATEGORIES, UNITS } from "../lib/meta.js";
import { Drawer, Field } from "./Drawer.jsx";

const EMPTY = {
  name: "",
  category: "produce",
  quantity: 1,
  unit: "units",
  expiry_date: "",
  location: "",
  donor_id: "",
  notes: "",
};

function toForm(item) {
  if (!item) return EMPTY;
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, item[k] ?? ""]));
}

function toPayload(form) {
  return {
    name: form.name,
    category: form.category,
    quantity: Number(form.quantity),
    unit: form.unit,
    expiry_date: form.expiry_date || null,
    location: form.location || null,
    donor_id: form.donor_id ? Number(form.donor_id) : null,
    notes: form.notes || null,
  };
}

export function ItemDrawer({ item, donors, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = item
        ? await api.updateItem(item.id, toPayload(form))
        : await api.createItem(toPayload(form));
      onSaved(saved, !item);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={item ? "Edit stock item" : "Log a donation"}
      subtitle={item ? `#${item.id} · ${item.name}` : "Add what just arrived at the pantry."}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <Field label="Item name">
          <input
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={set("name")}
            autoFocus
          />
        </Field>
        <div className="form__row">
          <Field label="Category">
            <select value={form.category} onChange={set("category")}>
              {Object.entries(CATEGORIES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Donor">
            <select value={form.donor_id} onChange={set("donor_id")}>
              <option value="">Anonymous</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form__row">
          <Field label="Quantity">
            <input
              type="number"
              min={0}
              max={100000}
              required
              value={form.quantity}
              onChange={set("quantity")}
            />
          </Field>
          <Field label="Unit">
            <select value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form__row">
          <Field label="Expiry date" hint="Leave empty for non-perishables">
            <input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
          </Field>
          <Field label="Shelf code">
            <input
              maxLength={40}
              placeholder="e.g. COLD-2"
              value={form.location}
              onChange={set("location")}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={3} maxLength={2000} value={form.notes} onChange={set("notes")} />
        </Field>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : item ? "Save changes" : "Add to shelf"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
