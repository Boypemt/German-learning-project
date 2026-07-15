"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Opa } from "./Opa";
import { getBalance } from "@/lib/garden";

const items = [
  { href: "/vocab", icon: "🃏", label: "Vocab" },
  { href: "/grammar", icon: "🧩", label: "Grammar" },
  { href: "/listening", icon: "🎧", label: "Listening" },
  { href: "/speaking", icon: "🎙️", label: "Speaking" },
  { href: "/writing", icon: "✍️", label: "Writing" },
  { href: "/garten", icon: "🌻", label: "Garten" },
  { href: "/coach", icon: "🧭", label: "Coach" },
];

export default function Nav() {
  const path = usePathname();
  const [coins, setCoins] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setCoins(getBalance());
    refresh();
    window.addEventListener("sl:coins", refresh);
    return () => window.removeEventListener("sl:coins", refresh);
  }, [path]);

  return (
    <nav className="topnav">
      <div className="inner">
        <Link href="/" className={"brand" + (path === "/" ? " active" : "")}>
          <Opa size={30} /> Bei Opa
        </Link>
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={path === it.href ? "active" : ""}>
            {it.icon} <span className="label">{it.label}</span>
          </Link>
        ))}
        {coins !== null && (
          <Link href="/garten" className="coin-chip" title="Taler — spend them in Opas Garten">
            🪙 {coins}
          </Link>
        )}
      </div>
    </nav>
  );
}
