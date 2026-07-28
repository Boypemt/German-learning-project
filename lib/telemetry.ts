// Behavioral event log — local-first, capped so it never bloats the synced
// state. Two localStorage keys:
//   sl:events  — a ring buffer of the newest MAX_EVENTS raw events (for
//                fine-grained signals like which distractor fooled you).
//   sl:rollups — per-day/per-skill {n, ok, msAvg} aggregates, updated on
//                every write so history survives ring-buffer trimming.
//
// Always log through logEvent() — never write ad-hoc analytics elsewhere.

import { load, save, todayKey } from "./storage";

const MAX_EVENTS = 800;
const MAX_ROLLUP_DAYS = 400; // ~13 months — keeps sl:rollups bounded for good

interface EventPayloads {
  step_open: { skill: string };
  review: { skill: string; itemId?: string; ok: boolean; ms?: number };
  again: { itemId: string };
  replay: { skill: string; slow?: boolean };
  skip: { skill: string; done: number; target: number };
  choice_wrong: { itemId: string; pickedId: string };
  sayit: { ok: boolean };
  session: { minutes: number };
}

export type EventType = keyof EventPayloads;

export interface TelemetryEvent {
  t: number; // Date.now() at log time
  date: string; // local dateKey — the learner's day, not UTC's
  type: EventType;
  data: Record<string, unknown>;
}

export interface RollupBucket {
  n: number;
  ok: number;
  msAvg: number;
  /** How many of the n samples actually supplied a latency reading — kept
   *  so msAvg's running mean isn't dragged toward 0 by untimed events. */
  msN: number;
}

export type Rollups = Record<string, Record<string, RollupBucket>>; // date -> skill -> bucket

function loadEvents(): TelemetryEvent[] {
  return load<TelemetryEvent[]>("events", []);
}

function loadRollups(): Rollups {
  return load<Rollups>("rollups", {});
}

/** Keep only the newest `MAX_EVENTS` — called on every write, and again by
 *  sync's collectState() as a defensive re-trim before the state is pushed. */
export function trimEvents(events: TelemetryEvent[]): TelemetryEvent[] {
  return events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
}

function pruneRollups(rollups: Rollups): Rollups {
  const keys = Object.keys(rollups).sort(); // "YYYY-MM-DD" sorts chronologically
  if (keys.length <= MAX_ROLLUP_DAYS) return rollups;
  const out = { ...rollups };
  for (const k of keys.slice(0, keys.length - MAX_ROLLUP_DAYS)) delete out[k];
  return out;
}

function applyRollup(rollups: Rollups, date: string, skill: string, ok: boolean, ms?: number): void {
  const day = (rollups[date] = rollups[date] ?? {});
  const bucket = (day[skill] = day[skill] ?? { n: 0, ok: 0, msAvg: 0, msN: 0 });
  bucket.n += 1;
  if (ok) bucket.ok += 1;
  if (typeof ms === "number") {
    bucket.msAvg = (bucket.msAvg * bucket.msN + ms) / (bucket.msN + 1);
    bucket.msN += 1;
  }
}

/** Only "review" carries the {skill, ok, ms} triple the rollups track —
 *  everything else (again, choice_wrong, replay, …) is a supplementary
 *  signal read straight off the raw event log by the learner model, so it
 *  isn't double-counted into the accuracy aggregate here. */
function rollupSignal(type: EventType, data: Record<string, unknown>): { skill: string; ok: boolean; ms?: number } | null {
  if (type !== "review") return null;
  const skill = typeof data.skill === "string" ? data.skill : "other";
  const ok = !!data.ok;
  const ms = typeof data.ms === "number" ? data.ms : undefined;
  return { skill, ok, ms };
}

export function logEvent<T extends EventType>(type: T, data: EventPayloads[T]): void {
  const events = trimEvents([...loadEvents(), { t: Date.now(), date: todayKey(), type, data: data as Record<string, unknown> }]);
  save("events", events);

  const signal = rollupSignal(type, data as Record<string, unknown>);
  if (signal) {
    const rollups = loadRollups();
    applyRollup(rollups, todayKey(), signal.skill, signal.ok, signal.ms);
    save("rollups", pruneRollups(rollups));
  }
}

export function getEvents(): TelemetryEvent[] {
  return loadEvents();
}

export function getRollups(): Rollups {
  return loadRollups();
}
