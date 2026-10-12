import { describe, expect, it } from "vitest";

import { expiryText, freshness } from "./meta.js";

describe("expiryText", () => {
  it.each([
    [null, "No expiry"],
    [-3, "Expired 3d ago"],
    [0, "Expires today"],
    [1, "Expires tomorrow"],
    [12, "12 days left"],
  ])("days_to_expiry=%s -> %s", (days, text) => {
    expect(expiryText({ days_to_expiry: days })).toBe(text);
  });
});

describe("freshness", () => {
  it("clamps between 0 and 1", () => {
    expect(freshness({ days_to_expiry: -5 })).toBe(0);
    expect(freshness({ days_to_expiry: 15 })).toBe(0.5);
    expect(freshness({ days_to_expiry: 90 })).toBe(1);
    expect(freshness({ days_to_expiry: null })).toBe(1);
  });
});
