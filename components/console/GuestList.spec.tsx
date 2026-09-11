import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConsoleListRow } from "@/lib/domain/console-list";

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
    seatsAllowed: 3,
    rsvpDeadline: null,
    ownerSenderId: ANA,
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
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

function renderList(rows: readonly ConsoleListRow[], readOnly = false) {
  return render(
    <GuestList
      rows={rows}
      updatePhoneAction={vi.fn<(formData: FormData) => void>()}
      readOnly={readOnly}
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
    expect(within(household).getByText(/3 lugares/)).toBeInTheDocument();
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
    renderList([row()], true);

    expect(screen.queryByRole("link", { name: /Preparar envío/i })).toBeNull();
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

  it("shows the current answer, and the seats it confirmed", () => {
    renderList([row({ answer: "attending", seatsConfirmed: 2 })]);

    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 lugares confirmados/)).toBeInTheDocument();
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
