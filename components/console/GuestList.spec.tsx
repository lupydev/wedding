import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConsoleListRow } from "@/lib/domain/console-list";
import { CONSOLE_NEW_INVITATION_PATH } from "@/lib/domain/operator-session";

import { GuestList } from "./GuestList";

/**
 * The console guest list.
 *
 * Props only, no data access: everything it renders was already reduced by
 * `assembleConsoleRows` from `rsvp_latest` and the dispatch log, which is what
 * makes the two rules with teeth assertable here without a database.
 *
 *  1. A row the signed-in operator does NOT own carries no send affordance at
 *     all, and says who owns it instead. Hiding the button is the second layer
 *     of the wrong-owner defence, after the partitioned query.
 *  2. An opened link is never labelled as a send. The application cannot observe
 *     a send; `link_opened` says only that the operator opened WhatsApp.
 */

const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BETO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function row(overrides: Partial<ConsoleListRow> = {}): ConsoleListRow {
  return {
    invitationId: "11111111-1111-4111-8111-111111111111",
    slug: "abcdefghijklmn23",
    greetingName: "Familia Muñóz",
    displayName: "Familia Muñóz",
    memberCount: 3,
    rsvpDeadline: null,
    ownerSenderId: ANA,
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
    dispatchRecipientGuestId: null,
    attendeeGuestIds: [],
    guests: [
      {
        id: "g1",
        fullName: "Ana Muñóz",
        isChild: false,
        phoneE164: "+573001234567",
        lineType: "mobile",
        dispatchable: true,
      },
      {
        id: "g2",
        fullName: "Niña Muñóz",
        isChild: true,
        phoneE164: null,
        lineType: "not_normalizable",
        dispatchable: false,
      },
    ],
    ...overrides,
  };
}

function renderList(
  rows: readonly ConsoleListRow[],
  flags: { readOnly?: boolean; dispatchBlocked?: boolean } = {},
) {
  return render(
    <GuestList
      rows={rows}
      updatePhoneAction={vi.fn<(formData: FormData) => void>()}
      readOnly={flags.readOnly ?? false}
      dispatchBlocked={flags.dispatchBlocked ?? false}
      emptyMessage="No hay invitaciones en esta vista."
    />,
  );
}

