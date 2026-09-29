import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postEventBeacon } from "@/lib/browser/beacon";
import { browserNavigation } from "@/lib/browser/navigation";

import {
  DispatchLauncher,
  dispatchStashKey,
  type DispatchLauncherProps,
} from "./DispatchLauncher";

// The transport is mocked at the module boundary rather than spied on the
// namespace: ESM exports are read-only bindings, and a test that appeared to
// replace one would silently keep calling the real implementation.
vi.mock("@/lib/browser/beacon", () => ({
  postEventBeacon: vi.fn(() => "beacon"),
}));

const post = vi.mocked(postEventBeacon);

/**
 * The two-step dispatch, and the ordering that makes it safe.
 *
 * THE ORDERING IS THE WHOLE TEST FILE
 *
 * The `link_opened` event has to be written BEFORE the handoff, and the handoff
 * must never wait on it. A guest who never receives their invitation because a
 * logging call hung is the worst outcome available here, and an `await` in the
 * click handler is all it would take to produce it. Both halves are asserted:
 * the beacon goes first, and the handoff happens synchronously inside the same
 * click. That was true while the destination was `wa.me` and the page unloaded
 * under it, and it stays true now that the destination is `whatsapp://` and the
 * page does not.
 *
 * THE TWO STEPS ARE TWO DIFFERENT FACTS
 *
 * Opening the link records `link_opened`, which claims only that WhatsApp was
 * opened. The application has no sensor for a delivery: the operator is the only
 * one there is. So the send itself is a separate, explicit confirmation, and the
 * copy says so rather than letting an opened link read as a send.
 *
 * WHAT THE CUSTOM SCHEME CHANGED, AND WHY IT NEEDED TESTS OF ITS OWN
 *
 * `whatsapp://` is handed to the operating system; the document survives it.
 * Two consequences, both asserted below. The question "¿se envió?" can no
 * longer wait for a `visibilitychange` that may never arrive, so pressing the
 * button asks it directly. And the handoff fails SILENTLY when no application
 * claims the scheme — nothing happens at all — so the same press reveals the
 * web route, which is the one that degrades into a visible page.
 */

const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const WA_URL = "whatsapp://send?phone=573001234567&text=Hola";
const WEB_FALLBACK_URL = "https://wa.me/573001234567?text=Hola";
const BEACON_PATH = "/console/api/dispatch-event";

function props(
  overrides: Partial<DispatchLauncherProps> = {},
): DispatchLauncherProps {
  return {
    invitationId: INVITATION_ID,
    greetingName: "Familia Muñóz",
    recipientName: "Ana Muñóz",
    waUrl: WA_URL,
    webFallbackUrl: WEB_FALLBACK_URL,
    beaconPath: BEACON_PATH,
    dispatchState: "not_dispatched",
    markSentAction: vi.fn<(formData: FormData) => void>(),
    markFailedAction: vi.fn<(formData: FormData) => void>(),
    ...overrides,
  };
}

function openButton() {
  return screen.getByRole("button", { name: /Abrir WhatsApp/i });
}

function fallbackButton() {
  return screen.getByRole("button", { name: /en el navegador/i });
}

