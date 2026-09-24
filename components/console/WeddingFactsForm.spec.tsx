import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  WEDDING_FACT_FIELDS,
  WEDDING_FACT_LABELS,
  WEDDING_FACT_MAX_LENGTHS,
  type WeddingFacts,
} from "@/lib/domain/wedding-facts";

import { IDLE_WEDDING_FACTS_STATE } from "@/app/console/(authenticated)/wedding/wedding-facts-state";

import { WeddingFactsForm } from "./WeddingFactsForm";

/**
 * The one screen where the wedding's own facts are edited.
 *
 * ONE FORM, ONE SAVE, SEVEN FIELDS. Not seven inline editors: these values are
 * read together by every surface, and a partial save is how the date comes to
 * belong to one correction and the venue to another. The guest list's inline
 * phone editor is the opposite case for the opposite reason — three people and
 * ten digits, where a full edit screen means the data never gets entered.
 *
 * TWO WARNINGS THE OPERATOR CANNOT SEE FOR THEMSELVES, AND THEY ARE THE POINT
 *
 * Both describe a consequence that has already happened by the time it is
 * visible anywhere else, so both are asserted here rather than reviewed:
 *
 *  1. The Open Graph card is served `immutable, max-age=31536000` and WhatsApp
 *     caches a preview per URL. Editing the couple's names AFTER invitations were
 *     dispatched leaves every delivered card showing the old text permanently.
 *     The only cure is rotating a slug and resending.
 *  2. The Zoom passcode is already visible to every household that declined — it
 *     renders behind the phone gate on their invitation — so changing it does not
 *     un-share the old one.
 *
 * PROPS ONLY, INCLUDING THE STATE. `useActionState` lives in a thin client
 * wrapper beside the page — the same split as `ConsoleNav` and
 * `ConsoleNavCurrent`, for the same reason: every rule worth asserting is in
 * here, and taking the state as a prop makes all of them testable with no
 * session, no database and no hook to drive.
 */

const facts: WeddingFacts = {
  coupleNames: "Ana y Bruno",
  ceremonyDate: "sábado 14 de noviembre de 2026",
  ceremonyTime: "4:00 p. m.",
  venueName: "Hacienda La Ñapa",
  venueAddress: "Calle 12 #34-56, Barrio Centro",
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

function renderForm(state = IDLE_WEDDING_FACTS_STATE) {
  const action = vi.fn();

  return {
    action,
    ...render(<WeddingFactsForm facts={facts} action={action} state={state} />),
  };
}

describe("WeddingFactsForm's fields", () => {
  it("offers every one of the seven facts, each with its own label", () => {
    renderForm();

    for (const field of WEDDING_FACT_FIELDS) {
      expect(
        screen.getByLabelText(WEDDING_FACT_LABELS[field]),
      ).toBeInTheDocument();
    }
  });

  it("fills each field with the value currently stored", () => {
    renderForm();

    for (const field of WEDDING_FACT_FIELDS) {
      expect(screen.getByLabelText(WEDDING_FACT_LABELS[field])).toHaveValue(
        facts[field],
      );
    }
  });

  it("names each field the way the action reads it back", () => {
    // The `name` attribute IS the contract with `parseWeddingFacts`, which looks
    // its seven fields up by exactly these keys. A renamed input would submit a
    // field the server reports as missing.
    renderForm();

    for (const field of WEDDING_FACT_FIELDS) {
      expect(screen.getByLabelText(WEDDING_FACT_LABELS[field])).toHaveAttribute(
        "name",
        field,
      );
    }
  });

  it("carries the same maximum length the server and the database enforce", () => {
    // A convenience, not a boundary — the server re-checks every one. It exists so
    // a 400-character address is refused by the field rather than by a round trip.
    renderForm();

    for (const field of WEDDING_FACT_FIELDS) {
      expect(screen.getByLabelText(WEDDING_FACT_LABELS[field])).toHaveAttribute(
        "maxLength",
        String(WEDDING_FACT_MAX_LENGTHS[field]),
      );
    }
  });

  it("saves all seven in one submission, with exactly one save button", () => {
    renderForm();

    // Seven inline editors would allow a partial save, and these values are read
    // together by four surfaces.
    expect(screen.getAllByRole("button", { name: /Guardar/i })).toHaveLength(1);
  });
});

describe("WeddingFactsForm's warning about the cached Open Graph card", () => {
  it("states the consequence beside the couple's names, as text on the page", () => {
    renderForm();

    const warning = screen.getByTestId("wedding-card-warning");

    // Not a tooltip and not a title attribute: a consequence nobody can undo has
    // to be readable without hovering anything, on a phone that cannot hover.
    expect(warning).toBeVisible();
    expect(warning.textContent).toMatch(/ya enviad|ya se enviaron|enviadas/i);
  });

  it("says the old card cannot be corrected, not merely that caching exists", () => {
    renderForm();

    const warning =
      screen.getByTestId("wedding-card-warning").textContent ?? "";

    // The actionable half: the only cure is a new slug and a new message.
    expect(warning).toMatch(/enlace nuevo|rotar|nuevo enlace|volver a enviar/i);
  });

  it("attaches the warning to the couple's names field for a screen reader", () => {
    renderForm();

    const field = screen.getByLabelText(WEDDING_FACT_LABELS.coupleNames);
    const describedBy = field.getAttribute("aria-describedby") ?? "";

    expect(describedBy).toContain(
      screen.getByTestId("wedding-card-warning").id,
    );
  });
});

describe("WeddingFactsForm's warning about the already-shared link", () => {
  it("states that the old link is already out, beside the link field", () => {
    renderForm();

    const warning = screen.getByTestId("wedding-stream-link-warning");

    expect(warning).toBeVisible();
    expect(warning.textContent).toMatch(
      /no pudieron acompañarnos|declin|ya lo vieron|ya lo conocen/i,
    );
  });

  it("attaches that warning to the link field for a screen reader", () => {
    renderForm();

    const field = screen.getByLabelText(WEDDING_FACT_LABELS.streamUrl);

    expect(field.getAttribute("aria-describedby") ?? "").toContain(
      screen.getByTestId("wedding-stream-link-warning").id,
    );
  });

  /**
   * THE PASSCODE IS NOT A PASSWORD, AND THE BROWSER MUST NOT THINK IT IS.
   *
   * A `type="password"` field, or one whose `autocomplete` names a password,
   * makes the browser offer to save it into the operator's own credential store
   * and a phone's keychain will sync it to every device on that account. This is
   * a shared meeting passcode that a hundred households will read on their own
   * invitation page: it is not a secret of the operator's, and storing it as one
   * mixes it in with the credential that actually guards the console.
   *
   * Masking it would be worse than useless besides — it hides a value the
   * operator is checking against a Zoom screen, and hides nothing from anybody
   * else, since every household that declined already has it.
   */
  it("does not present the passcode as a browser-savable password", () => {
    renderForm();

    const field = screen.getByLabelText(WEDDING_FACT_LABELS.streamUrl);

    expect(field).toHaveAttribute("type", "text");
    expect(
      field.getAttribute("autoComplete") ?? field.getAttribute("autocomplete"),
    ).toBe("off");
  });

  it("presents no field at all as a password", () => {
    const { container } = renderForm();

    // The whole form, not just the passcode: the meeting id is equally shared,
    // and a future field must not quietly become a credential either.
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(
      0,
    );
    expect(container.innerHTML).not.toMatch(/autoComplete="[^"]*password/i);
  });
});

