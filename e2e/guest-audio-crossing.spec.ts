import { expect, test } from "@playwright/test";

/**
 * MOVING BETWEEN THE TWO PUBLIC PAGES, WHICH IS WHAT THE COUPLE ACTUALLY DO.
 *
 * "Si estoy en /transmision o en / al poner la canción pueda moverme libremente
 * entre las dos sin que la canción se pare, sino que sea fluido."
 *
 * They cross by typing the URL, and they have to: outside the final week the
 * landing's door to the stream is a DISABLED BUTTON rather than a link —
 * decided in `components/landing/StreamLink.tsx`, thirty-eight minutes before
 * the shared layout that keeps the song alive across a `<Link>` existed. So
 * that layout's guarantee has never applied in this direction, and nothing
 * recent took it away. `/transmision` -> `/` does have a link, and
 * `guest-audio.spec.ts` covers it.
 *
 * A typed URL builds a new document every time, and no browser keeps a sound
 * playing across that. What makes it fluid instead is the remembered position
 * plus a browser willing to start the song without being asked again — which is
 * what a browser grants a site the visitor has already played media on.
 *
 * WHY THIS IS ITS OWN FILE. `launchOptions` cannot be scoped to a `describe`,
 * and the rest of the audio suite needs the opposite setting: the assertion
 * that the page says nothing until it is touched is only meaningful in a
 * browser that refuses autoplay.
 *
 * THE FLAG IS THE POINT. Playwright's Chromium refuses autoplay, and that
 * refusal hides the entire question — every assertion here would be about a
 * silent page. Granting it is what lets the round trip be measured at all, and
 * it is the state a returning guest's browser is actually in.
 */
test.use({
  launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
});

test("crossing between the public pages by URL never drops back to the first bar", async ({
  page,
}) => {
  const elapsed = async (): Promise<number> =>
    page.evaluate(() => document.querySelector("audio")!.currentTime);

  const playingPast = async (mark: number): Promise<void> => {
    await page.waitForLoadState("load");
    await expect.poll(elapsed, { timeout: 15_000 }).toBeGreaterThan(mark);
  };

  await page.goto("/");
  await playingPast(1.5);
  const landing = await elapsed();

  await page.goto("/transmision");
  /*
    Past where the LANDING left off, which is the whole assertion. A restart
    would have to play all the way there again from zero, and the poll gives up
    first — so this cannot pass on a song that began afresh.
  */
  await playingPast(landing);
  const stream = await elapsed();

  await page.goto("/");
  await playingPast(stream);
});
