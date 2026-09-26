import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDLE_WEDDING_FACTS_STATE } from "./wedding-facts-state";

/**
 * The Server Action behind the wedding-facts editor.
 *
 * WHAT IS WORTH PROVING HERE, AND WHY EACH ITEM IS NOT BOOKKEEPING
 *
 *  - The acting identity comes from the verified session. This action rewrites
 *    the couple's names, which reach guests through a card nothing can correct
 *    after dispatch, so it may not run for an unauthenticated request under any
 *    circumstance.
 *  - Validation happens on the SERVER and a refused submission writes NOTHING.
 *    The browser's `required` and `maxLength` attributes are a convenience; a
 *    hand-rolled POST carries whatever it likes, and a blank venue stored here
 *    renders as an invitation that looks finished and names no place.
 *  - No submitted value is logged, at any severity, on any path. The Zoom
 *    passcode is one of the seven, and a log line is a copy of it in a place
 *    nobody will remember to rotate.
 *  - The two surfaces that render these values are revalidated, or the operator
 *    saves successfully and the console keeps showing the old text.
 *
 * EITHER OPERATOR MAY EDIT. There is no ownership axis to check: the `ceremony`
 * row belongs to the wedding, not to a sender, and the two people getting married
 * do not need an approval workflow between them. `requireOperator()` is therefore
 * the whole authorization, and that is deliberate rather than forgotten.
 *
 * `updateCeremony` itself is proved against a real database in
 * `supabase/tests/ceremony.spec.ts`. Two impeccable halves and an unexamined
 * join is how a guard gets removed by a refactor with nothing turning red.
 */

const requireOperator = vi.fn();
vi.mock("@/lib/server/console-session", () => ({
  requireOperator: () => requireOperator(),
}));

const updateCeremony = vi.fn();
vi.mock("@/lib/server/ceremony", () => ({
  updateCeremony: (...args: unknown[]) => updateCeremony(...args),
}));

vi.mock("@/lib/server/supabase", () => ({
  createServerSupabaseClient: () => ({ marker: "supabase-client" }),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { saveWeddingFactsAction } = await import("./actions");

const ANA = { id: "aaaaaaaa-1111-4111-8111-111111111111", displayName: "Ana" };

const COMPLETE: Record<string, string> = {
  coupleNames: "Ana y Bruno",
  ceremonyDate: "sábado 14 de noviembre de 2026",
  ceremonyTime: "4:00 p. m.",
  venueName: "Hacienda La Ñapa",
  venueAddress: "Calle 12 #34-56, Barrio Centro",
  streamUrl: "https://meet.google.com/abc-defg-hij",
};

function form(entries: Record<string, string> = {}): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries({ ...COMPLETE, ...entries })) {
    data.set(key, value);
  }

  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOperator.mockResolvedValue(ANA);
  updateCeremony.mockResolvedValue(undefined);
});

describe("saveWeddingFactsAction's session requirement", () => {
  it("refuses when there is no operator session, and writes nothing", async () => {
    requireOperator.mockRejectedValue(new Error("no session"));

    await expect(
      saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, form()),
    ).rejects.toThrow();
    expect(updateCeremony).not.toHaveBeenCalled();
  });

  it("resolves the operator before reading the form at all", async () => {
    // Order matters: a validation refusal returned to an unauthenticated caller
    // would be a hand-rolled POST learning which field names this row has.
    requireOperator.mockRejectedValue(new Error("no session"));

    await expect(
      saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, form({ venueName: "" })),
    ).rejects.toThrow();
    expect(updateCeremony).not.toHaveBeenCalled();
  });

  it("lets either operator edit, because the row belongs to the wedding", async () => {
    requireOperator.mockResolvedValue({
      id: "bbbbbbbb-2222-4222-8222-222222222222",
      displayName: "Beto",
    });

    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form(),
    );

    expect(state.saved).toBe(true);
    expect(updateCeremony).toHaveBeenCalledTimes(1);
  });
});

