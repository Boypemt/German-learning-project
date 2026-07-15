// Opas Schrebergarten — the game layer.
// Every review earns Taler; spend them on items for Opa's allotment garden.
// Owned items: localStorage "sl:garden:owned" (string[] of item ids).

import { load, save } from "./storage";
import { getTotalReviews } from "./gamify";

export const COINS_PER_REVIEW = 3;

export interface GardenItem {
  id: string;
  de: string;
  en: string;
  price: number;
  emoji: string;
  /** position in the scene, percent from left / bottom, font-size px */
  left: number;
  bottom: number;
  size: number;
  /** what Opa says when you buy it */
  quip: string;
  /** optional sound the item makes when clicked in the garden */
  sound?: string;
}

export const ITEMS: GardenItem[] = [
  { id: "tulpen", de: "Tulpen", en: "Tulips", price: 20, emoji: "🌷", left: 12, bottom: 8, size: 26, quip: "Schön bunt! Oma hätte sich gefreut." },
  { id: "sonnenblumen", de: "Sonnenblumen", en: "Sunflowers", price: 30, emoji: "🌻", left: 22, bottom: 10, size: 30, quip: "Die wachsen höher als du!" },
  { id: "gemuese", de: "Gemüsebeet", en: "Vegetable patch", price: 40, emoji: "🥕", left: 32, bottom: 6, size: 26, quip: "Eigenes Gemüse schmeckt am besten." },
  { id: "vogelhaus", de: "Vogelhäuschen", en: "Bird house", price: 50, emoji: "🐦", left: 8, bottom: 52, size: 24, quip: "Die Meisen kommen jeden Morgen." },
  { id: "zaun", de: "Gartenzaun", en: "Garden fence", price: 60, emoji: "🪵", left: 0, bottom: 0, size: 0, quip: "Ordnung muss sein — sagt der Verein." },
  { id: "bank", de: "Gartenbank", en: "Garden bench", price: 80, emoji: "🪑", left: 62, bottom: 9, size: 28, quip: "Hier trinken wir nachher Kaffee." },
  { id: "zwerg", de: "Gartenzwerg", en: "Garden gnome", price: 100, emoji: "🧙", left: 45, bottom: 6, size: 26, quip: "Jeder echte Garten braucht einen Zwerg!", sound: "Hallo!" },
  { id: "apfelbaum", de: "Apfelbaum", en: "Apple tree", price: 120, emoji: "🌳", left: 84, bottom: 14, size: 52, quip: "In fünf Jahren gibt's Apfelkuchen." },
  { id: "bienen", de: "Bienenstock", en: "Beehive", price: 150, emoji: "🐝", left: 92, bottom: 8, size: 22, quip: "Fleißig wie die Bienen — so lernst du auch!", sound: "Summ summ!" },
  { id: "teich", de: "Gartenteich", en: "Garden pond", price: 180, emoji: "🦆", left: 52, bottom: 3, size: 24, quip: "Die Ente heißt Erna.", sound: "Quak!" },
  { id: "grill", de: "Grillecke", en: "BBQ corner", price: 220, emoji: "🍖", left: 72, bottom: 6, size: 24, quip: "Samstag wird gegrillt. Bratwurst für alle!" },
  { id: "biertisch", de: "Biertischgarnitur", en: "Beer table set", price: 250, emoji: "🍺", left: 68, bottom: 22, size: 24, quip: "Für den Stammtisch mit den Nachbarn. Prost!", sound: "Prost!" },
  { id: "dackel", de: "Dackel Waldi", en: "Dachshund Waldi", price: 300, emoji: "🐕", left: 38, bottom: 12, size: 28, quip: "Waldi! Der beste Freund des Gärtners.", sound: "Wuff! Wuff!" },
  { id: "katze", de: "Katze Minka", en: "Cat Minka", price: 300, emoji: "🐈", left: 58, bottom: 30, size: 24, quip: "Minka schläft nur. Wie eine echte Katze.", sound: "Miau!" },
  { id: "laube", de: "Gartenlaube", en: "Garden hut", price: 500, emoji: "🏡", left: 5, bottom: 12, size: 60, quip: "Die Laube! Jetzt ist es ein richtiger Schrebergarten. Ich bin stolz auf dich!" },
];

export function getOwned(): string[] {
  return load<string[]>("garden:owned", []);
}

export function getSpent(): number {
  const owned = new Set(getOwned());
  return ITEMS.filter((i) => owned.has(i.id)).reduce((s, i) => s + i.price, 0);
}

export function getBalance(): number {
  return getTotalReviews() * COINS_PER_REVIEW - getSpent();
}

/** Returns true if purchase succeeded. */
export function buy(id: string): boolean {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) return false;
  const owned = getOwned();
  if (owned.includes(id) || getBalance() < item.price) return false;
  save("garden:owned", [...owned, id]);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sl:coins"));
  return true;
}
