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

  await test.step("/vocab: recall guess, then flip and grade", async () => {
    await page.goto("/vocab");
    await expect(page.locator(".flip-scene")).toBeVisible();
    // Recall prompt is on by default — type a guess, check & reveal (never
    // auto-grades: the learner still picks Again/Hard/Good/Easy themselves).
    const recallInput = page.getByPlaceholder("What does this word mean?");
    await expect(recallInput).toBeVisible();
    await recallInput.fill("something");
    await page.getByRole("button", { name: "Check & reveal" }).click();
    await expect(page.locator(".flip-inner")).toHaveClass(/flipped/);
    await page.getByRole("button", { name: "Good", exact: true }).click();
  });

  await test.step("/vocab: card back is fully visible, no clipping, at mobile width (360px)", async () => {
    // Fake SpeechRecognition so the "Sag es!" buttons render and produce a
    // result — used below to grow the back face (WordMatch + transcript)
    // after it's already on screen, without needing a real mic/network.
    await page.addInitScript(() => {
      class FakeRecognition {
        lang = "de-DE";
        interimResults = false;
        maxAlternatives = 1;
        onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null = null;
        onerror: (() => void) | null = null;
        onend: (() => void) | null = null;
        start() {
          setTimeout(() => {
            this.onresult?.({ results: { 0: { 0: { transcript: "haben" } } } as unknown as { 0: { 0: { transcript: string } } } });
            this.onend?.();
          }, 10);
        }
        stop() {}
      }
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
    });

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/vocab");
    await expect(page.locator(".flip-scene")).toBeVisible();
    const skipRecall = page.getByRole("button", { name: "Just show me" });
    if (await skipRecall.isVisible().catch(() => false)) {
      await skipRecall.click();
    } else {
      await page.locator(".flip-scene").click();
    }
    await expect(page.locator(".flip-inner")).toHaveClass(/flipped/);

    const back = page.locator(".flip-face.back");
    await expect(back).toBeVisible();
    // The old position:absolute layout gave the container the shorter
    // (front) face's height, so a taller back face got an inner scrollbar
    // and hid content. The height fix auto-sizes to the taller face, so
    // nothing inside should overflow its own box.
    const overflow = () => back.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(await overflow(), "back face should not need an internal scrollbar").toBeLessThanOrEqual(1);

    const wordBack = page.locator(".word-back");
    await expect(wordBack).toBeVisible();
    const wordBox = await wordBack.boundingBox();
    const backBox = await back.boundingBox();
    expect(wordBox, "German word on back face should have a bounding box").not.toBeNull();
    expect(backBox, "back face should have a bounding box").not.toBeNull();
    expect(wordBox!.y).toBeGreaterThanOrEqual(backBox!.y - 1);

    // Now grow the back face AFTER it's already rendered: trigger "Sag es!"
    // feedback (WordMatch + transcript line), which the ResizeObserver in
    // useFlipHeight — not any dep array — is what must catch.
    await page.getByRole("button", { name: "🎙️ Nur das Wort" }).click();
    await expect(page.getByText("Recognized: „haben“")).toBeVisible();
    expect(await overflow(), "back face should not overflow after Sag-es feedback grows it").toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1280, height: 800 });
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

  await test.step("/grammar: A0/A1 learners get tap-to-fill tiles, not text input", async () => {
    await page.goto("/grammar");
    await page.locator(".topic-head").first().click();
    // Scope to the specific exercise ("newspaper", answer "Die") so tapping
    // "Die" can't accidentally hit a different exercise's tile.
    const exercise = page.locator("p", { hasText: "Zeitung liegt auf dem Tisch" }).locator("..");
    await expect(page.locator(".topic-body input[type='text']")).toHaveCount(0);
    await exercise.getByRole("button", { name: "Die", exact: true }).click();
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

  await test.step("/abc: FSRS card practice — flip, grade, and speak() fires", async () => {
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
    await expect(page.locator(".flip-scene")).toBeVisible();
    await page.getByRole("button", { name: "Show answer" }).click();
    await expect(page.locator(".flip-inner")).toHaveClass(/flipped/);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    const speakCalls = await page.evaluate(() => (window as unknown as { __speakCalls: string[] }).__speakCalls.length);
    expect(speakCalls, "speechSynthesis.speak should fire when an abc card appears").toBeGreaterThan(0);
  });

  expect(pageErrors, `unexpected page errors: ${pageErrors.map((e) => e.message).join("; ")}`).toEqual([]);
});
