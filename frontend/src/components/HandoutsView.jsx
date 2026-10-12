import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";

import { api } from "../lib/api.js";
import { EmptyState, ErrorBanner } from "./States.jsx";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function HandoutsView({ revision }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .listDistributions(50)
      .then((d) => alive && (setRows(d), setError(null)))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [revision, retry]);

  return (
    <section className="panel" aria-labelledby="handouts-title">
      <div className="panel__head">
        <div>
          <h2 id="handouts-title">Hand-outs</h2>
          <p className="muted">
            Every hand-out lowers shelf stock. Record new ones from the <a href="#/shelf">Shelf</a>.
          </p>
        </div>
      </div>
      {error ? (
        <ErrorBanner message={error} onRetry={() => setRetry((r) => r + 1)} />
      ) : rows === null ? (
        <p className="muted">Loading hand-outs…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={HandHeart} title="Nothing handed out yet">
          Use “Hand out” on any fresh item to record a distribution.
        </EmptyState>
      ) : (
        <ol className="timeline">
          {rows.map((d) => (
            <li key={d.id} className="timeline__row">
              <time dateTime={d.distributed_on}>{dateFmt.format(new Date(d.distributed_on))}</time>
              <span className="timeline__dot" aria-hidden="true" />
              <div>
                <strong>
                  {d.quantity} × {d.item_name}
                </strong>
                <span className="sub">to {d.recipient}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
