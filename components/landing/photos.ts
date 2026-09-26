import boda from "@/img/boda.jpg";
import compromiso from "@/img/compromiso.jpg";

import type { StagePhoto } from "./PhotoStage";

/**
 * The wedding's photographs, each with what it shows.
 *
 * ONE DEFINITION PER PHOTOGRAPH, FOR THE REASON `PhotoStage` GIVES FOR ITSELF:
 * two would drift into two different weddings. Three pages now stand on these —
 * the landing, the stream invitation and the household invitation — and the
 * description is the part that rots silently. An `alt` copied to a second page
 * and then only half updated is a confident, wrong answer for the reader who
 * needs it most.
 *
 * The dimensions are not written here. They come from the static import, which
 * is the file itself: a number typed alongside it would be a second opinion
 * about the same picture, and the wedding photograph already taught that lesson
 * — its EXIF said one shape and its pixels another, and a frame drawn at the
 * wrong ratio does not fail loudly, it crops and looks deliberate.
 *
 * Guest-facing copy is Spanish. Identifiers and comments stay English.
 */

/** The engagement photograph: 737×1600, 0.46:1 — a phone's own shape. */
export const ENGAGEMENT_PHOTO: StagePhoto = {
  src: compromiso,
  alt: "Luis y Michell abrazados en un sendero, con una cascada iluminada detrás",
};

/**
 * The proposal: 1800×2400, 0.75:1.
 *
 * Portrait, but nothing like a phone: filling a phone viewport with it discards
 * about a third of its width, and the two people stand left and right of
 * centre.
 *
 * THIS FILE USED TO SAY THAT MEANT THE PICTURE COULD NOT FILL A PHONE AT ALL —
 * "a fill crop clips both of them. It belongs in a frame, with the words
 * beneath it rather than on it." Half right. A CENTRED fill crop clips Luis;
 * the couple are 1060 pixels wide in an 1800-pixel picture and a Pixel 7 shows
 * 1178 of them, so they fit with room to spare once the crop is told where to
 * look. What the sentence was really describing is the absence of the
 * instruction below.
 *
 * It matters because the frame it recommended is what cost the invitation its
 * single screen: a strip of photograph at the top and every block stacked
 * beneath it is two and a half viewports on a phone, against the landing's one.
 */
export const WEDDING_PHOTO: StagePhoto = {
  src: boda,
  alt: "Luis, de rodillas frente a una cascada iluminada de noche, le pide matrimonio a Michell",
  /*
    68%, MEASURED ON THE FILE AND CHECKED ON BOTH PHONES.

    Michell's dress reaches x=485 and the sole of Luis's trailing shoe reaches
    x=1545, so the couple occupy 485–1545 of 1800. A Pixel 7 is the tighter of
    the two phones the invitation is measured on — it is the narrower shape, so
    it keeps less of the width — and 68% centres that window almost exactly on
    the pair: it shows 423–1601, about sixty pixels clear at each end. An
    iPhone 14 keeps more width still and has over a hundred at each end.

    NOT 55%, WHICH IS WHAT THE COUPLE'S CENTRE WOULD SUGGEST. `object-position`
    distributes the OVERFLOW rather than naming a point in the picture, so the
    percentage that centres a subject depends on how much is being cropped —
    55% leaves Luis's shoe nine pixels from the edge of a Pixel 7, and 50%
    takes it off. `photos.spec.ts` does that arithmetic on both phones, because
    a crop that loses somebody renders perfectly.

    The limit, stated rather than discovered later: the couple span 59% of the
    width, so a phone narrower than about 0.41:1 cannot hold both of them at
    any focus. On a 360×800 screen — the narrowest in common use — 68% takes a
    few pixels off the hem of Michell's dress. That is the picture's shape, not
    a value that can be tuned.
  */
  overlayFocus: "68% center",
};
