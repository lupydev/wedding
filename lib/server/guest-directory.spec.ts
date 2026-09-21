import { describe, expect, it } from "vitest";

import { withDb } from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";

import {
  createDirectoryGuest,
  deleteDirectoryGuest,
  listFreeGuests,
  listGuestDirectory,
  placeGuestInInvitation,
  updateDirectoryGuest,
} from "./guest-directory";
import { createServerSupabaseClient } from "./supabase";

/**
 * The directory, against the real database.
 *
 * Every one of these depends on migration 0015: before it,
 * `invitation_guests.invitation_id` was `not null` and none of this could be
 * stored at all. The schema half is proven in
 * `supabase/tests/guest-release.spec.ts`; what is proven here is that the
 * repository speaks to it correctly.
 *
 * THE FIXTURES ARE SUFFIXED PER RUN, and that is not decoration: this database
 * is shared with every other spec file and with whatever an aborted run left
 * behind, so no test here may assert an event-wide total. Each one looks only
 * for the rows it created.
 */
function useLocalSupabase(): void {
  const { secretKey } = resolveLocalKeys();

  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SECRET_KEY = secretKey;
}

/** A name nothing else in the database will collide with. */
function uniqueName(label: string): string {
  return `${label} ${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
}

async function seedHousehold(fullName: string): Promise<{
  invitationId: string;
  guestId: string;
  greetingName: string;
  senderId: string;
}> {
  const greetingName = uniqueName("Familia Directorio");

  return withDb(async (db) => {
    const sender = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ('Ana', 'partner_a', $1, '+573001110000')
       returning id`,
      [`ana.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`],
    );
    const invitation = await db.query<{ id: string }>(
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name)
       values ($1, $2, $3, $3)
       returning id`,
      [
        `dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender.rows[0].id,
        greetingName,
      ],
    );
    const guest = await db.query<{ id: string }>(
      `insert into invitation_guests (invitation_id, full_name)
       values ($1, $2)
       returning id`,
      [invitation.rows[0].id, fullName],
    );

    return {
      invitationId: invitation.rows[0].id,
      guestId: guest.rows[0].id,
      greetingName,
      senderId: sender.rows[0].id,
    };
  });
}

describe("the guest directory repository (local Supabase)", () => {
  it("stores a guest who belongs to no invitation", async () => {
    useLocalSupabase();
    const fullName = uniqueName("Suelta");

    const created = await createDirectoryGuest(
      createServerSupabaseClient(),
      {
        fullName,
        nickname: "Suelti",
        phone: "300 555 9001",
        isChild: false,
      },
      "CO",
    );

    expect(created.refusals).toEqual([]);
    expect(created.guest).toMatchObject({
      fullName,
      nickname: "Suelti",
      // Typed with spaces, stored in E.164 — the same strict normalisation the
      // importer and the inline phone editor use, so the directory cannot
      // become a second way for a badly-shaped number to enter the database.
      phoneE164: "+573005559001",
      isChild: false,
      household: null,
    });
  });

  it("refuses a nameless guest and writes nothing", async () => {
    useLocalSupabase();

    const created = await createDirectoryGuest(
      createServerSupabaseClient(),
      {
        fullName: "   ",
        nickname: null,
        phone: "",
        isChild: false,
      },
      "CO",
    );

    expect(created.refusals).toEqual(["member_without_name"]);
    expect(created.guest).toBeNull();
  });

  /**
   * THE HOUSEHOLD COMES BACK WITH THE PERSON, OR NULL DOES.
   *
   * A directory row that could not say where somebody already is would make
   * the couple's rule invisible: the reader would have no way to tell an
   * unplaced guest from a placed one, and the picker would have nothing to
   * filter on.
   */
  it("reads a guest back with the household holding them", async () => {
    useLocalSupabase();
    const placedName = uniqueName("Colocada");
    const household = await seedHousehold(placedName);

    const looseName = uniqueName("Suelta");
    await createDirectoryGuest(
      createServerSupabaseClient(),
      {
        fullName: looseName,
        nickname: null,
        phone: "",
        isChild: false,
      },
      "CO",
    );

    const directory = await listGuestDirectory(createServerSupabaseClient());
    const placed = directory.find((row) => row.fullName === placedName);
    const loose = directory.find((row) => row.fullName === looseName);

    /*
      OWNERSHIP AND THE CHOSEN RECIPIENT TRAVEL WITH THE HOUSEHOLD, and both
      are load-bearing rather than decorative: a send affordance on this
      person's row is offered only to the operator who OWNS the invitation —
      the dispatch route answers `notFound()` to the other one — and it has to
      name who the message actually reaches, which is not necessarily the
      person whose row is being read.
    */
    expect(placed?.household).toEqual({
      invitationId: household.invitationId,
      greetingName: household.greetingName,
      ownerSenderId: household.senderId,
      recipientGuestId: null,
    });
    expect(loose?.household).toBeNull();
  });

  it("rewrites a guest's own details without moving them out of their household", async () => {
    useLocalSupabase();
    const household = await seedHousehold(uniqueName("Por Corregir"));
    const corrected = uniqueName("Ya Corregida");

    const refusals = await updateDirectoryGuest(
      createServerSupabaseClient(),
      household.guestId,
      {
        fullName: corrected,
        nickname: null,
        phone: "3005559002",
        isChild: true,
      },
      "CO",
    );

    const directory = await listGuestDirectory(createServerSupabaseClient());
    const stored = directory.find((row) => row.id === household.guestId);

    expect(refusals).toEqual([]);
    expect(stored).toMatchObject({
      fullName: corrected,
      phoneE164: "+573005559002",
      isChild: true,
    });
    // Editing a name is not a move. The household is untouched, which is what
    // keeps "corregir el nombre" from silently emptying an invitation.
    expect(stored?.household?.invitationId).toBe(household.invitationId);
  });

  it("refuses to blank out a stored name", async () => {
    useLocalSupabase();
    const original = uniqueName("Conserva El Nombre");
    const household = await seedHousehold(original);

    const refusals = await updateDirectoryGuest(
      createServerSupabaseClient(),
      household.guestId,
      { fullName: "  ", nickname: null, phone: "", isChild: false },
      "CO",
    );

    const directory = await listGuestDirectory(createServerSupabaseClient());

    expect(refusals).toEqual(["member_without_name"]);
    expect(
      directory.find((row) => row.id === household.guestId)?.fullName,
    ).toBe(original);
  });

  it("removes a guest from the directory entirely", async () => {
    useLocalSupabase();
    const fullName = uniqueName("Para Borrar");
    const created = await createDirectoryGuest(
      createServerSupabaseClient(),
      {
        fullName,
        nickname: null,
        phone: "",
        isChild: false,
      },
      "CO",
    );

    await deleteDirectoryGuest(createServerSupabaseClient(), created.guest!.id);

    const directory = await listGuestDirectory(createServerSupabaseClient());

    expect(directory.find((row) => row.fullName === fullName)).toBeUndefined();
  });

  /**
   * DELETING FROM THE DIRECTORY IS DELETING THE PERSON, INCLUDING FROM THEIR
   * HOUSEHOLD — and the invitation survives it.
   *
   * The alternative would be to refuse, which sounds safer and is worse: the
   * operator would have to find the household, remove the person there, and
   * come back, for what they already said they wanted. The invitation losing a
   * member is the ordinary case `removeMember` has always handled.
   */
  it("deletes a placed guest and leaves their invitation standing", async () => {
    useLocalSupabase();
    const household = await seedHousehold(uniqueName("Placed Then Gone"));

    await deleteDirectoryGuest(createServerSupabaseClient(), household.guestId);

    const survived = await withDb(async (db) => {
      const result = await db.query<{ id: string }>(
        "select id from invitations where id = $1",
        [household.invitationId],
      );

      return result.rows;
    });

    expect(survived).toHaveLength(1);
  });
});

