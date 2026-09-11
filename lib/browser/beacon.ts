/**
 * Fire-and-forget event writes from the browser.
 *
 * THE ORDERING THIS MODULE EXISTS TO PROTECT
 *
 * Opening a `wa.me` link LEAVES the page. The dispatch event has to be written
 * BEFORE that navigation, and the navigation must NEVER be blocked on the write
 * succeeding. A guest who never receives their invitation because a logging
 * call hung is the worst outcome available here; a missing row in an audit log
 * is an inconvenience, and it is reconciled on return anyway.
 *
 * `navigator.sendBeacon` is the one transport that satisfies both halves: the
 * user agent queues the request and delivers it after unload, and the call
 * returns a boolean SYNCHRONOUSLY. Nothing in this module awaits anything, and
 * nothing in it throws — a failure comes back as a value the caller may ignore,
 * because the caller's next statement is the navigation.
 *
 * Why the payload goes as `text/plain` rather than `application/json`: the
 * content type of a beacon body is chosen by the user agent from the Blob, and
 * a JSON type puts the request outside the CORS-safelisted set. The route
 * handler reads the body as text and parses it, which also means one parser
 * covers both transports.
 */

/** Which transport carried the payload, or that none could. */
export type BeaconTransport = "beacon" | "keepalive_fetch" | "unavailable";

const BEACON_CONTENT_TYPE = "text/plain;charset=UTF-8";

/**
 * Posts one small JSON payload without waiting for it.
 *
 * Returns synchronously in every path, including the fallback: the returned
 * value describes which transport was used, never whether the server accepted
 * it. Nothing here can tell you that, and pretending otherwise would mean
 * awaiting.
 */
export function postEventBeacon(
  url: string,
  payload: unknown,
): BeaconTransport {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator?.sendBeacon === "function") {
      const queued = navigator.sendBeacon(
        url,
        new Blob([body], { type: BEACON_CONTENT_TYPE }),
      );

      if (queued) {
        return "beacon";
      }
    }
  } catch {
    // Some user agents throw instead of returning false when the payload is
    // over quota. Fall through: an exception here must not reach the click
    // handler that is about to navigate.
  }

  if (typeof fetch !== "function") {
    return "unavailable";
  }

  try {
    // NOT awaited, on purpose, and `.catch` rather than `await` so a rejected
    // request cannot surface as an unhandled rejection after the page is gone.
    void fetch(url, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": BEACON_CONTENT_TYPE },
    }).catch(() => undefined);
  } catch {
    return "unavailable";
  }

  return "keepalive_fetch";
}
