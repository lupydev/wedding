"use client";

import { useActionState } from "react";

import { WeddingFactsForm } from "@/components/console/WeddingFactsForm";
import type { WeddingFacts } from "@/lib/domain/wedding-facts";

import {
  IDLE_WEDDING_FACTS_STATE,
  type WeddingFactsState,
} from "./wedding-facts-state";

/**
 * The hook, and nothing else.
 *
 * The same split as `ConsoleNavCurrent`, for the same reason: every rule worth
 * asserting lives in `WeddingFactsForm`, which takes its state as a prop and is
 * therefore testable with no hook to drive and no session to fake. What is left
 * here is `useActionState`, which has no rule in it — so there is nothing in this
 * file a test could usefully hold.
 */

export type SaveWeddingFactsAction = (
  previous: WeddingFactsState,
  formData: FormData,
) => Promise<WeddingFactsState>;

export function WeddingFactsEditor({
  facts,
  action,
}: {
  readonly facts: WeddingFacts;
  readonly action: SaveWeddingFactsAction;
}) {
  const [state, submit, pending] = useActionState(
    action,
    IDLE_WEDDING_FACTS_STATE,
  );

  return (
    <WeddingFactsForm
      action={submit}
      facts={facts}
      pending={pending}
      state={state}
    />
  );
}
