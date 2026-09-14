import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { withDb } from "../../supabase/tests/helpers/db";
import { resolveLocalKeys } from "../../supabase/tests/helpers/local-keys";

import {
  listDispatchEvents,
  markFailed,
  markSent,
  recordDispatchEvent,
  recordLinkOpened,
} from "./dispatch";
import { createServerSupabaseClient } from "./supabase";

/**
 * The append-only dispatch log.
 *
 * Three properties are worth a database rather than a mock, because all three
 * are enforced by the schema and not by this module:
 *
 *  1. `dispatch_events_client_event_idx` is what makes a beacon write
 *     idempotent. The reconciliation on return re-posts the same
 *     `client_event_id`, and if the index did not dedupe it the console would
 *     count one opened link twice.
 *  2. `actor_sender_id` and `invitations.owner_sender_id` are separate columns
 *     on purpose. An event where they differ MUST be stored with both intact —
 *     that pair is the audit trail for "the bride sent from the groom's phone",
 *     and a module that refused the write would destroy the only evidence.
 *  3. The `before update or delete` trigger makes the table append-only. A
 *     "correction" is another row, never an edit.
 */

const CONSOLE_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function makeSlug(): string {
  let slug = "";

  for (let index = 0; index < 16; index += 1) {
    slug +=
      CONSOLE_SLUG_ALPHABET[
        Math.floor(Math.random() * CONSOLE_SLUG_ALPHABET.length)
      ];
  }

  return slug;
}

interface DispatchFixture {
  readonly ownerId: string;
  readonly otherId: string;
  readonly invitationId: string;
}

/**
 * Two senders and one invitation owned by the first, committed.
 *
 * Committed rather than rolled back: `createServerSupabaseClient()` reaches
 * Postgres over HTTP through PostgREST on its own connection, so an uncommitted
 * fixture is invisible to the code under test.
 */
async function withDispatchFixture(
  body: (fixture: DispatchFixture) => Promise<void>,
): Promise<void> {
  const { secretKey } = resolveLocalKeys();
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SECRET_KEY = secretKey;

  const fixture = await withDb(async (db) => {
    const senders = await db.query<{ id: string }>(
      `insert into senders (display_name, role, allowlisted_email, contact_wa_phone_e164)
       values ('Ana Dispatch', 'partner_a', $1, '+573005550101'),
              ('Beto Dispatch', 'partner_b', $2, '+573005550102')
       returning id`,
      [
        `ana.dispatch.${randomUUID()}@example.test`,
        `beto.dispatch.${randomUUID()}@example.test`,
      ],
    );
    const invitation = await db.query<{ id: string }>(
      `insert into invitations (slug, owner_sender_id, display_name, greeting_name)
       values ($1, $2, 'Familia Dispatch', 'Familia Dispatch')
       returning id`,
      [makeSlug(), senders.rows[0].id],
    );

    return {
      ownerId: senders.rows[0].id,
      otherId: senders.rows[1].id,
      invitationId: invitation.rows[0].id,
    };
  });

  try {
    await body(fixture);
  } finally {
    await withDb(async (db) => {
      // The log is append-only by trigger and would refuse its own teardown.
      await db.query("set session_replication_role = replica");
      await db.query("delete from dispatch_events where invitation_id = $1", [
        fixture.invitationId,
      ]);
      await db.query("delete from invitations where id = $1", [
        fixture.invitationId,
      ]);
      await db.query("delete from senders where id = any($1)", [
        [fixture.ownerId, fixture.otherId],
      ]);
      await db.query("reset session_replication_role");
    });
  }
}

async function storedEvents(invitationId: string) {
  return withDb(async (db) => {
    const result = await db.query<{
      kind: string;
      actor_sender_id: string;
      client_event_id: string | null;
    }>(
      `select kind, actor_sender_id, client_event_id
       from dispatch_events where invitation_id = $1 order by occurred_at`,
      [invitationId],
    );

    return result.rows;
  });
}

