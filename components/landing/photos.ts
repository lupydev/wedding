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
 * Portrait, but nothing like a phone. Filling a phone viewport with it discards
 * about 38% of the width, and the two people stand left and right of centre —
 * so a fill crop clips both of them. It belongs in a frame, with the words
 * beneath it rather than on it.
 */
export const WEDDING_PHOTO: StagePhoto = {
  src: boda,
  alt: "Luis, de rodillas frente a una cascada iluminada de noche, le pide matrimonio a Michell",
};
