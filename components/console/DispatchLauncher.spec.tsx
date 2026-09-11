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
 * Navigating to `wa.me` LEAVES the page. So the `link_opened` event has to be
 * written BEFORE the navigation, and the navigation must never wait on it. A
 * guest who never receives their invitation because a logging call hung is the
 * worst outcome available here, and an `await` in the click handler is all it
 * would take to produce it. Both halves are asserted: the beacon goes first,
 * and the navigation happens synchronously inside the same click.
 *
 * THE TWO STEPS ARE TWO DIFFERENT FACTS
 *
 * Opening the link records `link_opened`, which claims only that WhatsApp was
 * opened. The application has no sensor for a delivery: the operator is the only
 * one there is. So the send itself is a separate, explicit confirmation, and the
 * copy says so rather than letting an opened link read as a send.
 */

const INVITATION_ID = "11111111-1111-4111-8111-111111111111";
const WA_URL = "https://wa.me/573001234567?text=Hola";
const BEACON_PATH = "/console/api/dispatch-event";

function props(
  overrides: Partial<DispatchLauncherProps> = {},
): DispatchLauncherProps {
  return {
    invitationId: INVITATION_ID,
    greetingName: "Familia Muñóz",
    recipientName: "Ana Muñóz",
    waUrl: WA_URL,
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

  it("writes the opened-link event BEFORE it navigates away", () => {
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

  it("navigates synchronously inside the click, awaiting nothing", () => {
    // `fireEvent` does not flush microtasks. If the handler awaited ANYTHING
    // before navigating, `assign` would not have run by the time this assertion
    // executes — which is exactly the delay that must never exist.
    const assign = vi
      .spyOn(browserNavigation, "assign")
      .mockImplementation(() => {});

    render(<DispatchLauncher {...props()} />);
    fireEvent.click(openButton());

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(WA_URL);
  });

  it("navigates even when the event could not be written at all", () => {
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
