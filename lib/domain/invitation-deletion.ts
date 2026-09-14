/**
 * Whether an invitation may be permanently deleted — pure.
 *
 * ANY `dispatch_events` ROW REFUSES, WHICH IS BROADER THAN "WAS IT SENT"
 *
 * `link_opened` means a device fetched that URL: the link has demonstrably left
 * this system's control, whoever clicked it. `marked_failed` records only that
 * the operator BELIEVES it did not arrive, which is not the same as it never
 * having left. Both carry the risk a confirmed send does — a real guest may be
 * holding that URL — and deleting the invitation turns their link into a dead
 * page they cannot ask anybody about. Slug rotation is the answer to "sent by
 * mistake"; deletion is the answer to "this household never existed".
 *
 * WHERE IT IS PERMITTED, IT IS A REAL HARD DELETE
 *
 * There is no soft-delete state here, on purpose. A second definition of
 * "exists" was rejected for this project by name (migration `0005`): the gate,
 * the OG image, `generateMetadata`, the console list, the preflight and the
 * RSVP write would each have to honour it, and the one that forgot would leak a
 * removed invitation to a real guest.
 */

export type DeletionRefusal = "already_dispatched";

export type DeletionOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: DeletionRefusal;
      /** The distinct kinds that triggered it, in the order encountered. */
      readonly eventKinds: readonly string[];
    };

/**
 * Refuses on the EXISTENCE of a row, never on a list of known kinds.
 *
 * A `kind` this file has never heard of refuses on the day a migration adds it,
 * rather than on the day somebody remembers to extend a list here. The kinds
 * are still reported, because "already dispatched" on an invitation nobody sent
 * reads as a bug until it says which events it means.
 */
export function canDeleteInvitation(
  events: readonly { readonly kind: string }[],
): DeletionOutcome {
  if (events.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: "already_dispatched",
    eventKinds: [...new Set(events.map((event) => event.kind))],
  };
}