beforeEach(() => {
  window.sessionStorage.clear();
  post.mockClear();
  post.mockReturnValue("beacon");
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("DispatchLauncher", () => {
  it("names the household and the person the draft is addressed to", () => {
    render(<DispatchLauncher {...props()} />);

    expect(screen.getByText(/Familia Muñóz/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Muñóz/)).toBeInTheDocument();
  });

  it("writes the opened-link event BEFORE it hands off", () => {
    const order: string[] = [];
    post.mockImplementation(() => {
      order.push("beacon");
      return "beacon";
    });
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {
      order.push("navigate");
    });

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(order).toEqual(["beacon", "navigate"]);
  });

  it("hands off synchronously inside the click, awaiting nothing", () => {
    // `fireEvent` does not flush microtasks. If the handler awaited ANYTHING
    // before handing off, `assign` would not have run by the time this assertion
    // executes — which is exactly the delay that must never exist.
    const assign = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(WA_URL);
  });

  it("hands off even when the event could not be written at all", () => {
    // A logging endpoint that is down must not cost a guest their invitation.
    const assign = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});
    post.mockReturnValue("unavailable");

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(WA_URL);
  });

  it("posts the invitation and a freshly minted client event id", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe(BEACON_PATH);
    const payload = post.mock.calls[0][1] as Record<string, string>;
    expect(payload.invitationId).toBe(INVITATION_ID);
    expect(payload.clientEventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("stashes that client event id so the retry on return is the same event", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    const payload = post.mock.calls[0][1] as Record<string, string>;
    expect(window.sessionStorage.getItem(dispatchStashKey(INVITATION_ID))).toBe(
      payload.clientEventId,
    );
  });

  it("re-posts the SAME event id when the operator comes back, never a new one", () => {
    // The write happens as the page unloads and can be lost. The retry is the
    // reconciliation, and reusing the stashed id is what stops it from becoming
    // a second opened-link event for one click.
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());
    const first = (post.mock.calls[0][1] as Record<string, string>)
      .clientEventId;

    fireEvent(document, new Event("visibilitychange"));

    expect(post).toHaveBeenCalledTimes(2);
    expect(
      (post.mock.calls[1][1] as Record<string, string>).clientEventId,
    ).toBe(first);
  });

  it("reconciles a stash left behind by a previous visit, on mount", async () => {
    // Returning from WhatsApp is not always a visibility change: on a desktop
    // the tab may have been replaced outright and the console re-rendered from
    // scratch. The stash is what survives both routes back.
    window.sessionStorage.setItem(
      dispatchStashKey(INVITATION_ID),
      "3f1c2b9a-1111-4111-8111-111111111111",
    );

    render(<DispatchLauncher {...props()} />);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(
      (post.mock.calls[0][1] as Record<string, string>).clientEventId,
    ).toBe("3f1c2b9a-1111-4111-8111-111111111111");
    expect(
      await screen.findByRole("button", { name: /Marcar como enviada/i }),
    ).toBeInTheDocument();
  });

  it("does not reconcile anything before a link has ever been opened", () => {
    render(<DispatchLauncher {...props()} />);
    fireEvent(document, new Event("visibilitychange"));

    expect(post).not.toHaveBeenCalled();
  });

  it("asks what actually happened only after the link was opened", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    expect(
      screen.queryByRole("button", { name: /Marcar como enviada/i }),
    ).toBeNull();

    fireEvent.click(openButton());
    fireEvent(document, new Event("visibilitychange"));

    expect(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /No se pudo enviar/i }),
    ).toBeInTheDocument();
  });

  it("submits the invitation when the operator confirms the send", async () => {
    const markSentAction = vi.fn<(formData: FormData) => void>();
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props({ markSentAction })} />);
    fireEvent.click(openButton());
    fireEvent(document, new Event("visibilitychange"));
    await userEvent.click(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    );

    await waitFor(() => expect(markSentAction).toHaveBeenCalledTimes(1));
    expect(
      (markSentAction.mock.calls[0][0] as FormData).get("invitationId"),
    ).toBe(INVITATION_ID);
  });

  it("submits the invitation when the operator reports a failure", async () => {
    const markFailedAction = vi.fn<(formData: FormData) => void>();
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props({ markFailedAction })} />);
    fireEvent.click(openButton());
    fireEvent(document, new Event("visibilitychange"));
    await userEvent.click(
      screen.getByRole("button", { name: /No se pudo enviar/i }),
    );

    await waitFor(() => expect(markFailedAction).toHaveBeenCalledTimes(1));
    expect(
      (markFailedAction.mock.calls[0][0] as FormData).get("invitationId"),
    ).toBe(INVITATION_ID);
  });

  it("clears the stash once the operator has answered, so a later visit does not re-open it", async () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());
    fireEvent(document, new Event("visibilitychange"));
    await userEvent.click(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    );

    await waitFor(() =>
      expect(
        window.sessionStorage.getItem(dispatchStashKey(INVITATION_ID)),
      ).toBeNull(),
    );
  });

  /**
   * A plain `<a href="https://wa.me/...">` next to the button would be a second
   * way to open the link that writes no event at all — and the operator would
   * reach for whichever came first. One path, so every open is recorded.
   */
  it("offers no second route to wa.me that would skip the recording", () => {
    const { container } = render(<DispatchLauncher {...props()} />);

    expect(container.querySelectorAll('a[href*="wa.me"]')).toHaveLength(0);
  });

  it("offers no route to WhatsApp at all until the recorded one is pressed", () => {
    // The scheme changed, so the shape of a leak did too. Neither destination
    // may exist as an anchor before the button has written the event.
    const { container } = render(<DispatchLauncher {...props()} />);

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /en el navegador/i }),
    ).toBeNull();
  });

  it("never labels an opened link as a send", () => {
    render(<DispatchLauncher {...props({ dispatchState: "link_opened" })} />);

    expect(
      screen.getByText("Enlace abierto, envío sin confirmar"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Marcada como enviada")).toBeNull();
  });

  it("shows a confirmed send as confirmed", () => {
    render(<DispatchLauncher {...props({ dispatchState: "marked_sent" })} />);

    expect(screen.getByText("Marcada como enviada")).toBeInTheDocument();
  });

  it("says out loud that the application cannot observe the send itself", () => {
    render(<DispatchLauncher {...props()} />);

    expect(
      screen.getByText(/no puede saber|no puede confirmar/i),
    ).toBeInTheDocument();
  });
});

