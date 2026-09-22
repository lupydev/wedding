import { expect, test, type Page } from "@playwright/test";

/**
 * The two pages every guest can reach without a link of their own.
 *
 * THERE WAS NO BROWSER TEST FOR EITHER OF THEM, AND IT COST TWO REGRESSIONS.
 *
 * `/` and `/transmision` have component tests for their copy and unit tests
 * for their data, and between them those cover every string on the page. What
 * nothing covered is the page ASSEMBLED: whether two components each rendering
 * one correct line put that line on screen twice, and whether the words end up
 * beside the photograph or crushed against the top of the window.
 *
 * Both of those shipped. Both were found by the couple opening the site on
 * their own monitor, which is not a test strategy. This file is where that
 * class of defect gets caught from now on.
 */

/** Lu's own window, which is where both defects were visible. */
const DESKTOP = { width: 1920, height: 1080 } as const;

const PAGES = [
  { path: "/", name: "the landing" },
  { path: "/transmision", name: "the stream invitation" },
] as const;

/**
 * The announcement's own script line.
 *
 * `SaveTheDate` owns it. Anything that renders the block and ALSO writes the
 * line is saying it twice.
 */
const ANNOUNCEMENT = "Nos casamos";

async function openAt(page: Page, path: string): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("the announcement is made once", () => {
  for (const { path, name } of PAGES) {
    test(`${name} says "${ANNOUNCEMENT}" once`, async ({ page }) => {
      await openAt(page, path);

      await expect(page.getByText(ANNOUNCEMENT, { exact: true })).toHaveCount(
        1,
      );
    });
  }
});

/**
 * THE WORDS SIT BESIDE THE PHOTOGRAPH, NOT ABOVE IT.
 *
 * At `lg` the stage is two columns: the framed print in the first, the words in
 * the second. The print sticks, so the grid's cells STRETCH — that is what
 * makes a long form scroll past a stationary picture. On these two pages the
 * words are far shorter than the print, so a stretched cell whose child is only
 * as tall as its own content leaves the words pinned to the top with several
 * hundred pixels of empty ground beneath them, beside a picture that runs the
 * full height.
 *
 * `justify-center` on that child does nothing about it: it centres content
 * within a box that is already exactly as tall as the content.
 *
 * Measured against the print rather than against the viewport, because the
 * print is what the reader is comparing it to.
 */
test.describe("the words are level with the photograph", () => {
  for (const { path, name } of PAGES) {
    test(`${name} centres its column beside the print`, async ({ page }) => {
      await openAt(page, path);

      const print = (await page
        .locator("figure.photo-stage__frame")
        .boundingBox())!;
      /*
        THE CONTENT, NOT THE CELL THAT HOLDS IT.

        `div.photo-stage__column` is the grid item, and the cells stretch — so
        its own box runs the full height of the row and its centre matches the
        print's centre whatever happens inside it. Measuring that box is an
        assertion that cannot fail: it passed with the words pinned to the top
        and several hundred pixels of empty ground under them, which is the
        exact defect this test exists for.
      */
      const words = (await page
        .locator("div.photo-stage__column > div")
        .boundingBox())!;

      const printCentre = print.y + print.height / 2;
      const wordsCentre = words.y + words.height / 2;

      // Within a small fraction of the print's own height. Generous enough to
      // survive a padding tweak, tight enough that top-aligned words fail.
      expect(Math.abs(wordsCentre - printCentre)).toBeLessThanOrEqual(60);
    });
  }
});