describe("WeddingFactsForm when the server refuses a value", () => {
  it("shows the server's message for the field it belongs to", () => {
    renderForm({
      ...IDLE_WEDDING_FACTS_STATE,
      errors: { venueName: "Lugar no puede quedar vacío." },
    });

    expect(screen.getByText("Lugar no puede quedar vacío.")).toBeVisible();
  });

  it("shows a message for each refused field, not only the first", () => {
    renderForm({
      ...IDLE_WEDDING_FACTS_STATE,
      errors: {
        venueName: "Lugar no puede quedar vacío.",
        ceremonyTime: "Hora no puede quedar vacío.",
      },
    });

    expect(screen.getByText("Lugar no puede quedar vacío.")).toBeVisible();
    expect(screen.getByText("Hora no puede quedar vacío.")).toBeVisible();
  });

  it("attaches a field's error to that field", () => {
    renderForm({
      ...IDLE_WEDDING_FACTS_STATE,
      errors: { venueName: "Lugar no puede quedar vacío." },
    });

    const field = screen.getByLabelText(WEDDING_FACT_LABELS.venueName);

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby") ?? "").toContain(
      screen.getByText("Lugar no puede quedar vacío.").id,
    );
  });

  it("leaves an accepted field unmarked", () => {
    renderForm({
      ...IDLE_WEDDING_FACTS_STATE,
      errors: { venueName: "Lugar no puede quedar vacío." },
    });

    expect(
      screen.getByLabelText(WEDDING_FACT_LABELS.ceremonyDate),
    ).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks nothing invalid before anything has been submitted", () => {
    const { container } = renderForm();

    expect(container.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
  });

  it("reports a whole-form refusal that belongs to no single field", () => {
    // The database's own refusal, for instance: a constraint the pure validator
    // does not know about must still reach the operator as words.
    renderForm({
      ...IDLE_WEDDING_FACTS_STATE,
      notice: "No se pudieron guardar los datos.",
    });

    expect(screen.getByText("No se pudieron guardar los datos.")).toBeVisible();
  });
});

describe("WeddingFactsForm once a save succeeds", () => {
  it("confirms it, because a form that looks unchanged looks like it failed", () => {
    renderForm({ ...IDLE_WEDDING_FACTS_STATE, saved: true });

    expect(screen.getByRole("status")).toBeVisible();
  });

  it("says nothing before the first save", () => {
    renderForm();

    expect(screen.queryByRole("status")).toBeNull();
  });
});
