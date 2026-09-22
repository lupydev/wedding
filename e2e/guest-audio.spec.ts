import { expect, test, type Page } from "@playwright/test";

import { seedInvitation } from "./helpers/seed";

/**
 * The one song, and whether it actually survives the way a guest moves around.
 *
 * TWO LAYOUTS MOUNT THE CONTROL, AND BOTH JUSTIFY THEMSELVES BY A CLAIM NOTHING
 * CHECKED.
 *
 * `app/(public)/layout.tsx` says the control lives in a layout rather than on
 * each page because "Layouts do not re-render on navigation" — so the `<audio>`
 * element persists, the song keeps playing, and a guest following a link does
 * not hear it restart. `app/i/[slug]/layout.tsx` makes the same argument for
 * the invitation.
 *
 * That is an architectural claim about element identity across a navigation,
 * and a component test cannot see it: it needs a real router and a real
 * document. Asserting the element is PRESENT proves nothing — a remounted one
 * is also present, with the song back at zero.
 *
 * So these tests tag the element and check the tag is still there afterwards.
 */

/** Marks the current `<audio>` element and reports what it was already. */
async function audioState(
  page: Page,
): Promise<{ paused: boolean; currentTime: number; survived: boolean }> {
  return page.evaluate(() => {
    const audio = document.querySelector<
      HTMLAudioElement & { __tagged?: boolean }
    >("audio")!;
    const survived = audio.__tagged === true;
    audio.__tagged = true;

    return { paused: audio.paused, currentTime: audio.currentTime, survived };
  });
}

/**
 * Starts the song the way a guest does: by touching the page.
 *
 * The control's whole fallback exists for this — no browser plays audio on a
 * page nobody has interacted with, so the first gesture anywhere is what gets
 * asked to start it.
 */
async function startByTouchingThePage(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.locator("main").click({ position: { x: 20, y: 20 } });

  /*
    WAIT FOR REAL PROGRESS, NOT MERELY FOR `paused` TO FLIP.

    The continuity assertions compare `currentTime` across a navigation, and a
    song that has only just started is still at 0 — so an eager baseline makes
    "it did not restart" compare zero to zero and prove nothing in either
    direction. Half a second of actual playback is a baseline a reset cannot
    match.
  */
  await expect
    .poll(async () => (await audioState(page)).currentTime, { timeout: 15_000 })
    .toBeGreaterThan(0.5);
}

