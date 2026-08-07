import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFlipHeight } from "../lib/useFlipHeight";

// jsdom has no ResizeObserver. This fake captures the callback passed to it
// so tests can invoke it manually to simulate a face resizing after render
// (recall result, Sag-es/WordMatch feedback, note text wrapping, etc.) —
// exactly the cases the hook must handle without a caller listing them as
// deps.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function setScrollHeight(el: Element, value: number) {
  Object.defineProperty(el, "scrollHeight", { value, configurable: true });
}

function TestCard({ heights }: { heights: { current: number | undefined } }) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  heights.current = useFlipHeight(frontRef, backRef, []);
  return createElement(
    "div",
    null,
    createElement("div", { ref: frontRef, "data-testid": "front" }),
    createElement("div", { ref: backRef, "data-testid": "back" })
  );
}

describe("useFlipHeight", () => {
  let container: HTMLDivElement;
  let originalRO: typeof ResizeObserver | undefined;

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    originalRO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = originalRO;
    container.remove();
  });

  it("recomputes when a face grows after render, without that growth being listed as a dep", () => {
    const heights: { current: number | undefined } = { current: undefined };
    let root!: Root;
    act(() => {
      root = createRoot(container);
      root.render(createElement(TestCard, { heights }));
    });

    const front = container.querySelector('[data-testid="front"]')!;
    const back = container.querySelector('[data-testid="back"]')!;
    setScrollHeight(front, 100);
    setScrollHeight(back, 120);

    expect(FakeResizeObserver.instances.length).toBe(1);
    const ro = FakeResizeObserver.instances[0];
    expect(ro.observed).toContain(front);
    expect(ro.observed).toContain(back);

    act(() => {
      ro.callback([], ro as unknown as ResizeObserver);
    });
    expect(heights.current).toBe(120);

    // simulate e.g. Sag-es/WordMatch feedback appearing and growing the back face
    setScrollHeight(back, 300);
    act(() => {
      ro.callback([], ro as unknown as ResizeObserver);
    });
    expect(heights.current).toBe(300);

    act(() => root.unmount());
  });

  it("disconnects the observer on unmount", () => {
    const heights: { current: number | undefined } = { current: undefined };
    let root!: Root;
    act(() => {
      root = createRoot(container);
      root.render(createElement(TestCard, { heights }));
    });
    const ro = FakeResizeObserver.instances[0];
    expect(ro.disconnected).toBe(false);

    act(() => root.unmount());
    expect(ro.disconnected).toBe(true);
  });

  it("guards environments without ResizeObserver instead of throwing", () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    const heights: { current: number | undefined } = { current: undefined };
    let root!: Root;
    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(createElement(TestCard, { heights }));
      });
    }).not.toThrow();
    expect(typeof heights.current).toBe("number");
    act(() => root.unmount());
  });
});
