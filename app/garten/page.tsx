"use client";

import { useEffect, useState } from "react";
import { ITEMS, getOwned, getBalance, buy, COINS_PER_REVIEW, type GardenItem } from "@/lib/garden";
import { OpaSays } from "@/components/Opa";
import Say from "@/components/Say";
import { speak } from "@/lib/speech";

export default function GardenPage() {
  const [owned, setOwned] = useState<string[]>([]);
  const [balance, setBalance] = useState(0);
  const [ready, setReady] = useState(false);
  const [lastQuip, setLastQuip] = useState<string | null>(null);

  useEffect(() => {
    setOwned(getOwned());
    setBalance(getBalance());
    setReady(true);
  }, []);

  function handleBuy(item: GardenItem) {
    if (!buy(item.id)) return;
    setOwned(getOwned());
    setBalance(getBalance());
    setLastQuip(item.quip);
    if (item.sound) setTimeout(() => speak(item.sound!), 300);
  }

  // Tap any item: Opa says its German name; animals answer afterwards.
  function poke(item: GardenItem) {
    speak(item.de);
    if (item.sound) setTimeout(() => speak(item.sound!), 1100);
  }

  if (!ready) return <p className="muted">Loading…</p>;

  const ownedSet = new Set(owned);
  const allOwned = owned.length === ITEMS.length;
  const nextItem = ITEMS.find((i) => !ownedSet.has(i.id));

  return (
    <>
      <h1>Opas Schrebergarten</h1>
      <OpaSays
        de={
          lastQuip ??
          (allOwned
            ? "Der schönste Garten der Kolonie! Und alles durch Deutsch lernen."
            : owned.length === 0
            ? "Nur eine leere Wiese… Hilf mir, einen Garten draus zu machen! Jede Vokabel bringt Taler."
            : "Es wird! Jede Übung bringt Taler für den Garten.")
        }
        en={
          allOwned
            ? "The prettiest garden in the colony! All from learning German."
            : `Every review earns ${COINS_PER_REVIEW} Taler. Spend them below.`
        }
        mood={allOwned ? "cheer" : "happy"}
        size={80}
      />

      {/* the garden scene */}
      <div className={"garden-scene" + (ownedSet.has("zaun") ? " has-fence" : "")}>
        <span className="g-sky">☀️</span>
        <span className="g-cloud c1">☁️</span>
        <span className="g-cloud c2">☁️</span>
        {ITEMS.filter((i) => ownedSet.has(i.id) && i.size > 0).map((i) => (
          <span
            key={i.id}
            className="g-item poke"
            style={{ left: `${i.left}%`, bottom: `${i.bottom}%`, fontSize: i.size }}
            title={`🔊 ${i.de}`}
            onClick={() => poke(i)}
          >
            {i.emoji}
          </span>
        ))}
        {owned.length === 0 && <span className="g-empty muted">🌱 An empty meadow…</span>}
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 800 }}>🪙 {balance} Taler</span>
          <span className="muted small"> · {owned.length}/{ITEMS.length} items</span>
        </div>
        {nextItem && balance < nextItem.price && (
          <span className="muted small">
            {Math.ceil((nextItem.price - balance) / COINS_PER_REVIEW)} more reviews until {nextItem.emoji} {nextItem.de}
          </span>
        )}
      </div>

      <h2>🛒 Opas Laden — the shop</h2>
      <div className="shop-grid">
        {ITEMS.map((item) => {
          const isOwned = ownedSet.has(item.id);
          const affordable = balance >= item.price;
          return (
            <div className={"shop-item" + (isOwned ? " owned" : "")} key={item.id}>
              <div className="s-emoji">{item.id === "zaun" ? "🚧" : item.emoji}</div>
              <div className="s-name"><Say>{item.de}</Say></div>
              <div className="s-en muted small">{item.en}</div>
              {isOwned ? (
                <div className="s-owned">✓ Im Garten</div>
              ) : (
                <button
                  className={affordable ? "primary" : "ghost"}
                  disabled={!affordable}
                  onClick={() => handleBuy(item)}
                  style={{ padding: "8px 14px", fontSize: 14, width: "100%" }}
                >
                  🪙 {item.price}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted small center" style={{ marginTop: 18 }}>
        Fun fact: allotment gardens (Schrebergärten) are a German institution — see Opas Kulturecke.
        Tap animals in the garden — they answer. 🐕
      </p>
    </>
  );
}