/**
 * PLACING A GUEST INTO A HOUSEHOLD — the couple's rule, enforced.
 *
 * "Cuando un invitado pertenece a una invitación no debe poder pertenecer a
 * otra, no se debería poder escoger en una próxima invitación." Two halves:
 * the picker must not OFFER somebody already placed, which is what
 * `listFreeGuests` is for; and the write must REFUSE one even if it is asked,
 * which is what the conditional update below is for.
 *
 * The second half is not belt and braces. There are two operators on two
 * phones looking at two renders of the same list, and a page that was correct
 * when it loaded is a page that can be wrong when it is submitted.
 */
describe("placing a guest into an invitation", () => {
  it("offers only the people who belong to no household", async () => {
    useLocalSupabase();
    const placedName = uniqueName("Ya Colocada");
    await seedHousehold(placedName);

    const looseName = uniqueName("Todavía Suelta");
    await createDirectoryGuest(
      createServerSupabaseClient(),
      { fullName: looseName, nickname: null, phone: "", isChild: false },
      "CO",
    );

    const free = await listFreeGuests(createServerSupabaseClient());
    const names = free.map((guest) => guest.fullName);

    expect(names).toContain(looseName);
    expect(names).not.toContain(placedName);
    // And every one of them says so, which is what the picker renders against.
    expect(free.every((guest) => guest.household === null)).toBe(true);
  });

  it("puts a free guest into the household that asked for them", async () => {
    useLocalSupabase();
    const household = await seedHousehold(uniqueName("Recibe Gente"));
    const created = await createDirectoryGuest(
      createServerSupabaseClient(),
      {
        fullName: uniqueName("Se Suma"),
        nickname: null,
        phone: "",
        isChild: false,
      },
      "CO",
    );

    const placed = await placeGuestInInvitation(
      createServerSupabaseClient(),
      created.guest!.id,
      household.invitationId,
    );

    const directory = await listGuestDirectory(createServerSupabaseClient());
    const stored = directory.find((row) => row.id === created.guest!.id);

    expect(placed).toBe(true);
    expect(stored?.household?.invitationId).toBe(household.invitationId);
  });

  /**
   * THE REFUSAL IS A `WHERE`, NOT A READ FOLLOWED BY A WRITE.
   *
   * `invitation_id is null` is part of the UPDATE itself, so two operators
   * submitting the same person at the same moment cannot both succeed: one
   * statement matches a row and the other matches none. A read-then-write
   * would leave a window between the check and the write in which the honest
   * answer changes, and the loser would silently steal somebody out of the
   * other household.
   */
  it("refuses to take somebody who already belongs to another household", async () => {
    useLocalSupabase();
    const theirs = await seedHousehold(uniqueName("Ya Tiene Dueño"));
    const ours = await seedHousehold(uniqueName("Quiere Robar"));

    const placed = await placeGuestInInvitation(
      createServerSupabaseClient(),
      theirs.guestId,
      ours.invitationId,
    );

    const directory = await listGuestDirectory(createServerSupabaseClient());
    const stored = directory.find((row) => row.id === theirs.guestId);

    expect(placed).toBe(false);
    // Untouched: a refusal that had already moved them would be worse than no
    // refusal at all.
    expect(stored?.household?.invitationId).toBe(theirs.invitationId);
  });
});
