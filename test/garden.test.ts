import { describe, it, expect, beforeEach } from "vitest";
import { ITEMS, COINS_PER_REVIEW, getOwned, getBalance, buy } from "../lib/garden";

beforeEach(() => {
  localStorage.clear();
});

function seedReviews(count: number) {
  localStorage.setItem("sl:activity", JSON.stringify({ "2024-01-01": count }));
}

describe("getBalance", () => {
  it("is 0 with no review history", () => {
    expect(getBalance()).toBe(0);
  });

  it("is reviews * COINS_PER_REVIEW minus what's spent", () => {
    seedReviews(10);
    expect(getBalance()).toBe(10 * COINS_PER_REVIEW);
  });

  it("subtracts the price of owned items", () => {
    const item = ITEMS[0];
    seedReviews(Math.ceil(item.price / COINS_PER_REVIEW));
    buy(item.id);
    expect(getBalance()).toBe(Math.ceil(item.price / COINS_PER_REVIEW) * COINS_PER_REVIEW - item.price);
  });
});

describe("buy", () => {
  it("succeeds and records ownership when affordable", () => {
    const item = ITEMS[0];
    seedReviews(Math.ceil(item.price / COINS_PER_REVIEW));
    expect(buy(item.id)).toBe(true);
    expect(getOwned()).toContain(item.id);
  });

  it("fails for an unknown item id", () => {
    seedReviews(1000);
    expect(buy("not-a-real-item")).toBe(false);
    expect(getOwned()).toEqual([]);
  });

  it("can't be bought twice", () => {
    const item = ITEMS[0];
    seedReviews(1000);
    expect(buy(item.id)).toBe(true);
    expect(buy(item.id)).toBe(false);
    expect(getOwned().filter((id) => id === item.id).length).toBe(1);
  });

  it("can't overspend — refuses a purchase costing more than the balance", () => {
    const item = ITEMS.find((i) => i.price > 0)!;
    seedReviews(Math.floor((item.price - 1) / COINS_PER_REVIEW)); // just under afforded
    expect(getBalance()).toBeLessThan(item.price);
    expect(buy(item.id)).toBe(false);
    expect(getOwned()).toEqual([]);
  });

  it("running balance can never go negative across several purchases", () => {
    seedReviews(50); // 150 Taler
    let balance = getBalance();
    for (const item of ITEMS) {
      if (buy(item.id)) balance -= item.price;
      expect(getBalance()).toBe(balance);
      expect(getBalance()).toBeGreaterThanOrEqual(0);
    }
  });
});