/**
 * THE HANDOFF DOES NOT LEAVE THE PAGE, AND THAT MOVED A QUESTION.
 *
 * `wa.me` was a navigation: the document went away and came back, and the
 * console asked "¿se envió?" because it had been re-rendered or because the
 * tab became visible again. `whatsapp://` is handed to the operating system —
 * measured in Chromium 1243 and WebKit 26.6, the document survives it, no
 * request is made, `pagehide` never fires — and on a desktop another
 * application taking focus does NOT make the tab hidden. So neither route back
 * fires, and the question that records every send would simply never be asked.
 *
 * The press asks it. That is the whole of this block, and it is the difference
 * between a working two-step dispatch and an invitation nobody can mark.
 */
describe("DispatchLauncher — the press, not the return, is what asks", () => {
  it("asks whether it was sent as soon as the link is opened", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    // No `visibilitychange`, no remount: only the click happened.
    expect(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    ).toBeInTheDocument();
  });

  it("asks it after the handoff rather than before, so nothing is inserted between", () => {
    const order: string[] = [];
    post.mockImplementation(() => {
      order.push("beacon");
      return "beacon";
    });
    vi.spyOn(browserNavigation, "assign").mockImplementation((url) => {
      order.push(`navigate:${url}`);
    });

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(order).toEqual(["beacon", `navigate:${WA_URL}`]);
  });

  it("hands off the whatsapp:// URI, not the web page that redirects to it", () => {
    const assign = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(assign).toHaveBeenCalledWith(WA_URL);
    expect(assign).not.toHaveBeenCalledWith(WEB_FALLBACK_URL);
  });
});

/**
 * THE FALLBACK, AND WHY IT IS NOT THE SECOND ROUTE THE BUTTON RULE FORBIDS.
 *
 * `whatsapp://` fails silently. No handler, no error, no page — the operator
 * presses and nothing at all happens, and they cannot tell a missed click from
 * a machine without WhatsApp. `https://wa.me/` is the link that degrades
 * visibly: it answers with a page offering the download.
 *
 * It is offered ONLY after the primary was pressed. The rule the single route
 * exists to protect is that no open goes unrecorded and that the operator
 * cannot reach for the unrecorded one first — by the time this control exists,
 * `link_opened` has already been written for this invitation and the stashed
 * id is what reconciles it. So this control writes no event of its own: a
 * second write for one press would be the same event twice, which is exactly
 * what the stash and `dispatch_events_client_event_idx` exist to prevent.
 */
