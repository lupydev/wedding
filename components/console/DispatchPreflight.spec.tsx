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
    rsvpDeadline: null,
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

  it("renders an empty group as empty rather than leaving it out", () => {
    // A check that silently omits its clean sections cannot be read as "nothing
    // is wrong here" — it reads as "this check did not run".
    render(<DispatchPreflight preflight={preflight([row()])} />);
    const section = groupSection("Con destinatario sin número");

    expect(within(section).getByText("Ninguna")).toBeInTheDocument();
  });

  it("shows all five checks on every render, whatever the data says", () => {
    render(<DispatchPreflight preflight={preflight([])} />);

    for (const heading of [
      "Sin destinatario elegido",
      "Con destinatario sin número",
      "Con destinatario que no recibe WhatsApp",
      "Con destinatario que ya no pertenece",
      "Ya enviadas",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
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
});
