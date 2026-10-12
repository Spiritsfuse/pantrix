import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import { api } from "../lib/api.js";
import { DONOR_TYPES } from "../lib/meta.js";
import { Drawer, Field } from "./Drawer.jsx";
import { EmptyState, ErrorBanner } from "./States.jsx";
import { useToast } from "../lib/toast.js";

const EMPTY = { name: "", donor_type: "business", contact_email: "", city: "" };

function DonorDrawer({ donor, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    donor ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, donor[k] ?? ""])) : EMPTY,
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = { ...form, contact_email: form.contact_email || null, city: form.city || null };
    try {
      const saved = donor ? await api.updateDonor(donor.id, body) : await api.createDonor(body);
      onSaved(saved, !donor);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Drawer title={donor ? "Edit donor" : "Add a donor"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name">
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
          <Field label="Type">
            <select value={form.donor_type} onChange={set("donor_type")}>
              {DONOR_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input maxLength={80} value={form.city} onChange={set("city")} />
          </Field>
        </div>
        <Field label="Contact email">
          <input type="email" value={form.contact_email} onChange={set("contact_email")} />
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
            {saving ? "Saving…" : donor ? "Save donor" : "Add donor"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function DonorsView({ revision, onChanged }) {
  const toast = useToast();
  const [donors, setDonors] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .listDonors()
      .then((d) => alive && (setDonors(d), setError(null)))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [revision, retry]);

  const remove = async (donor) => {
    if (!window.confirm(`Remove ${donor.name}? Their items stay on the shelf as anonymous.`))
      return;
    try {
      await api.deleteDonor(donor.id);
      toast(`Removed ${donor.name}`);
      onChanged();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <section className="panel" aria-labelledby="donors-title">
      <div className="panel__head">
        <div>
          <h2 id="donors-title">Donors</h2>
          <p className="muted">Farms, kitchens and neighbours who keep the shelves full.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setEditing("new")}>
          <Plus size={18} aria-hidden="true" /> Add donor
        </button>
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => setRetry((r) => r + 1)} />
      ) : donors === null ? (
        <p className="muted">Loading donors…</p>
      ) : donors.length === 0 ? (
        <EmptyState icon={Users} title="No donors yet">
          Add the first farm, business or neighbour that donates to the pantry.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Type</th>
                <th>City</th>
                <th className="num">Items</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    {d.contact_email && <span className="sub">{d.contact_email}</span>}
                  </td>
                  <td>
                    <span className={`type-tag type-tag--${d.donor_type}`}>{d.donor_type}</span>
                  </td>
                  <td>{d.city ?? "—"}</td>
                  <td className="num">{d.item_count}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setEditing(d)}
                      aria-label={`Edit ${d.name}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => remove(d)}
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <DonorDrawer
          donor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            toast(created ? `Added ${saved.name}` : `Updated ${saved.name}`);
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}
