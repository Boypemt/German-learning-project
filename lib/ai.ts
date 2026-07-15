// AI coach integration.
// Two modes, both optional:
//  1. FREE: build a rich coaching prompt → copy → paste into any Claude chat.
//  2. BYOK: if the learner saves their own Anthropic API key, ask in-app.
// The key stays in localStorage on this device only.

import type { Profile } from "./profile";

export interface CoachData {
  profile: Profile;
  streak: number;
  totalReviews: number;
  weekBySkill: Record<string, number>;
  wordsSeen: number;
  wordsTotal: number;
}

export function buildCoachPrompt(d: CoachData): string {
  const focus = d.profile.focus.length ? d.profile.focus.join(", ") : "none chosen";
  const week = Object.entries(d.weekBySkill)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "no activity yet";

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

PLEASE REPLY WITH EXACTLY THESE SECTIONS
1. **Opas Einschätzung** (2-3 sentences): honest assessment of my balance and pace toward ${d.profile.goal}.
2. **Diese Woche** : my single most important focus for this week and why.
3. **Drei Anpassungen**: three concrete, small adjustments to my daily routine (each one line).
4. **Ein Satz für dich**: one German sentence at my level to learn today, with translation.

Keep the whole reply under 250 words. Sprinkle in a little German (with translations) like a real Opa would.`;
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
