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
  const playhead = async (): Promise<number> =>
    page.evaluate(() => document.querySelector("audio")!.currentTime);

  /*
    THE ASSERTION A RESTART CANNOT SATISFY, AND TWO EARLIER ONES THAT COULD.

    The first polled for `currentTime` to pass the previous page's reading
    inside fifteen seconds, justified by "a restart would have to play all the
    way there again from zero, and the poll gives up first". Arithmetically
    false: those readings are two and four seconds. It passed whether the
    position was remembered or thrown away. The second sampled the moment
    `paused` turned false — before the seek lands, since `preload="none"`
    restores on `loadedmetadata` — and failed against a working product.

    What a restart cannot do at ANY instant is be further along than the
    document has been open: playback begun here has advanced at most as far as
    the wall clock since the navigation started, so `at - open` stays at or
    below zero forever. Polling it is therefore safe, and it tolerates the seek
    landing whenever it lands.
  */
  const arriveAlreadyAhead = async (
    path: string,
    margin: number,
  ): Promise<void> => {
    const startedAt = Date.now();

    await page.goto(path);
    await page.waitForLoadState("load");

    await expect
      .poll(async () => (await playhead()) - (Date.now() - startedAt) / 1000, {
        timeout: 15_000,
      })
      .toBeGreaterThan(margin);
  };

  // The first document has nothing to resume from: it only has to play.
  await page.goto("/");
  await page.waitForLoadState("load");
  await expect.poll(playhead, { timeout: 15_000 }).toBeGreaterThan(2);

  // These two arrive already further along than they have existed.
  await arriveAlreadyAhead("/transmision", 1);
  await expect.poll(playhead, { timeout: 15_000 }).toBeGreaterThan(4);

  await arriveAlreadyAhead("/", 3);
});
