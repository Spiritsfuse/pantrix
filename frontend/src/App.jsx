import { useCallback, useEffect, useState } from "react";
import { HandHeart, Store, Users } from "lucide-react";

import { api } from "./lib/api.js";
import { Header } from "./components/Header.jsx";
import { KpiStrip } from "./components/KpiStrip.jsx";
import { ShelfView } from "./components/ShelfView.jsx";
import { DonorsView } from "./components/DonorsView.jsx";
import { HandoutsView } from "./components/HandoutsView.jsx";
import { ToastProvider } from "./components/Toasts.jsx";

const TABS = [
  { id: "shelf", label: "Shelf", icon: Store },
  { id: "donors", label: "Donors", icon: Users },
  { id: "handouts", label: "Hand-outs", icon: HandHeart },
];

function tabFromHash() {
  const id = window.location.hash.replace("#/", "");
  return TABS.some((t) => t.id === id) ? id : "shelf";
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [donors, setDonors] = useState([]);
  // Bumped after any mutation so every view refetches its data.
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.stats(), api.listDonors()])
      .then(([s, d]) => {
        if (!alive) return;
        setStats(s);
        setDonors(d);
        setStatsError(null);
      })
      .catch((e) => alive && setStatsError(e.message));
    return () => {
      alive = false;
    };
  }, [revision]);

  const go = (id) => {
    window.location.hash = `/${id}`;
  };

  return (
    <ToastProvider>
      <div className="app">
        <Header tabs={TABS} active={tab} onSelect={go} />
        <main className="page">
          <KpiStrip stats={stats} error={statsError} onRetry={refresh} />
          {tab === "shelf" && <ShelfView revision={revision} donors={donors} onChanged={refresh} />}
          {tab === "donors" && <DonorsView revision={revision} onChanged={refresh} />}
          {tab === "handouts" && <HandoutsView revision={revision} onChanged={refresh} />}
        </main>
        <footer className="footer">
          Pantrix · built by Dhruv Sharma (
          <a href="https://github.com/spiritsfuse" target="_blank" rel="noreferrer">
            @Spiritsfuse
          </a>
          ) · DevSecOps capstone
        </footer>
      </div>
    </ToastProvider>
  );
}
