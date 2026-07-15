"use client";

// On-screen keys for German characters missing on EN/TH keyboards.
// Inserts at the cursor position of the connected input/textarea.

import type { RefObject } from "react";

const CHARS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

export default function Umlauts({
  targetRef,
  value,
  onChange,
}: {
  targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  function insert(ch: string) {
    const el = targetRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + ch.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="umlaut-row">
      {CHARS.map((c) => (
        <button key={c} type="button" className="umlaut" onClick={() => insert(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}
