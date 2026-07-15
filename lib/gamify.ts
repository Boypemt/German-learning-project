// Lightweight gamification derived from the activity log. No extra state to corrupt.

import { load } from "./storage";
import type { Activity } from "./storage";

export const DAILY_GOAL = 30; // reviews per day
export const XP_PER_REVIEW = 10;
export const XP_PER_LEVEL = 600;

export function getTotalReviews(): number {
  const a = load<Activity>("activity", {});
  return Object.values(a).reduce((s, n) => s + n, 0);
}

export function getXp(): number {
  return getTotalReviews() * XP_PER_REVIEW;
}

export function getLevel(): { level: number; intoLevel: number; pct: number } {
  const xp = getXp();
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp % XP_PER_LEVEL;
  return { level, intoLevel, pct: Math.round((intoLevel / XP_PER_LEVEL) * 100) };
}
