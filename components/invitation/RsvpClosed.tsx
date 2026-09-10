import { RSVP_CLOSED_MESSAGE } from "@/lib/domain/rsvp-copy";

/**
 * What the invitation shows once the RSVP deadline has passed.
 *
 * INSTEAD OF the form, never alongside it and never as a disabled copy of it.
 * A form that renders after the deadline is a form somebody fills in, and a
 * submission that is quietly discarded leaves a household believing they
 * answered — which is worse than never offering them the chance, because
 * nobody finds out until the seating chart is wrong.
 *
 * No `wa.me` link here, deliberately. The message tells the household to write
 * to the couple, and they already hold that chat: this invitation arrived in
 * it. Adding a deep link would put the couple's number into the page source of
 * every invitation for the sake of a tap the guest does not need.
 *
 * Synchronous and props-free, so the deadline decision stays entirely in the
 * route where the clock is read.
 *
 * Guest-facing copy is Spanish, neutral register.
 */
export function RsvpClosed() {
  return (
    <div className="rsvp__closed">
      <h2>Confirmaciones cerradas</h2>
      <p>{RSVP_CLOSED_MESSAGE}</p>
    </div>
  );
}
