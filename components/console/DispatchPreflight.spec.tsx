import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildDispatchPreflight,
  type DispatchPreflight as Preflight,
} from "@/lib/domain/dispatch-preflight";
import type {
  ConsoleListGuest,
  ConsoleListRow,
} from "@/lib/domain/console-list";

import { DispatchPreflight } from "./DispatchPreflight";

/**
 * The readiness check, rendered.
 *
 * Presentational and props-only: every decision was already made by
 * `buildDispatchPreflight`, which is where the classification is unit-tested.
 * What is asserted here is the part only a rendered tree can show — that an
 * empty group is visibly empty rather than absent, and that nothing in the DOM
 * carries a stored phone number.
 */

const POPULATION = "invitaciones de Ana Operadora";

function guest(overrides: Partial<ConsoleListGuest> = {}): ConsoleListGuest {
  return {
    id: "g1",
    fullName: "Ana Muñóz",
    isChild: false,
    phoneE164: "+573001234567",
    lineType: "mobile",
    dispatchable: true,
    ...overrides,
  };
}

function row(overrides: Partial<ConsoleListRow> = {}): ConsoleListRow {
  return {
    invitationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    slug: "abcdefghijklmn23",
    greetingName: "Familia Muñóz",
    displayName: "Familia Muñóz",
    memberCount: 2,
    ownerSenderId: "sender-ana",
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
    // Chosen on purpose: an unchosen recipient is itself a blocker now, so a
    // fixture without one would put every row in the wrong group.
    dispatchRecipientGuestId: "g1",
    attendeeGuestIds: [],
    guests: [guest()],
    ...overrides,
  };
}

function preflight(rows: readonly ConsoleListRow[]): Preflight {
  return buildDispatchPreflight(rows, POPULATION);
}

function groupSection(heading: string): HTMLElement {
  return screen.getByRole("heading", { name: heading }).closest("section")!;
}

