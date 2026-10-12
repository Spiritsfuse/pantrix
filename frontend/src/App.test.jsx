import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App.jsx";

const STATS = {
  total_items: 2,
  total_units: 30,
  expiring_soon: 1,
  expired: 0,
  out_of_stock: 0,
  donors: 1,
  distributed_units_30d: 6,
  by_category: { dairy: 12, grains: 18 },
};

const ITEMS = [
  {
    id: 1,
    name: "Toned milk 1L",
    category: "dairy",
    quantity: 12,
    unit: "litres",
    expiry_date: "2026-10-15",
    days_to_expiry: 3,
    status: "expiring",
    location: "COLD-3",
    donor_id: 1,
    donor_name: "Greenrow Organic Farm",
    notes: null,
  },
  {
    id: 2,
    name: "Basmati rice",
    category: "grains",
    quantity: 18,
    unit: "packs",
    expiry_date: null,
    days_to_expiry: null,
    status: "ok",
    location: "A1-03",
    donor_id: null,
    donor_name: null,
    notes: null,
  },
];

const json = (body, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

function mockApi(overrides = {}) {
  const fetchMock = vi.fn((url, init = {}) => {
    const path = url.split("?")[0];
    const key = `${init.method ?? "GET"} ${path}`;
    if (overrides[key]) return overrides[key](url, init);
    if (key === "GET /api/items/stats") return json(STATS);
    if (key === "GET /api/items") return json(ITEMS);
    if (key === "GET /api/donors")
      return json([{ id: 1, name: "Greenrow Organic Farm", donor_type: "farm", item_count: 1 }]);
    return json({ detail: `unmocked ${key}` }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pantrix app", () => {
  it("renders KPIs and shelf items from the API", async () => {
    mockApi();
    render(<App />);
    expect(await screen.findByText("Toned milk 1L")).toBeInTheDocument();
    expect(screen.getByText("Basmati rice")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-total_units")).toHaveTextContent("30");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "1 item should go out this week.",
    );
    expect(screen.getAllByTestId("item-card")).toHaveLength(2);
  });

  it("shows an error banner when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    render(<App />);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0]).toHaveTextContent("Cannot reach the Pantrix API");
  });

  it("logs a donation through POST /api/items", async () => {
    const created = { ...ITEMS[1], id: 3, name: "Chickpeas (canned)", category: "canned" };
    const fetchMock = mockApi({ "POST /api/items": () => json(created, 201) });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Toned milk 1L");

    await user.click(screen.getByRole("button", { name: /log donation/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Item name"), "Chickpeas (canned)");
    await user.click(within(dialog).getByRole("button", { name: /add to shelf/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post[1].body)).toMatchObject({
      name: "Chickpeas (canned)",
      category: "produce",
      quantity: 1,
    });
    expect(await screen.findByText(/Logged “Chickpeas \(canned\)”/)).toBeInTheDocument();
  });

  it("surfaces API validation errors inside the form", async () => {
    mockApi({
      "POST /api/items": () =>
        json(
          {
            detail: [
              { loc: ["body", "quantity"], msg: "Input should be greater than or equal to 0" },
            ],
          },
          422,
        ),
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Toned milk 1L");
    await user.click(screen.getByRole("button", { name: /log donation/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Item name"), "Bad item");
    await user.click(within(dialog).getByRole("button", { name: /add to shelf/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "quantity: Input should be greater",
    );
  });
});