describe("GuestList", () => {
  it("shows the greeting name, the named guests and the seats for each household", () => {
    renderList([row()]);
    // Scoped to the household's own row: the guests inside it are list items
    // too, so a bare `getByRole("listitem")` would be ambiguous.
    const household = screen
      .getByRole("heading", { name: "Familia Muñóz" })
      .closest("li") as HTMLElement;

    expect(household).not.toBeNull();
    expect(within(household).getByText("Ana Muñóz")).toBeInTheDocument();
    expect(within(household).getByText("Niña Muñóz")).toBeInTheDocument();
    expect(within(household).getByText("3 personas")).toBeInTheDocument();
  });

  it("shows the owning sender on every row", () => {
    renderList([row()]);

    expect(screen.getByText(/Ana Operadora/)).toBeInTheDocument();
  });

  it("offers a send affordance on a row the operator owns", () => {
    renderList([row()]);

    expect(
      screen.getByRole("link", { name: /Preparar envío/i }),
    ).toBeInTheDocument();
  });

  it("offers NO send affordance on a row owned by the other operator", () => {
    renderList([
      row({
        ownedByViewer: false,
        ownerSenderId: BETO,
        ownerDisplayName: "Beto Operador",
      }),
    ]);

    expect(screen.queryByRole("link", { name: /Preparar envío/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /enviar/i })).toBeNull();
    expect(screen.getByText("Gestiona Beto Operador")).toBeInTheDocument();
  });

  it("withdraws the send affordance from every row while the device declaration blocks it", () => {
    renderList([row()], { dispatchBlocked: true });

    expect(screen.queryByRole("link", { name: /Preparar envío/i })).toBeNull();
  });

  /**
   * The body preview, which is a READ and not a send.
   *
   * It is offered on an owned row exactly like the send affordance, and unlike
   * it, it survives a device-declaration mismatch. Looking at an invitation
   * sends nothing from any account, and the operator who is on the wrong
   * handset is precisely the one who may still need to check the copy before
   * the other one sends it.
   */
  it("offers a body preview on a row the operator owns", () => {
    renderList([row()]);

    expect(
      screen.getByRole("link", { name: /Ver la invitación/i }),
    ).toHaveAttribute(
      "href",
      "/console/preview/11111111-1111-4111-8111-111111111111",
    );
  });

  it("points each row's preview at its own invitation", () => {
    renderList([row({ invitationId: "22222222-2222-4222-8222-222222222222" })]);

    expect(
      screen.getByRole("link", { name: /Ver la invitación/i }),
    ).toHaveAttribute(
      "href",
      "/console/preview/22222222-2222-4222-8222-222222222222",
    );
  });

  it("offers NO body preview on a row owned by the other operator", () => {
    // The route itself is owned-only and answers `notFound()`. A link that led
    // to a 404 would be an affordance that lies.
    renderList([
      row({
        ownedByViewer: false,
        ownerSenderId: BETO,
        ownerDisplayName: "Beto Operador",
      }),
    ]);

    expect(
      screen.queryByRole("link", { name: /Ver la invitación/i }),
    ).toBeNull();
  });

  it("keeps the body preview while the device declaration blocks sending", () => {
    renderList([row()], { dispatchBlocked: true });

    expect(screen.queryByRole("link", { name: /Preparar envío/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /Ver la invitación/i }),
    ).toBeInTheDocument();
  });

  it("never links to the public invitation URL from the list", () => {
    // Reading the invitation from the console goes through the console's own
    // route. A public `/i/{slug}` link in a row would be a guest-facing URL
    // sitting in an operator surface, and the one people would copy.
    const { container } = renderList([row()]);

    expect(container.querySelector('a[href^="/i/"]')).toBeNull();
  });

  /**
   * The fix from the Work Unit 6a-ii review, asserted rather than described.
   *
   * The device gate exists so a message does not leave from the wrong WhatsApp
   * account. Correcting a typo in a phone number sends nothing, so it is not
   * what that gate is for — and as originally wired, being on the wrong handset
   * prevented fixing the very data the preflight is telling the operator to fix.
   * Dispatch stays blocked; data entry does not.
   */
  it("keeps the inline phone editor available while the declaration blocks dispatch", () => {
    renderList([row()], { dispatchBlocked: true });

    expect(
      screen.getAllByRole("button", { name: /Editar|Añadir/i }).length,
    ).toBeGreaterThan(0);
  });

  it("withdraws the editor only where the whole list is read-only", () => {
    // The other operator's partition. `updateGuestPhoneAction` refuses these
    // households on the server too; hiding the control is the visible layer.
    renderList([row({ ownedByViewer: false })], { readOnly: true });

    expect(screen.queryByRole("button", { name: /Editar|Añadir/i })).toBeNull();
  });

  it("labels an opened link as an unconfirmed send, never as a send", () => {
    renderList([row({ dispatchState: "link_opened" })]);

    expect(
      screen.getByText("Enlace abierto, envío sin confirmar"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Marcada como enviada")).toBeNull();
  });

  it("labels a confirmed send differently from an opened link", () => {
    renderList([row({ dispatchState: "marked_sent" })]);

    expect(screen.getByText("Marcada como enviada")).toBeInTheDocument();
  });

  it("shows the current answer, and how many of the household it confirmed", () => {
    renderList([row({ answer: "attending", seatsConfirmed: 2 })]);

    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("2 de 3 personas confirmadas")).toBeInTheDocument();
  });

  it("shows a declined household as declined rather than as unanswered", () => {
    renderList([row({ answer: "declined" })]);

    expect(screen.getByText("No asiste")).toBeInTheDocument();
  });

  it("renders a household's phone numbers, because the console is the authorized reader", () => {
    renderList([row()]);

    expect(screen.getByText("+573001234567")).toBeInTheDocument();
  });

  it("says so when the view has no invitations, instead of rendering an empty page", () => {
    renderList([]);

    expect(
      screen.getByText("No hay invitaciones en esta vista."),
    ).toBeInTheDocument();
  });

  /**
   * A reference project put a three-dot menu in each row, positioned absolutely
   * inside a scroll container with `overflow: hidden`. The LAST row's menu — the
   * one with least room below it — was unreachable. Rather than reimplement
   * `getBoundingClientRect()` flipping, this list has no popover at all: every
   * action is an ordinary element inside its own row.
   */
  it("uses no popover menu, so no row's actions can be clipped out of reach", () => {
    const { container } = renderList([row(), row(), row()]);

    expect(container.querySelectorAll("[data-row-menu]")).toHaveLength(0);
    expect(
      screen.getAllByRole("link", { name: /Preparar envío/i }),
    ).toHaveLength(3);
  });
});

describe("GuestList — who receives the message, and how to change it", () => {
  // THE RECIPIENT IS A DECISION SOMEBODY MADE, AND THE LIST IS WHERE IT IS READ.
  //
  // Nothing infers a recipient: not `is_primary`, not ordering, not being the
  // only reachable number. A confirmed decision of this capability deleted the
  // auto-pick, so `null` is the honest starting state of every invitation — and
  // dispatch stays blocked until somebody chooses.
  //
  // That makes the ABSENCE the important case. A list that simply renders no
  // indicator when nobody is chosen shows the same thing for "not chosen yet"
  // and for "chosen, and it is this person" — and the operator only finds out
  // which when the send refuses. So the absence is stated, not omitted.
  it("marks the member the message goes to", () => {
    renderList([row({ dispatchRecipientGuestId: "g1" })]);

    const household = screen
      .getByRole("heading", { name: "Familia Muñóz" })
      .closest("li") as HTMLElement;
    const recipient = within(household)
      .getByText("Ana Muñóz")
      .closest("li") as HTMLElement;

    expect(
      within(recipient).getByText(/Recibe el mensaje/i),
    ).toBeInTheDocument();

    // And nobody else on the row is marked, which is what makes the mark mean
    // something.
    const other = within(household)
      .getByText("Niña Muñóz")
      .closest("li") as HTMLElement;

    expect(within(other).queryByText(/Recibe el mensaje/i)).toBeNull();
  });

  it("says plainly when nobody has been chosen yet", () => {
    renderList([row({ dispatchRecipientGuestId: null })]);

    expect(
      screen.getByText(/Nadie elegido para recibir el mensaje/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Recibe el mensaje/i)).toBeNull();
  });

  it("offers a way to go and choose one, pointed at this invitation", () => {
    renderList([row({ dispatchRecipientGuestId: null })]);

    expect(
      screen.getByRole("link", { name: /Editar invitación/i }),
    ).toHaveAttribute(
      "href",
      "/console/invitations/11111111-1111-4111-8111-111111111111/edit",
    );
  });

  it("withdraws the edit affordance from a row the operator does not own", () => {
    // Not because the route would refuse — it does not; console administration
    // is deliberately not owner-scoped, and `actions.spec.ts` pins that. Because
    // the partition these rows appear in has already told the operator they may
    // not edit them, and withdraws the inline phone editor to say so. An edit
    // door standing open beside a withdrawn control makes the screen tell two
    // stories, and the one a person believes is whichever they read second.
    renderList([
      row({
        ownedByViewer: false,
        ownerSenderId: BETO,
        ownerDisplayName: "Beto Operador",
      }),
    ]);

    expect(
      screen.queryByRole("link", { name: /Editar invitación/i }),
    ).toBeNull();
  });

  it("withdraws it from a read-only render too", () => {
    renderList([row()], { readOnly: true });

    expect(
      screen.queryByRole("link", { name: /Editar invitación/i }),
    ).toBeNull();
  });
});

describe("GuestList — an answer the household no longer agrees with", () => {
  /**
   * THE DANGLING ATTENDEE ID, MADE LEGIBLE ON THE ROW.
   *
   * `attendee_guest_ids` is a bare `uuid[]` — Postgres cannot foreign-key array
   * elements — and `rsvp_responses` is append-only against `service_role` too.
   * So removing a member who had already been confirmed leaves their id inside a
   * stored answer that nothing cascades to and nobody can ever correct.
   *
   * Removing them is PERMITTED and is the couple's actual workflow: "Fer already
   * said yes, but now he cannot come". What is not acceptable is the tool staying
   * quiet about it, which is how a seat count nobody can explain reaches a
   * caterer. The badge is rendered from `classifyMembershipChangeImpact` — the
   * same rule the write side reports with, not a second one that could disagree.
   */
  function contradicted(overrides: Partial<ConsoleListRow> = {}) {
    return row({
      answer: "attending",
      seatsConfirmed: 2,
      memberCount: 1,
      guests: [
        {
          id: "g1",
          fullName: "Ana Muñóz",
          isChild: false,
          phoneE164: "+573001234567",
          lineType: "mobile",
          dispatchable: true,
        },
      ],
      attendeeGuestIds: ["g1", "g-fer"],
      ...overrides,
    });
  }

  it("flags a row whose stored answer names somebody who has since left", () => {
    renderList([contradicted()]);

    const household = screen
      .getByRole("heading", { name: "Familia Muñóz" })
      .closest("li") as HTMLElement;

    expect(
      within(household).getByText(/La respuesta ya no cuadra/i),
    ).toBeInTheDocument();
  });

  it("flags it in the red the colour rule reserves for data that does not add up", () => {
    const { container } = renderList([contradicted()]);

    expect(
      container.querySelector(".guest-list__answer-mismatch [data-tone]"),
    ).toHaveAttribute("data-tone", "broken");
  });

  it("flags nothing on a row whose answer names only current members", () => {
    // The quiet row is what makes the flagged one visible. A badge on every
    // answered household is a badge nobody reads.
    renderList([contradicted({ seatsConfirmed: 1, attendeeGuestIds: ["g1"] })]);

    expect(screen.queryByText(/La respuesta ya no cuadra/i)).toBeNull();
  });

  it("flags nothing on a declined household, whatever ids its answer still holds", () => {
    // A declined answer confirms nobody, so no membership change can contradict
    // it. Sending the operator to reconcile an answer that seats no one is a
    // false alarm, and false alarms are how a real one stops being read.
    renderList([contradicted({ answer: "declined", seatsConfirmed: 0 })]);

    expect(screen.queryByText(/La respuesta ya no cuadra/i)).toBeNull();
  });

  /**
   * Task 4b.11: the attendee list resolves each id against the current members,
   * and an id that resolves to nobody is rendered AS REMOVED.
   *
   * Neither of the two easy failures is acceptable. Crashing on a `get` that
   * returns nothing takes the whole console down over data the schema permits.
   * Filtering the id out is worse than crashing, because the answer then reads
   * as one person shorter than the household actually confirmed — and it reads
   * that way permanently, with nothing on screen to suggest otherwise.
   */
  it("names every attendee the answer confirmed, and says which of them is gone", () => {
    renderList([contradicted()]);

    const household = screen
      .getByRole("heading", { name: "Familia Muñóz" })
      .closest("li") as HTMLElement;
    const attendees = within(household)
      .getByRole("list", { name: /confirm/i })
      .querySelectorAll("li");

    // Two stored ids, two rendered entries. Not one.
    expect(attendees).toHaveLength(2);
    expect(attendees[0].textContent).toContain("Ana Muñóz");
    expect(attendees[1].textContent).toMatch(/ya no figura/i);
  });

  it("renders no attendee list where the answer still names only current members", () => {
    renderList([contradicted({ seatsConfirmed: 1, attendeeGuestIds: ["g1"] })]);

    expect(screen.queryByRole("list", { name: /confirm/i })).toBeNull();
  });
});

describe("GuestList — the console can create an invitation now", () => {
  // The importer is no longer the only door, and the empty state used to say it
  // was. An operator reading that has no reason to look for another way in.
  /**
   * THE CREATE LINK STAYS IN THE EMPTY STATE AND NOWHERE ELSE IN THIS LIST.
   *
   * It used to render in both branches, which put two of them on the console
   * home — one under the operator's own households and one under the read-only
   * list of the other account's, where every other control had been withdrawn
   * on purpose. Both sat below a scrolling list, so the more invitations
   * existed the further the way to make another one scrolled off.
   *
   * Creation lives in the console header now, above the fold on every page.
   * Here it belongs only where the list is empty: that screen's whole job is to
   * offer the exit, and the operator's eye is already on it.
   */
  it("offers the create form from the empty state", () => {
    renderList([]);

    expect(
      screen.getByRole("link", { name: /Crear invitación/i }),
    ).toHaveAttribute("href", CONSOLE_NEW_INVITATION_PATH);
  });

  it("does not repeat it under a list that already has rows", () => {
    renderList([row()]);

    expect(
      screen.queryByRole("link", { name: /Crear invitación/i }),
    ).toBeNull();
  });

  it("points the empty state at creating one instead of at the importer", () => {
    renderList([]);

    expect(
      screen.getByText("No hay invitaciones en esta vista."),
    ).toBeInTheDocument();
    // Not "no importer anywhere" — the importer still exists and still works.
    // What had to go is the claim that it is the ONLY way in, which is the
    // sentence an operator reads before concluding there is nothing else to try.
    expect(
      screen.queryByText(
        "Las invitaciones se cargan con el importador de invitados.",
      ),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /Crear invitación/i }),
    ).toBeInTheDocument();
  });

  /**
   * ONE LIST NOW CARRIES BOTH PARTITIONS, SO THE TWO GUARDS MUST AGREE PER ROW.
   *
   * The console home used to render two lists: the operator's own, and a second
   * one over the other account's households passed `readOnly`. The guards for
   * the edit link and the inline phone editor were therefore never in conflict,
   * and `GuestList`'s own comment said so — "the only caller passes it together
   * with rows the viewer does not own… which is exactly why leaving one out
   * would go unnoticed until they did."
   *
   * Merging the lists is when they disagree. A row the viewer does not own must
   * offer no phone editor even in a list that is not read-only, because
   * `updateGuestPhoneAction` refuses it on the server — and a control that is
   * always refused is worse than no control.
   */
  describe("a list holding both partitions", () => {
    it("offers no phone editor on a row the viewer does not own", () => {
      renderList([row({ ownedByViewer: false, ownerDisplayName: "Beto" })]);

      expect(
        screen.queryByRole("button", { name: /Editar el número/i }),
      ).toBeNull();
    });

    it("still offers it on a row the viewer owns", () => {
      renderList([row({ ownedByViewer: true })]);

      // One per guest: the fixture household names two of them.
      expect(
        screen.getAllByRole("button", { name: /Editar el número/i }),
      ).toHaveLength(2);
    });

    it("withdraws both doors together on a row the viewer does not own", () => {
      renderList([row({ ownedByViewer: false, ownerDisplayName: "Beto" })]);

      expect(
        screen.queryByRole("link", { name: /Editar invitación/i }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: /Editar el número/i }),
      ).toBeNull();
    });

    it("keeps a fully read-only list read-only, even for owned rows", () => {
      renderList([row({ ownedByViewer: true })], { readOnly: true });

      expect(
        screen.queryByRole("button", { name: /Editar el número/i }),
      ).toBeNull();
      expect(
        screen.queryByRole("link", { name: /Editar invitación/i }),
      ).toBeNull();
    });
  });
});
