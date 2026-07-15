"use client";

// Wrap any German text to make it tap-to-pronounce.
// <Say>die Zeit</Say> or <Say text="die Zeit"><strong>die Zeit</strong></Say>

import { speak } from "@/lib/speech";

export default function Say({
  text,
  children,
  className,
}: {
  text?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const t = text ?? (typeof children === "string" ? children : "");
  return (
    <span
      className={"say" + (className ? " " + className : "")}
      title="🔊 anhören"
      onClick={(e) => {
        e.stopPropagation();
        if (t) speak(t);
      }}
    >
      {children}
    </span>
  );
}