test.describe("the song a guest hears", () => {
  /**
   * SILENT ON ARRIVAL, WHICH IS NOT A COURTESY BUT THE BROWSER'S RULE.
   *
   * Worth asserting anyway: the page is opened at work and beside sleeping
   * babies, and the day this starts playing by itself is a defect even where a
   * browser would allow it.
   */
  test("says nothing until the guest touches the page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    expect((await audioState(page)).paused).toBe(true);
  });

  test("starts at the first touch anywhere on the page", async ({ page }) => {
    await page.goto("/");

    // Throws if it never starts.
    await startByTouchingThePage(page);
  });

  /**
   * AND KEEPS PLAYING ACROSS A LINK BETWEEN THE TWO PUBLIC PAGES.
   *
   * `/transmision` -> `/` is the direction that has a link today: the landing's
   * door to the stream opens only in the final week, so until then a guest
   * cannot go the other way and nothing is being measured by pretending
   * otherwise.
   */
  test("keeps playing from /transmision to the landing", async ({ page }) => {
    await page.goto("/transmision");
    await startByTouchingThePage(page);
    const before = await audioState(page);

    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);

    const after = await audioState(page);
    expect(after.survived).toBe(true);
    expect(after.paused).toBe(false);
    // A restart lands back at 0. Anything from the baseline on is the same
    // playback continuing, whether or not a frame elapsed in between.
    expect(after.currentTime).toBeGreaterThanOrEqual(before.currentTime);
  });

  /**
   * THROUGH THE LANDING'S OWN DOOR, WHICH IS THE JOURNEY THE LAYOUT WAS BUILT
   * FOR AND WHICH NOTHING HAD EVER EXERCISED.
   *
   * The couple, after hearing the typed-URL hop: "probé dando click en la
   * landing y empieza a sonar la canción, pero cuando en la url ingreso a
   * /transmision hay un pequeño corte y la canción continúa sin problema."
   *
   * That cut is real and unavoidable there — a typed URL is a new document, so
   * the file is fetched and the position sought again, and the seek is audible.
   * The `<Link>` is the path with no cut at all, because the `<audio>` element
   * is never torn down: that is the entire reason `app/(public)/layout.tsx`
   * exists.
   *
   * IT NEEDS THE CLOCK MOVED, AND THAT IS WHY IT WAS NEVER TESTED. Outside the
   * final week `StreamLink` renders a disabled `<button>` instead of a link, so
   * on any ordinary day there is nothing here to click. `setFixedTime` moves
   * only `Date.now()` and `new Date()` and leaves timers running, which is
   * exactly what the component reads — and what `46dbbac` did by hand, once,
   * without leaving a test behind.
   *
   * THE ELEMENT'S IDENTITY IS THE ASSERTION, and it is the one a restart cannot
   * fake: a remounted `<audio>` has no tag. `currentTime` is checked too, but
   * the tag is what makes this test unable to pass on a broken page.
   */
  test("plays straight through the landing's own link, with no cut", async ({
    page,
  }) => {
    // Inside the final week, so the door is a link. The ceremony is
    // 2026-11-28T17:00-05:00 and the window opens seven days before it.
    await page.clock.setFixedTime(new Date("2026-11-24T12:00:00-05:00"));

    await page.goto("/");
    await startByTouchingThePage(page);

    const door = page.getByRole("link", { name: "Acompáñanos por Zoom" });
    await expect(door).toBeVisible();

    const before = await audioState(page);
    const startedAt = Date.now();

    await door.click();
    await expect(page).toHaveURL(/\/transmision$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const wallClock = (Date.now() - startedAt) / 1000;
    const after = await audioState(page);

    // The same element React never unmounted — the layout's whole promise.
    expect(after.survived).toBe(true);
    expect(after.paused).toBe(false);

    // And never silent: see the unlock test below for why the wall clock is
    // what proves that, and what a torn-down element costs instead.
    expect(wallClock - (after.currentTime - before.currentTime)).toBeLessThan(
      0.25,
    );
  });

  /**
   * AND IT PICKS THE SONG BACK UP AFTER A WHOLE NEW DOCUMENT.
   *
   * The couple, precisely: "abro la landing y pongo a sonar la canción, luego
   * por url agrego /transmision y se pausa la canción y arranca desde el
   * inicio."
   *
   * Typing a URL is not a navigation the router handles — it tears the document
   * down and builds another. Every element dies with it, the `<audio>`
   * included, and no browser API keeps a sound playing across that. The layout
   * argument above is about `<Link>`, and it cannot reach this case.
   *
   * What CAN survive is the position. The song remembers where it was for the
   * life of the tab, so the second document starts from there instead of from
   * the first bar.
   *
   * The position, and ONLY the position. This sentence used to promise that a
   * guest who had paused would be left alone on the next page too — a record
   * of that was tried, and it took the gesture fallback with it, so a click
   * stopped starting the song at all. The test below it now says the
   * opposite, deliberately.
   *
   * `page.goto` is exactly the URL bar: a real document load, not a client
   * navigation.
   */
  test("picks the song back up after a typed-URL navigation", async ({
    page,
  }) => {
    await page.goto("/");
    await startByTouchingThePage(page);

    // Far enough in that a restart cannot be mistaken for a resume.
    await expect
      .poll(async () => (await audioState(page)).currentTime, {
        timeout: 15_000,
      })
      .toBeGreaterThan(2);
    const before = await audioState(page);

    await page.goto("/transmision");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // A brand new element, necessarily — this is a new document.
    const arrival = await audioState(page);
    expect(arrival.survived).toBe(false);

    // The guest touches the page, as they must on any document nobody has
    // interacted with yet.
    await startByTouchingThePage(page);

    const after = await audioState(page);
    expect(after.paused).toBe(false);
    // Near where it left off, not back at the beginning.
    expect(after.currentTime).toBeGreaterThan(before.currentTime - 1);
  });

  /**
   * A TOUCH ALWAYS STARTS THE SONG, WHATEVER HAPPENED ON THE PAGE BEFORE.
   *
   * The couple: "al dar click o interactuar con la landing no inicia la música
   * y lo mismo con /transmision."
   *
   * Remembering the song's place brought a second idea with it — that a guest
   * who had pressed pause should not be asked again on the next page — and that
   * idea is what broke this. The load-time attempt returned early in that case,
   * and the gesture listeners are registered INSIDE that attempt's refusal
   * path, so returning early meant they were never registered at all. A click
   * on the page then did nothing, for the life of the tab.
   *
   * Worse, `playing: false` was written from the `pause` EVENT, which a browser
   * fires for its own reasons — tearing a document down among them. So a guest
   * who never pressed anything could still end up in that state.
   *
   * The fallback is unconditional now. Whatever else is remembered, touching
   * the page starts the song.
   */
  test("starts on a touch even after the song was paused earlier", async ({
    page,
  }) => {
    await page.goto("/");
    await startByTouchingThePage(page);

    // The guest stops it, deliberately, with the control.
    await page.getByRole("button", { name: /Pausar la música/ }).click();
    await expect
      .poll(async () => (await audioState(page)).paused, { timeout: 10_000 })
      .toBe(true);

    // A new document, exactly as typing the next URL gives them.
    await page.goto("/transmision");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("load");

    await page.locator("main").click({ position: { x: 20, y: 20 } });

    await expect
      .poll(async () => (await audioState(page)).paused, { timeout: 10_000 })
      .toBe(false);
  });

  /**
   * AND A PAGE THE GUEST NEVER TOUCHED DOES NOT WIPE THE PLACE.
   *
   * The position is written on `pagehide`, which fires for EVERY document that
   * mounts the control — including one a guest merely passes through. On such
   * a page the song never started, `preload="none"` means the file was never
   * fetched, and `currentTime` is therefore 0. Writing that stores a zero over
   * a real position; and since the read side treats `at <= 0` as nothing to
   * restore, the place is not merely stale afterwards, it is gone.
   *
   * This is exactly a guest whose browser refuses the load-time attempt —
   * which is the couple's — landing on the second page and moving on without
   * tapping. A browser that DOES autoplay hides it completely, which is why
   * the existing typed-URL test never saw this: it plays the song in the
   * second document every time.
   */
  test("does not wipe the place on a page the guest passed through", async ({
    page,
  }) => {
    await page.goto("/");
    await startByTouchingThePage(page);
    await expect
      .poll(async () => (await audioState(page)).currentTime, {
        timeout: 15_000,
      })
      .toBeGreaterThan(2);
    const before = await audioState(page);

    // Straight through, touching nothing: the song never starts here.
    await page.goto("/transmision");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("load");
    expect((await audioState(page)).paused).toBe(true);

    // And on somewhere the guest does settle, the place is still there.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await startByTouchingThePage(page);

    const after = await audioState(page);
    expect(after.currentTime).toBeGreaterThan(before.currentTime - 1);
  });

  /**
   * AND ACROSS THE UNLOCK, WHICH IS THE ONE THAT LOOKS LIKE A PAGE LOAD.
   *
   * A guest types a number and the screen becomes a different screen. It is a
   * server action inside one route, so the layout — and the element — persists.
   * Were it ever to become a form that navigates, the song would restart under
   * a guest mid-verse and every other check would stay green.
   */
  test("plays straight through the invitation's unlock, with no cut", async ({
    page,
  }) => {
    const invitation = await seedInvitation({
      greetingName: "Familia Aguirre",
      guests: [
        { fullName: "Camila Aguirre Vélez", phoneE164: "+573005551111" },
        { fullName: "Rodrigo Aguirre Peña" },
      ],
    });

    try {
      await page.goto(`/i/${invitation.slug}`);
      await expect(page.getByLabel(/Número de celular/)).toBeVisible();
      await startByTouchingThePage(page);

      // Typed before the stopwatch starts: filling the field is the guest's
      // own time, and only the transition is being measured.
      await page.getByLabel(/Número de celular/).fill("+573005551111");
      const before = await audioState(page);
      const startedAt = Date.now();

      await page.getByRole("button", { name: "Ver la invitación" }).click();
      await expect(page.locator(".invitation__rsvp")).toBeVisible();

      const wallClock = (Date.now() - startedAt) / 1000;
      const after = await audioState(page);

      // The same element React never unmounted. THIS is the assertion that
      // discriminates, and the reason the `currentTime` comparison alone no
      // longer would: since the position is remembered, a REMOUNTED element
      // also comes back near where it was. Only the tag tells the difference.
      expect(after.survived).toBe(true);
      expect(after.paused).toBe(false);

      /*
        AND IT WAS NEVER SILENT, WHICH IS WHAT "FLUID" MEANS.

        Playback is realtime, so the playhead cannot advance further than the
        wall clock. If it advanced by AS MUCH as the wall clock, nothing was
        missed — no pause, no re-fetch, no seek. Any gap shows up as wall clock
        the song did not account for.

        A quarter of a second of slack for the round trip that reads the
        element. A torn-down element costs far more: a fresh `<audio>` with
        `preload="none"` has to fetch before it can sound at all.
      */
      const silence = wallClock - (after.currentTime - before.currentTime);
      expect(silence).toBeLessThan(0.25);
    } finally {
      await invitation.cleanup();
    }
  });
});