describe("saveWeddingFactsAction's server-side validation", () => {
  it("writes all seven trimmed values when the submission is complete", async () => {
    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form({ coupleNames: "  Ana y Bruno  " }),
    );

    expect(state).toEqual({ errors: {}, notice: null, saved: true });
    expect(updateCeremony).toHaveBeenCalledWith(
      { marker: "supabase-client" },
      {
        coupleNames: "Ana y Bruno",
        ceremonyDate: "sábado 14 de noviembre de 2026",
        ceremonyTime: "4:00 p. m.",
        venueName: "Hacienda La Ñapa",
        venueAddress: "Calle 12 #34-56, Barrio Centro",
        streamUrl: "https://meet.google.com/abc-defg-hij",
      },
    );
  });

  it("refuses a blank field and writes NOTHING, not even the valid six", async () => {
    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form({ venueName: "   " }),
    );

    // All or nothing. Six saved values and one refused is the partial state this
    // one-form-one-save design exists to make impossible.
    expect(state.saved).toBe(false);
    expect(state.errors.venueName).toBeDefined();
    expect(updateCeremony).not.toHaveBeenCalled();
  });

  it("refuses a field the browser never sent, rather than storing the word null", async () => {
    const data = form();
    data.delete("streamUrl");

    const state = await saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, data);

    expect(state.errors.streamUrl).toBeDefined();
    expect(updateCeremony).not.toHaveBeenCalled();
  });

  it("refuses an over-long value that no `maxLength` attribute stopped", async () => {
    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form({ venueAddress: "a".repeat(5000) }),
    );

    expect(state.errors.venueAddress).toBeDefined();
    expect(updateCeremony).not.toHaveBeenCalled();
  });

  it("reports every refused field at once", async () => {
    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form({ venueName: "", ceremonyTime: "" }),
    );

    expect(Object.keys(state.errors).sort()).toEqual([
      "ceremonyTime",
      "venueName",
    ]);
  });

  it("keeps no error from the previous submission once it is fixed", async () => {
    const state = await saveWeddingFactsAction(
      { errors: { venueName: "anterior" }, notice: null, saved: false },
      form(),
    );

    expect(state.errors).toEqual({});
  });
});

describe("saveWeddingFactsAction when the write itself fails", () => {
  it("reports it as a whole-form notice rather than crashing the page", async () => {
    updateCeremony.mockRejectedValue(
      new Error("Could not save the wedding details: some constraint"),
    );

    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form(),
    );

    expect(state.saved).toBe(false);
    expect(state.notice).not.toBeNull();
  });

  it("does not put the submitted values into the notice it shows", async () => {
    updateCeremony.mockRejectedValue(new Error("boom"));

    const state = await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form(),
    );

    // The passcode in particular. An error message is rendered into a page and
    // copied into a bug report; neither is a place for it.
    expect(state.notice).not.toContain("clave-de-prueba");
    expect(state.notice).not.toContain("123 4567 8901");
  });
});

describe("saveWeddingFactsAction's logging", () => {
  it("logs nothing at all on the happy path", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "debug").mockImplementation(() => {}),
    ];

    await saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, form());

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  it("logs nothing when the write fails either", async () => {
    // The tempting place for a `console.error(error, facts)`, and the one that
    // would put the Zoom passcode into a hosting provider's log retention.
    updateCeremony.mockRejectedValue(new Error("boom"));

    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    await saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, form());

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe("saveWeddingFactsAction's revalidation", () => {
  it("revalidates the editor and the console root after a successful save", async () => {
    await saveWeddingFactsAction(IDLE_WEDDING_FACTS_STATE, form());

    const paths = revalidatePath.mock.calls.map((call) => call[0]);

    expect(paths).toContain("/console/wedding");
    expect(paths).toContain("/console");
  });

  it("revalidates nothing when the submission was refused", async () => {
    await saveWeddingFactsAction(
      IDLE_WEDDING_FACTS_STATE,
      form({ venueName: "" }),
    );

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
