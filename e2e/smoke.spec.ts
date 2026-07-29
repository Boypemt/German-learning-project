import { test, expect } from "@playwright/test";

// One long, linear smoke flow (not many isolated tests) because most steps
// depend on a profile already existing in localStorage from the /start
// interview completed at the top — sharing the page keeps that state.

test("A0 learner: interview -> dashboard -> vocab -> listening -> grammar -> garten -> konto", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  await test.step("first visit: welcome screen, start the interview", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: /start the interview/i }).click();
    await expect(page).toHaveURL(/\/start/);
  });

  await test.step("complete the /start interview as A0", async () => {
    await page.getByRole("button", { name: /Ganz neu/ }).click(); // level: complete beginner (A0)
    await page.getByRole("button", { name: /Alltag & Reisen/ }).click(); // goal: B2
    await page.getByRole("button", { name: /30 min/ }).click(); // minutes
    await page.getByRole("button", { name: /Opa entscheidet/ }).click(); // skip focus picks
    await page.getByRole("button", { name: /Los geht/ }).click(); // finish -> redirects to "/"
    await expect(page).toHaveURL("/");
  });

  await test.step("dashboard shows the daily plan with Das ABC first", async () => {
    const firstStep = page.locator(".plan-step").first();
    await expect(firstStep).toContainText("Das ABC");
  });

  await test.step("/vocab: flip a card and grade it", async () => {
    await page.goto("/vocab");
    await expect(page.locator(".flip-scene")).toBeVisible();
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.locator(".flip-inner")).toHaveClass(/flipped/);
    await page.getByRole("button", { name: "Good", exact: true }).click();
  });

  await test.step("beginner /listening shows multiple-choice spelling and answers one", async () => {
    await page.goto("/listening");
    await expect(page.getByText(/Which spelling matches/i)).toBeVisible();
    // A brand-new profile has no accuracy history yet, which the adaptive
    // difficulty rule (lib/adapt.ts) treats the same as "struggling" (0%),
    // so it starts at 3 choices rather than the normal 4.
    const choiceButtons = page.locator(".card button.big");
    await expect(choiceButtons).toHaveCount(3);
    await choiceButtons.first().click();
    await expect(page.getByRole("button", { name: /Weiter/ })).toBeVisible();
  });

  await test.step("/grammar checks one exercise", async () => {
    await page.goto("/grammar");
    await page.locator(".topic-head").first().click();
    const input = page.locator(".topic-body input[type='text']").first();
    await input.fill("Die");
    await page.locator(".topic-body").first().getByRole("button", { name: "Check" }).first().click();
    await expect(page.locator(".feedback-banner.ok").first()).toBeVisible();
  });

  await test.step("/garten renders and shows Taler", async () => {
    await page.goto("/garten");
    await expect(page.getByText(/🪙\s*\d+\s*Taler/)).toBeVisible();
    await expect(page.locator(".shop-grid")).toBeVisible();
  });

  await test.step("/konto renders in local-only mode", async () => {
    await page.goto("/konto");
    await expect(page.getByText(/local-only mode/i)).toBeVisible();
  });

  await test.step("/abc: replay controls exist and speak() fires when a question appears", async () => {
    // Spy on speechSynthesis.speak before the next navigation so app code
    // picks up the wrapped version — guards against the regression where
    // audio silently stopped firing when a setTimeout wrapper was removed.
    await page.addInitScript(() => {
      (window as unknown as { __speakCalls: string[] }).__speakCalls = [];
      if (window.speechSynthesis) {
        const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
          (window as unknown as { __speakCalls: string[] }).__speakCalls.push(u.text);
          return orig(u);
        };
      }
    });
    await page.goto("/abc");
    await page.getByRole("button", { name: /Quiz starten/ }).click();
    await expect(page.getByRole("button", { name: /Nochmal hören/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Langsam/ })).toBeVisible();
    const speakCalls = await page.evaluate(() => (window as unknown as { __speakCalls: string[] }).__speakCalls.length);
    expect(speakCalls, "speechSynthesis.speak should fire when a quiz question appears").toBeGreaterThan(0);
  });

  expect(pageErrors, `unexpected page errors: ${pageErrors.map((e) => e.message).join("; ")}`).toEqual([]);
});