describe("recordDispatchEvent", () => {
  it("writes the kind and attributes it to the acting sender", async () => {
    await withDispatchFixture(async (fixture) => {
      const outcome = await recordDispatchEvent(createServerSupabaseClient(), {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        kind: "link_opened",
      });

      expect(outcome).toEqual({ recorded: true });
      expect(await storedEvents(fixture.invitationId)).toEqual([
        {
          kind: "link_opened",
          actor_sender_id: fixture.ownerId,
          client_event_id: null,
        },
      ]);
    });
  });

  it("writes the same client event id only once, so a retry cannot double-count", async () => {
    await withDispatchFixture(async (fixture) => {
      const client = createServerSupabaseClient();
      const clientEventId = randomUUID();
      const input = {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        kind: "link_opened" as const,
        clientEventId,
      };

      const first = await recordDispatchEvent(client, input);
      const second = await recordDispatchEvent(client, input);

      expect(first).toEqual({ recorded: true });
      // Not an error: the reconciliation on return re-posts the stashed id by
      // design, and "already there" is the successful outcome of that retry.
      expect(second).toEqual({ recorded: false });
      expect(await storedEvents(fixture.invitationId)).toHaveLength(1);
    });
  });

  it("keeps two distinct client event ids as two distinct events", async () => {
    await withDispatchFixture(async (fixture) => {
      const client = createServerSupabaseClient();

      await recordDispatchEvent(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        kind: "link_opened",
        clientEventId: randomUUID(),
      });
      await recordDispatchEvent(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        kind: "link_opened",
        clientEventId: randomUUID(),
      });

      expect(await storedEvents(fixture.invitationId)).toHaveLength(2);
    });
  });

  it("does not collapse two events that carry no client event id", async () => {
    // The unique index is partial (`where client_event_id is not null`), so two
    // server-side confirmations are two facts and stay two rows.
    await withDispatchFixture(async (fixture) => {
      const client = createServerSupabaseClient();
      const input = {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        kind: "marked_sent" as const,
      };

      await recordDispatchEvent(client, input);
      await recordDispatchEvent(client, input);

      expect(await storedEvents(fixture.invitationId)).toHaveLength(2);
    });
  });

  it("stores an actor who is not the owner, instead of rejecting the write", async () => {
    // The mismatch is the finding. Refusing it here would remove the only
    // record that a message left from the wrong account.
    await withDispatchFixture(async (fixture) => {
      await recordDispatchEvent(createServerSupabaseClient(), {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.otherId,
        kind: "marked_sent",
      });

      const [stored] = await storedEvents(fixture.invitationId);
      expect(stored.actor_sender_id).toBe(fixture.otherId);
      expect(stored.actor_sender_id).not.toBe(fixture.ownerId);
    });
  });

  it("refuses an event for an invitation that does not exist", async () => {
    await withDispatchFixture(async (fixture) => {
      await expect(
        recordDispatchEvent(createServerSupabaseClient(), {
          invitationId: randomUUID(),
          actorSenderId: fixture.ownerId,
          kind: "link_opened",
        }),
      ).rejects.toThrow(/dispatch event/i);
    });
  });
});

describe("recordLinkOpened, markSent and markFailed", () => {
  it("records an opened link as link_opened and nothing stronger", async () => {
    await withDispatchFixture(async (fixture) => {
      await recordLinkOpened(createServerSupabaseClient(), {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        clientEventId: randomUUID(),
      });

      const [stored] = await storedEvents(fixture.invitationId);
      expect(stored.kind).toBe("link_opened");
    });
  });

  it("records the operator's own confirmation as marked_sent", async () => {
    await withDispatchFixture(async (fixture) => {
      await markSent(createServerSupabaseClient(), {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
      });

      expect((await storedEvents(fixture.invitationId))[0].kind).toBe(
        "marked_sent",
      );
    });
  });

  it("records a failure as marked_failed", async () => {
    await withDispatchFixture(async (fixture) => {
      await markFailed(createServerSupabaseClient(), {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
      });

      expect((await storedEvents(fixture.invitationId))[0].kind).toBe(
        "marked_failed",
      );
    });
  });

  it("appends a correction rather than editing the event it corrects", async () => {
    await withDispatchFixture(async (fixture) => {
      const client = createServerSupabaseClient();

      await markSent(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
      });
      await markFailed(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
      });

      expect(
        (await storedEvents(fixture.invitationId)).map((row) => row.kind),
      ).toEqual(["marked_sent", "marked_failed"]);
    });
  });
});

describe("listDispatchEvents", () => {
  it("returns this invitation's whole log, so the state can be reduced from it", async () => {
    await withDispatchFixture(async (fixture) => {
      const client = createServerSupabaseClient();

      await recordLinkOpened(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
        clientEventId: randomUUID(),
      });
      await markSent(client, {
        invitationId: fixture.invitationId,
        actorSenderId: fixture.ownerId,
      });

      const events = await listDispatchEvents(client, fixture.invitationId);

      expect(events.map((event) => event.kind).sort()).toEqual([
        "link_opened",
        "marked_sent",
      ]);
      for (const event of events) {
        expect(Number.isNaN(Date.parse(event.occurredAt))).toBe(false);
      }
    });
  });

  it("returns an empty log for an invitation nobody has dispatched", async () => {
    await withDispatchFixture(async (fixture) => {
      // Empty because nothing was written for it, not because the read failed:
      // the fixture above proves the same call returns rows when they exist.
      expect(
        await listDispatchEvents(
          createServerSupabaseClient(),
          fixture.invitationId,
        ),
      ).toEqual([]);
    });
  });
});
