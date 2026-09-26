import { describe, expect, it } from "vitest";

import { ENGAGEMENT_PHOTO, WEDDING_PHOTO } from "./photos";

/**
 * THE CROP THAT DECIDES WHETHER THE INVITATION SHOWS THE COUPLE.
 *
 * `/i/[slug]` lays its words over the wedding photograph, which means the
 * photograph fills a phone viewport, which means it is cropped: it is 0.75:1
 * and a phone is nearer 0.5:1, so about a third of its width is thrown away.
 * The two people stand left and right of centre, so the discarded third is
 * either the empty edges or somebody's feet, and NOTHING FAILS EITHER WAY. The
 * page renders, the layout is correct, every other test stays green, and the
 * picture is of a waterfall.
 *
 * That is exactly the defect the couple reported on the first day — "la imagen
 * se ve súper grande con zoom" — so the crop gets a test rather than a comment.
 *
 * WHAT IS MEASURED, AND BY WHOM. The span below was read off the file with a
 * pixel ruler laid over it: Michell's dress at the left, the sole of Luis's
 * trailing shoe at the right. It lives in this spec rather than in the source
 * because it is an observation about the image, not something the application
 * needs at runtime — and because a test whose fixture came from the code it
 * tests would only prove the code agrees with itself.
 *
 * WHAT THE ARITHMETIC IS, SINCE IT IS THE PART THAT IS EASY TO GET WRONG.
 * `object-position: p%` does NOT put the point `p%` of the image in the middle
 * of the box. It distributes the OVERFLOW: at `0%` the left edges align, at
 * `100%` the right edges do, and at `p` the visible window starts `p ×
 * overflow` into the image. The overflow depends on the viewport's shape, so
 * one percentage lands in a different place on every phone — which is why the
 * first estimate for this value, taken as "the couple's centre is at 55.5% of
 * the width, so use 55%", put Luis's shoe on the edge of a Pixel 7.
 */

/** The wedding photograph's own pixels, as the file holds them. */
const SOURCE = { width: 1800, height: 2400 } as const;

/**
 * Where the couple are, measured on the file in its own pixels.
 *
 * Left: the outer edge of Michell's dress. Right: the sole of Luis's trailing
 * shoe. Both are the outermost point of a person, not of their shadow — a
 * shadow leaving the frame is a crop, a foot leaving it is a mistake.
 */
const COUPLE = { left: 485, right: 1545 } as const;

/** The two phones the invitation is measured on, in CSS pixels. */
const PHONES = [
  { name: "iPhone 14", width: 390, height: 664 },
  { name: "Pixel 7", width: 412, height: 839 },
] as const;

/**
 * The slice of the source image a `cover` crop shows, in source pixels.
 *
 * The image is scaled until it covers the box; on every phone shape here that
 * means the HEIGHT binds, so the scale is `height / 2400` and the horizontal
 * overflow is whatever is left of the width.
 */
function visibleSpan(
  position: number,
  viewport: { readonly width: number; readonly height: number },
): { readonly left: number; readonly right: number } {
  const cropWidth = (SOURCE.height * viewport.width) / viewport.height;
  const overflow = SOURCE.width - cropWidth;
  const left = position * overflow;

  return { left, right: left + cropWidth };
}

/** The declared focus as a number, so the arithmetic above can use it. */
function declaredPosition(focus: string): number {
  const match = /^(\d+(?:\.\d+)?)% center$/.exec(focus);

  if (match === null) {
    throw new Error(
      `The wedding photograph's overlay focus is "${focus}", which this spec ` +
        "cannot read. It expects a horizontal percentage and a vertical " +
        "keyword, because the crop is horizontal: the height always binds.",
    );
  }

  return Number(match[1]) / 100;
}