describe("DispatchPreflight", () => {
  it("states how many invitations are ready, against the population it counted", () => {
    render(<DispatchPreflight preflight={preflight([row()])} />);

    expect(
      screen.getByText(`Listas para enviar: 1 de 1 ${POPULATION}`),
    ).toBeInTheDocument();
  });

  it("names everybody there is to choose from when nobody has been chosen", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({
            greetingName: "Familia Sin Elegir",
            dispatchRecipientGuestId: null,
            guests: [
              guest({ fullName: "Ana Muñóz" }),
              guest({ id: "g2", fullName: "Niña Muñóz" }),
            ],
          }),
        ])}
      />,
    );
    const section = groupSection("Sin destinatario elegido");

    expect(within(section).getByText(/Familia Sin Elegir/)).toBeInTheDocument();
    expect(within(section).getByText(/Ana Muñóz/)).toBeInTheDocument();
    expect(within(section).getByText(/Niña Muñóz/)).toBeInTheDocument();
  });

  it("names only the chosen person when it is their number that is missing", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({
            greetingName: "Familia Sin Número",
            dispatchRecipientGuestId: "g1",
            guests: [
              guest({
                fullName: "Ana Muñóz",
                phoneE164: null,
                dispatchable: false,
              }),
              // The partner HAS a reachable number. Under the old
              // household-wide meaning this row was ready; the message goes to
              // whoever was chosen, so it is blocked and Beto is not the fix.
              guest({ id: "g2", fullName: "Beto Muñóz" }),
            ],
          }),
        ])}
      />,
    );
    const section = groupSection("Con destinatario sin número");

    expect(within(section).getByText(/Familia Sin Número/)).toBeInTheDocument();
    expect(within(section).getByText(/Ana Muñóz/)).toBeInTheDocument();
    expect(within(section).queryByText(/Beto Muñóz/)).toBeNull();
  });

  it("names the household whose chosen number cannot receive WhatsApp, and why that matters", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({
            greetingName: "Familia Fija",
            guests: [
              guest({
                fullName: "Casa Muñóz",
                phoneE164: "+576012345678",
                lineType: "fixed_line",
                dispatchable: false,
              }),
            ],
          }),
        ])}
      />,
    );
    const section = groupSection("Con destinatario que no recibe WhatsApp");

    expect(within(section).getByText(/Familia Fija/)).toBeInTheDocument();
    expect(within(section).getByText(/línea fija/)).toBeInTheDocument();
  });

  it("lists an already-sent invitation so a second pass does not re-send it", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({
            greetingName: "Familia Ya Enviada",
            dispatchState: "marked_sent",
          }),
        ])}
      />,
    );

    expect(
      within(groupSection("Ya enviadas")).getByText(/Familia Ya Enviada/),
    ).toBeInTheDocument();
  });

  /**
   * THE RULE SURVIVED; THE FIVE PANELS DID NOT.
   *
   * This used to assert that a clean group still rendered, with the word
   * "Ninguna" under it, so the panel could never be read as "this check did not
   * run". The reasoning was right and is kept — it just does not take five
   * headings, five badges and five paragraphs to say that nothing is wrong.
   *
   * A clean check now says so in one line, which cannot be mistaken for silence
   * either, and is the only thing on screen when there is nothing to do.
   */
  it("says nothing is pending rather than leaving the reader to infer it", () => {
    render(<DispatchPreflight preflight={preflight([row()])} />);

    expect(screen.getByText(/no hay nada pendiente/i)).toBeInTheDocument();
    expect(screen.queryByText("Ninguna")).toBeNull();
  });

  /**
   * ALL FIVE CHECKS STILL RUN. Only the ones with something to report appear.
   *
   * The distinction matters and is the reason this test kept its place rather
   * than being deleted: the checks are computed by `buildDispatchPreflight`,
   * which is unit-tested over rows, and what changed is purely what the panel
   * puts on screen. An operator with five clean checks sees one line; an
   * operator with two problems sees two panels, and neither has to read past
   * what applies to them.
   */
  it("shows a check only when it has something to report", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({ dispatchRecipientGuestId: null }),
          row({
            invitationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            greetingName: "Familia Ya Enviada",
            dispatchState: "marked_sent",
          }),
        ])}
      />,
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Sin destinatario elegido", "Ya enviadas"]);
  });

  /**
   * The same line `scripts/import-guests.spec.ts` and
   * `components/invitation/InvitationBody.spec.tsx` hold. A readiness summary is
   * a thing an operator screenshots and forwards, so it names people and never
   * prints the number it is complaining about.
   */
  it("prints no stored phone number anywhere in the rendered tree", () => {
    const { container } = render(
      <DispatchPreflight
        preflight={preflight([
          row({
            guests: [
              guest({
                fullName: "Casa Muñóz",
                phoneE164: "+576012345678",
                lineType: "fixed_line",
                dispatchable: false,
              }),
            ],
          }),
        ])}
      />,
    );

    expect(container.textContent).toContain("Casa Muñóz");
    expect(container.innerHTML).not.toMatch(/\+?\d{7,}/);
  });

  /**
   * A CHECK WITH NOTHING TO REPORT SAYS SO IN ONE LINE.
   *
   * Every group used to render always, each with a heading, a badge, a
   * paragraph of explanation and the word "Ninguna" — five panels and about
   * nine hundred pixels of mostly-empty boxes above the list an operator came
   * to read. The reasoning was sound and is kept: a check that omits its clean
   * sections reads as "this check did not run", and those are not tellable
   * apart. It just does not need five panels to say it.
   */
  describe("when nothing is blocked", () => {
    it("says so once, instead of five empty panels", () => {
      render(
        <DispatchPreflight
          preflight={preflight([row({ dispatchRecipientGuestId: "g1" })])}
        />,
      );

      expect(screen.getByText(/no hay nada pendiente/i)).toBeInTheDocument();
      expect(screen.queryByText("Ninguna")).toBeNull();
      expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    });
  });

  describe("when something is blocked", () => {
    /**
     * Only the groups that have something in them, and each still explains
     * itself — that is the moment the explanation is worth reading, and the
     * only moment it earns its space.
     */
    it("shows only the group that has households, with its explanation", () => {
      render(
        <DispatchPreflight
          preflight={preflight([row({ dispatchRecipientGuestId: null })])}
        />,
      );

      const headings = screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent);

      expect(headings).toEqual(["Sin destinatario elegido"]);
      expect(screen.queryByText("Ninguna")).toBeNull();
      expect(screen.getByText(/Todavía nadie eligió/i)).toBeInTheDocument();
    });

    it("still leads with how many can go out", () => {
      render(
        <DispatchPreflight
          preflight={preflight([row({ dispatchRecipientGuestId: null })])}
        />,
      );

      expect(screen.getByText(/^Listas para enviar:/)).toBeInTheDocument();
    });
  });
});
