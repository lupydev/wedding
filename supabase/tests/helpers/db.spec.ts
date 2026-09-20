import { describe, expect, it } from "vitest";

import { retryOnLockContention } from "./db";

/**
 * THE RETRY POLICY, PROVED WHERE IT CAN BE.
 *
 * The deadlock this exists for is a race between two connections and cannot be
 * summoned to order, so a test that waited for one would be slow, flaky, or
 * quietly proving nothing. What CAN be pinned is the decision: repeat a `40P01`,
 * and nothing else.
 *
 * These cases touch no database, which is the point rather than a convenience.
 * Driving the policy through `withExclusiveSchema` would open four more
 * transactions taking ACCESS EXCLUSIVE on two tables — widening the very window
 * this code exists to survive, in order to test the code that survives it.
 */

/** A rejection shaped like the one `pg` raises when Postgres breaks a cycle. */
function deadlock(): Error {
  return Object.assign(new Error("deadlock detected"), { code: "40P01" });
}

describe("retryOnLockContention", () => {
  it("runs the work once when nothing goes wrong", async () => {
    let calls = 0;

    const seen = await retryOnLockContention(async () => {
      calls += 1;

      return "done";
    });

    expect(seen).toBe("done");
    expect(calls).toBe(1);
  });

  it("runs it again when Postgres reports a deadlock", async () => {
    let calls = 0;

    const seen = await retryOnLockContention(async () => {
      calls += 1;

      if (calls === 1) {
        throw deadlock();
      }

      return "recovered";
    });

    expect(seen).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("gives up rather than repeating forever", async () => {
    let calls = 0;

    await expect(
      retryOnLockContention(async () => {
        calls += 1;

        throw deadlock();
      }),
    ).rejects.toThrow(/deadlock detected/);

    // The default bound, stated here so changing it is a decision and not a drift.
    expect(calls).toBe(4);
  });

  it("repeats a lock wait that timed out, not only a detected cycle", async () => {
    // 55P03 is `lock_not_available`: the schema helper sets a `lock_timeout`
    // below Postgres's 1000ms `deadlock_timeout` so its OWN wait aborts before
    // the detector can pick a victim. That makes this code the ordinary outcome
    // of contention here, and a retry that only knew 40P01 would turn the
    // mechanism into a hard failure.
    let calls = 0;

    const seen = await retryOnLockContention(async () => {
      calls += 1;

      if (calls === 1) {
        throw Object.assign(
          new Error("canceling statement due to lock timeout"),
          {
            code: "55P03",
          },
        );
      }

      return "recovered";
    });

    expect(seen).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("does NOT repeat anything that is not a deadlock", async () => {
    // The half that keeps a real failure readable. Repeating a broken migration
    // would report it four times and bury which attempt mattered.
    let calls = 0;

    await expect(
      retryOnLockContention(async () => {
        calls += 1;

        throw new Error("the down script is malformed");
      }),
    ).rejects.toThrow(/malformed/);

    expect(calls).toBe(1);
  });

  it("honours a caller that asks for a single attempt", async () => {
    // `attempts` is a parameter, so a caller with side effects it cannot repeat
    // has a way to say so. Unproved, that argument silently does nothing.
    let calls = 0;

    await expect(
      retryOnLockContention(async () => {
        calls += 1;

        throw deadlock();
      }, 1),
    ).rejects.toThrow(/deadlock detected/);

    expect(calls).toBe(1);
  });
});
