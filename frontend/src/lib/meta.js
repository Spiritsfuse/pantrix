import { Apple, Baby, Beef, Croissant, Milk, Package, Soup, Sparkles, Wheat } from "lucide-react";

export const CATEGORIES = {
  produce: { label: "Produce", icon: Apple },
  dairy: { label: "Dairy", icon: Milk },
  grains: { label: "Grains & pulses", icon: Wheat },
  canned: { label: "Canned", icon: Soup },
  protein: { label: "Protein", icon: Beef },
  bakery: { label: "Bakery", icon: Croissant },
  hygiene: { label: "Hygiene", icon: Sparkles },
  baby: { label: "Baby care", icon: Baby },
};

export const categoryMeta = (key) => CATEGORIES[key] ?? { label: key, icon: Package };

export const UNITS = ["units", "kg", "litres", "packs", "boxes", "cans"];
export const DONOR_TYPES = ["business", "farm", "community", "individual"];

export const STATUS = {
  ok: { label: "Fresh", tone: "ok" },
  expiring: { label: "Use soon", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
  out_of_stock: { label: "Out of stock", tone: "muted" },
};

export function expiryText(item) {
  const d = item.days_to_expiry;
  if (d === null || d === undefined) return "No expiry";
  if (d < 0) return `Expired ${Math.abs(d)}d ago`;
  if (d === 0) return "Expires today";
  if (d === 1) return "Expires tomorrow";
  return `${d} days left`;
}

// 0..1 freshness used for the shelf-life bar; 30+ days counts as fully fresh.
export function freshness(item) {
  const d = item.days_to_expiry;
  if (d === null || d === undefined) return 1;
  return Math.max(0, Math.min(1, d / 30));
}

export const today = () => new Date().toISOString().slice(0, 10);
