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

  it("names the household and the people whose number is missing", () => {
    render(
      <DispatchPreflight
        preflight={preflight([
          row({
            greetingName: "Familia Sin Número",
            guests: [
              guest({
                fullName: "Ana Muñóz",
                phoneE164: null,
                dispatchable: false,
              }),
              guest({
                id: "g2",
                fullName: "Niña Muñóz",
                phoneE164: null,
                dispatchable: false,
              }),
            ],
          }),
        ])}
      />,
    );
    const section = groupSection("Sin número en la agenda");

    expect(within(section).getByText(/Familia Sin Número/)).toBeInTheDocument();
    expect(within(section).getByText(/Ana Muñóz/)).toBeInTheDocument();
    expect(within(section).getByText(/Niña Muñóz/)).toBeInTheDocument();
  });

  it("names the household whose number cannot receive WhatsApp, and why that matters", () => {
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
    const section = groupSection("Con número que no recibe WhatsApp");

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
    const section = groupSection("Sin número en la agenda");

    expect(within(section).getByText("Ninguna")).toBeInTheDocument();
  });

  it("shows all three checks on every render, whatever the data says", () => {
    render(<DispatchPreflight preflight={preflight([])} />);

    for (const heading of [
      "Sin número en la agenda",
      "Con número que no recibe WhatsApp",
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
