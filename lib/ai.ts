// AI coach integration.
// Two modes, both optional:
//  1. FREE: build a rich coaching prompt → copy → paste into any Claude chat.
//  2. BYOK: if the learner saves their own Anthropic API key, ask in-app.
// The key stays in localStorage on this device only.

import type { Profile } from "./profile";
import type { LearnerModel } from "./model";

export interface ConfusionWord {
  de: string;
  en: string;
  confusedWithDe: string;
  confusedWithEn: string;
  count: number;
}

export interface CoachData {
  profile: Profile;
  streak: number;
  totalReviews: number;
  weekBySkill: Record<string, number>;
  wordsSeen: number;
  wordsTotal: number;
  /** The full behavioral model (rollups + events + FSRS + profile) — given
   *  to the AI verbatim so it reasons from real behavior, not just totals. */
  model: LearnerModel;
  /** model.confusions with the raw vocab ids resolved to actual words, so
   *  the AI (and the prompt reader) can see e.g. "ie" vs "ei" by name. */
  confusionWords: ConfusionWord[];
}

export function buildCoachPrompt(d: CoachData): string {
  const focus = d.profile.focus.length ? d.profile.focus.join(", ") : "none chosen";
  const week = Object.entries(d.weekBySkill)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "no activity yet";
  const confusionsText = d.confusionWords.length
    ? d.confusionWords.map((c) => `- "${c.de}" (${c.en}) picked instead of "${c.confusedWithDe}" (${c.confusedWithEn}) — ${c.count}x`).join("\n")
    : "none logged yet";

  return `You are "Opa", a warm, encouraging German grandfather and expert language coach in a learning app. Address me directly. Be concrete and brief.

MY PROFILE
- Self-assessed level: ${d.profile.level}
- Target level: ${d.profile.goal} (reason: ${d.profile.goalWhy})
- Time per day: ${d.profile.minutes} minutes
- My chosen focus skills: ${focus}

MY LAST 7 DAYS
- Current streak: ${d.streak} days
- Total reviews ever: ${d.totalReviews}
- This week by skill: ${week}
- Vocabulary progress: ${d.wordsSeen}/${d.wordsTotal} words started

MY TOP CONFUSIONS (listening: word I picked when this was the correct answer)
${confusionsText}

MY FULL BEHAVIORAL MODEL (raw JSON — per-skill accuracy/trend/latency/skip-rate over 7d and 30d, vocab maturity, confusion pairs, struggling/cruising skills, level-up and overload flags)
${JSON.stringify(d.model)}

PLEASE REPLY WITH EXACTLY THESE SECTIONS
1. **Opas Einschätzung** (2-3 sentences): honest assessment of my balance and pace toward ${d.profile.goal}, grounded in the numbers above.
2. **Diese Woche**: my single most important focus for this week and why — refer to whichever skill's accuracy/trend/skip-rate justifies it.
3. **Verwechslungen**: comment specifically on my top confusions (if any) — why these two words likely get mixed up, and a one-line trick to tell them apart.
4. **Drei Anpassungen**: three concrete, small adjustments to my daily routine (each one line).
5. **Ein Satz für dich**: one German sentence at my level to learn today, with translation.

Keep the whole reply under 280 words. Sprinkle in a little German (with translations) like a real Opa would.`;
}

export async function askClaude(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const msg = res.status === 401 ? "Invalid API key" : `API error ${res.status}`;
    throw new Error(msg);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === "text")?.text ?? "(empty reply)";
}
