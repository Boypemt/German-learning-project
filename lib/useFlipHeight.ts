import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Flip-card faces (.flip-face) are absolutely positioned with no bottom
 * constraint, so each keeps its own natural content height but is out of
 * normal flow — .flip-inner needs an explicit height to visually fit
 * whichever face is taller.
 *
 * A ResizeObserver on both faces keeps that height correct on its own —
 * recall results, Sag-es/WordMatch feedback, note text wrapping, or an
 * orientation change all resize a face after the initial render, and none
 * of them need to be known to this hook in advance. `deps` (optional) only
 * drives an immediate synchronous remeasure — e.g. on a card swap, so the
 * new card's height is right from its first paint instead of waiting one
 * frame for the observer's async callback.
 */
export function useFlipHeight(
  frontRef: RefObject<HTMLDivElement | null>,
  backRef: RefObject<HTMLDivElement | null>,
  deps: unknown[] = []
): number | undefined {
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const front = frontRef.current;
    const back = backRef.current;

    function measure() {
      setHeight(Math.max(front?.scrollHeight ?? 0, back?.scrollHeight ?? 0));
    }

    measure();
    if (!front || !back) return;

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(front);
      ro.observe(back);
    }
    // Fallback for engines without ResizeObserver: at least catch viewport
    // orientation/rotation changes.
    window.addEventListener("resize", measure);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return height;
}
