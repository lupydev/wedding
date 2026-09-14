import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ALL_INVITATIONS_POPULATION,
  ownedPopulation,
  scopedMetrics,
  summarizeConsoleList,
  type ConsoleListRow,
} from "@/lib/domain/console-list";

import { ProgressSummary } from "./ProgressSummary";

function row(overrides: Partial<ConsoleListRow> = {}): ConsoleListRow {
  return {
    invitationId: "11111111-1111-4111-8111-111111111111",
    slug: "abcdefghijklmn23",
    greetingName: "Familia Muñóz",
    displayName: "Familia Muñóz",
    memberCount: 3,
    rsvpDeadline: null,
    ownerSenderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerDisplayName: "Ana Operadora",
    ownedByViewer: true,
    dispatchState: "not_dispatched",
    answer: "pending",
    seatsConfirmed: 0,
    answeredAt: null,
    guests: [],
    ...overrides,
  };
}

const ROWS = [
  row({ answer: "attending", seatsConfirmed: 2, dispatchState: "marked_sent" }),
  row({ answer: "declined", dispatchState: "link_opened" }),
  row({ answer: "pending" }),
];

describe("ProgressSummary — no number without its population", () => {
  it("renders every count with its denominator and the population named", () => {
    render(
      <ProgressSummary
        heading="Tus invitaciones"
        metrics={scopedMetrics(
          summarizeConsoleList(ROWS),
          ownedPopulation("Ana Operadora"),
        )}
      />,
    );

    expect(
      screen.getByText("Confirmadas: 1 de 3 invitaciones de Ana Operadora"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No asisten: 1 de 3 invitaciones de Ana Operadora"),
    ).toBeInTheDocument();
  });

  it("names the whole population on the shared dashboard", () => {
    render(
      <ProgressSummary
        heading="Todas las invitaciones"
        metrics={scopedMetrics(
          summarizeConsoleList(ROWS),
          ALL_INVITATIONS_POPULATION,
        )}
      />,
    );

    expect(
      screen.getByText("Confirmadas: 1 de 3 todas las invitaciones del evento"),
    ).toBeInTheDocument();
  });

  it("never renders a bare count", () => {
    render(
      <ProgressSummary
        heading="Tus invitaciones"
        metrics={scopedMetrics(
          summarizeConsoleList(ROWS),
          ownedPopulation("Ana Operadora"),
        )}
      />,
    );

    for (const item of screen.getAllByRole("listitem")) {
      expect(item.textContent ?? "").toMatch(/ de \d+ /);
    }
  });

  it("keeps opened links out of the confirmed-send line", () => {
    render(
      <ProgressSummary
        heading="Tus invitaciones"
        metrics={scopedMetrics(
          summarizeConsoleList(ROWS),
          ownedPopulation("Ana Operadora"),
        )}
      />,
    );

    expect(
      screen.getByText(
        "Marcadas como enviadas: 1 de 3 invitaciones de Ana Operadora",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enlace abierto, envío sin confirmar: 1 de 3 invitaciones de Ana Operadora",
      ),
    ).toBeInTheDocument();
  });
});