describe("DispatchLauncher — the fallback for a scheme nobody answered", () => {
  it("appears only after the recorded link has been opened", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    expect(
      screen.queryByRole("button", { name: /en el navegador/i }),
    ).toBeNull();

    fireEvent.click(openButton());

    expect(fallbackButton()).toBeInTheDocument();
  });

  it("opens the wa.me link, which is the one that shows a page when nothing is installed", () => {
    const openInNewTab = vi
      .spyOn(browserNavigation, "openInNewTab")
      .mockImplementation(() => {});
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    fireEvent.click(fallbackButton());

    expect(openInNewTab).toHaveBeenCalledTimes(1);
    expect(openInNewTab).toHaveBeenCalledWith(WEB_FALLBACK_URL);
  });

  /**
   * IT OPENS A NEW TAB, AND THAT IS THE COUPLE'S CORRECTION RATHER THAN A
   * PREFERENCE.
   *
   * "ese abrirlo en el navegador debe abrirse en una nueva pestaña no en la
   * actual". The reason is the property this whole unit turns on: the
   * `whatsapp://` handoff leaves the document alive, which is the only reason
   * "¿Se envió el mensaje?" can be asked at the press at all. A fallback that
   * navigated the current tab would take that question away with it, and the
   * operator would have to find their way back to record a send they had
   * already made — the exact audit gap the two-step design exists to close.
   *
   * So the fallback has to preserve what the primary now preserves: the
   * console survives the press. Asserted as the absence of a navigation AND as
   * the survival of the confirmation, because a test that only checked the
   * fallback carried the right draft would pass on the broken version.
   */
  it("never navigates the console away, whatever it opens", () => {
    const assign = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});
    vi.spyOn(browserNavigation, "openInNewTab").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());
    assign.mockClear();

    fireEvent.click(fallbackButton());

    expect(assign).not.toHaveBeenCalled();
  });

  it("leaves the question standing, so the send can still be recorded", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
    vi.spyOn(browserNavigation, "openInNewTab").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());
    fireEvent.click(fallbackButton());

    expect(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /No se pudo enviar/i }),
    ).toBeInTheDocument();
  });

  it("still records the send after the fallback was used", async () => {
    // The end of the audit gap, asserted rather than inferred from the button
    // being present: the confirmation has to reach the action.
    const markSentAction = vi.fn<(formData: FormData) => void>();
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
    vi.spyOn(browserNavigation, "openInNewTab").mockImplementation(() => {});

    render(<DispatchLauncher {...props({ markSentAction })} />);
    fireEvent.click(openButton());
    fireEvent.click(fallbackButton());
    await userEvent.click(
      screen.getByRole("button", { name: /Marcar como enviada/i }),
    );

    await waitFor(() => expect(markSentAction).toHaveBeenCalledTimes(1));
    expect(
      (markSentAction.mock.calls[0][0] as FormData).get("invitationId"),
    ).toBe(INVITATION_ID);
  });

  it("writes no second event, because the press that revealed it already wrote one", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});
    vi.spyOn(browserNavigation, "openInNewTab").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());
    expect(post).toHaveBeenCalledTimes(1);

    fireEvent.click(fallbackButton());

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("is a button like the primary, never an anchor", () => {
    // An anchor would be reachable by a middle click, a context menu and a
    // keyboard copy before anything was recorded — the exact affordance the
    // primary is a button to avoid.
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    const { container } = render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(fallbackButton().tagName).toBe("BUTTON");
  });

  it("says what silence means, so a dead press is not read as a missed click", () => {
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(screen.getByText(/si whatsapp no se abrió/i)).toBeInTheDocument();
  });

  it("keeps the only primary button on the screen the primary one", () => {
    // Gold means "this needs your attention" and there is one thing here that
    // does. A fallback styled as a second primary would make the press that
    // records the event compete with the one that does not.
    vi.spyOn(browserNavigation, "assign").mockImplementation(() => {});

    const { container } = render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    const primaries = container.querySelectorAll(
      'button[data-variant="default"]',
    );

    expect(primaries).toHaveLength(1);
    expect(primaries[0].textContent).toMatch(/Abrir WhatsApp/);
  });
});
