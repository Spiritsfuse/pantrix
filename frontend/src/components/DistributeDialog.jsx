import { useState } from "react";

import { api } from "../lib/api.js";
import { today } from "../lib/meta.js";
import { Drawer, Field } from "./Drawer.jsx";

export function DistributeDialog({ item, onClose, onDone }) {
  const [quantity, setQuantity] = useState(1);
  const [recipient, setRecipient] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const d = await api.distribute({
        item_id: item.id,
        quantity: Number(quantity),
        recipient,
        distributed_on: date,
      });
      onDone(d);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Record a hand-out"
      subtitle={`${item.name} · ${item.quantity} ${item.unit} available`}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <Field label="Recipient organisation">
          <input
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Shelter Home Ward 4"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="form__row">
          <Field label={`Quantity (${item.unit})`}>
            <input
              type="number"
              min={1}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
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
            {saving ? "Recording…" : "Hand out"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
