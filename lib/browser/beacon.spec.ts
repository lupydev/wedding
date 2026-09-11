// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { postEventBeacon } from "./beacon";

/**
 * The write that must never delay the navigation it precedes.
 *
 * Opening a `wa.me` link LEAVES the page. An ordinary `fetch` is cancelled on
 * unload, and an awaited one delays the navigation the operator just asked for.
 * `navigator.sendBeacon` is queued by the user agent, survives unload, and
 * returns a boolean SYNCHRONOUSLY — which is the property this module exists to
 * preserve and the property these tests assert.
 *
 * The trade being protected is stark: a guest who never receives their message
 * because a logging call hung is a far worse outcome than an event row that was
 * never written. So every path here returns without waiting for anything, and a
 * failure is reported as a value rather than thrown.
 */

const ENDPOINT = "/console/api/dispatch-event";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postEventBeacon", () => {
  it("hands the payload to sendBeacon and says so", () => {
    const sendBeacon = vi.fn<typeof navigator.sendBeacon>(() => true);
    vi.stubGlobal("navigator", { sendBeacon });

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe("beacon");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe(ENDPOINT);
  });

  it("sends the payload as JSON text the route can parse", async () => {
    const sendBeacon = vi.fn<typeof navigator.sendBeacon>(() => true);
    vi.stubGlobal("navigator", { sendBeacon });

    postEventBeacon(ENDPOINT, { kind: "link_opened", clientEventId: "abc" });

    const body = sendBeacon.mock.calls[0][1] as Blob;
    expect(JSON.parse(await body.text())).toEqual({
      kind: "link_opened",
      clientEventId: "abc",
    });
  });

  it("falls back to a keepalive fetch when the beacon queue refuses the payload", () => {
    // `sendBeacon` returns false when the user agent's queue is full. The event
    // is worth one more attempt; the navigation is not worth delaying for it.
    const sendBeacon = vi.fn<typeof navigator.sendBeacon>(() => false);
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => {}),
    );
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchImpl);

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe(
      "keepalive_fetch",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      keepalive: true,
    });
  });

  it("returns before the fallback request settles, so nothing waits on it", () => {
    // The fetch below never resolves. A synchronous return proves the call site
    // cannot be blocked by a hung logging endpoint.
    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn<typeof navigator.sendBeacon>(() => false),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {})),
    );

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe(
      "keepalive_fetch",
    );
  });

  it("swallows a rejected fallback instead of raising an unhandled rejection", async () => {
    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn<typeof navigator.sendBeacon>(() => false),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => Promise.reject(new Error("network down"))),
    );

    expect(() =>
      postEventBeacon(ENDPOINT, { kind: "link_opened" }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it("falls back when the user agent has no sendBeacon at all", () => {
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => {}),
    );
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchImpl);

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe(
      "keepalive_fetch",
    );
  });

  it("reports that it could not send rather than throwing when neither transport exists", () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", undefined);

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe(
      "unavailable",
    );
  });

  it("reports that it could not send when sendBeacon itself throws", () => {
    // Safari has historically thrown here for a payload over its quota.
    vi.stubGlobal("navigator", {
      sendBeacon: vi.fn<typeof navigator.sendBeacon>(() => {
        throw new Error("quota exceeded");
      }),
    });
    vi.stubGlobal("fetch", undefined);

    expect(postEventBeacon(ENDPOINT, { kind: "link_opened" })).toBe(
      "unavailable",
    );
  });
});