describe("the wedding photograph's crop on a phone", () => {
  it("declares where to look, because the picture is not the phone's shape", () => {
    expect(WEDDING_PHOTO.overlayFocus).toBeDefined();
  });

  it.each(PHONES)("holds both people on a $name", (phone) => {
    const focus = declaredPosition(WEDDING_PHOTO.overlayFocus!);
    const visible = visibleSpan(focus, phone);

    expect(visible.left).toBeLessThan(COUPLE.left);
    expect(visible.right).toBeGreaterThan(COUPLE.right);
  });

  /**
   * AND IT HOLDS THEM WITH ROOM, WHICH IS A DIFFERENT CLAIM.
   *
   * A crop that ends exactly at the sole of a shoe is a crop that clips it on
   * the first phone half a pixel narrower than the one it was tuned on. Forty
   * source pixels is about fifteen CSS pixels on the tighter of the two phones
   * — visible as a margin, small enough that the couple still fill the frame.
   */
  it.each(PHONES)("keeps them off the edge on a $name", (phone) => {
    const focus = declaredPosition(WEDDING_PHOTO.overlayFocus!);
    const visible = visibleSpan(focus, phone);

    expect(COUPLE.left - visible.left).toBeGreaterThan(40);
    expect(visible.right - COUPLE.right).toBeGreaterThan(40);
  });

  /**
   * THE DEFAULT IS THE ONE THAT WAS WRONG, AND IT WAS WRONG SILENTLY.
   *
   * A centred cover crop — what `object-cover` does with no help — cuts Luis
   * off on the narrower phone. Asserted so that deleting the focus is a red
   * test rather than a picture nobody looks at again until the invitations are
   * already sent.
   */
  it("would cut Luis off if the crop were simply centred", () => {
    const centred = visibleSpan(0.5, { width: 412, height: 839 });

    expect(centred.right).toBeLessThan(COUPLE.right);
  });

  /**
   * AND THE CROP IS HORIZONTAL ONLY, WHICH IS WHY `overlayFocus` NAMES ONE AXIS.
   *
   * `visibleSpan` above asserts this by assuming it — it divides by the
   * viewport's height and treats the whole picture height as visible — and an
   * assumption a spec depends on should be a line in the spec rather than a
   * sentence in a comment.
   *
   * It also answers a question that gets asked of this file whenever something
   * on `/i/[slug]` lands on the couple: can the crop be nudged DOWNWARDS, so
   * they fall lower in the frame and the words above them get clear sky? No,
   * and not as a matter of taste. A `cover` crop scales until the shorter
   * constraint is satisfied; on a picture this much wider in ratio than a
   * phone, that is the HEIGHT. The scaled width then exceeds the screen and the
   * scaled height equals it exactly, so there is no vertical overflow for an
   * `object-position` to distribute and `68% center`, `68% top` and
   * `68% bottom` are the same picture.
   *
   * Where the couple sit vertically is therefore the photograph's own and not a
   * value anything can tune. Anything that needs a clear ground beneath the
   * words has to bring one.
   */
  it.each(PHONES)("has nothing to crop vertically on a $name", (phone) => {
    const scale = phone.height / SOURCE.height;
    const scaledWidth = SOURCE.width * scale;

    // The height binds: covering the box by width alone would leave a gap.
    expect(scaledWidth).toBeGreaterThan(phone.width);
    expect(SOURCE.height * scale).toBeCloseTo(phone.height, 10);
  });
});

describe("the engagement photograph", () => {
  /**
   * NOTHING TO DECLARE, AND THE ABSENCE IS THE POINT.
   *
   * 737×1600 is 0.4606:1 and a phone is about 0.462:1 — the same shape to three
   * decimals — so the landing contains it whole and crops nobody. A focus here
   * would be an instruction to crop a picture that does not need cropping, on
   * the one page the couple have already approved.
   */
  it("needs no focus, because it is already the phone's shape", () => {
    expect(ENGAGEMENT_PHOTO.overlayFocus).toBeUndefined();
  });
});
