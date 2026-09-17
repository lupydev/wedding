import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { InvitationForm } from "@/components/console/InvitationForm";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { classifyPhoneDispatchability } from "@/lib/domain/phone-reachability";
import { isWellFormedUuid } from "@/lib/domain/uuid";
import { requireOperator } from "@/lib/server/console-session";
import { listDispatchEvents } from "@/lib/server/dispatch";
import { requiredDefaultPhoneCountry } from "@/lib/server/env";
import { findInvitationMembership } from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

import {
  addMemberAction,
  chooseRecipientAction,
  editMemberAction,
  removeMemberAction,
  updateInvitationAction,
} from "../../../actions";

/**
 * Where an existing invitation is administered.
 *
 * THE SAME FORM AS THE CREATE ROUTE. One component renders both, because the
 * difference between them is whether the members already have ids — not a mode.
 * What this page adds is the membership: the rows carry their nicknames and
 * their stored numbers, the chosen recipient is rendered as chosen, and each
 * membership operation reaches the Server Action that owns it.
 *
 * WHY THE MEMBERSHIP IS NOT READ FROM THE CONSOLE LIST PROJECTION
 *
 * `listConsoleInvitations` selects no `nickname` and no `greeting_name_source`.
 * A form loaded from it would show every nickname as empty — and saving would
 * then clear them — and would treat a hand-written group name as derived, which
 * re-derives it over the top of what a person wrote. `findInvitationMembership`
 * is the read every membership WRITE already validates against, so the form and
 * the writes cannot disagree about what the invitation currently is.
 *
 * OWNERSHIP DOES NOT GATE ADMINISTRATION (confirmed decision 4). The read is
 * deliberately unpartitioned: either operator may edit any invitation. Dispatch
 * keeps both the ownership check and the device declaration, in the actions that
 * record one.
 *
 * A thin async container, like every async RSC here. Vitest cannot render one,
 * so nothing is DECIDED in this file; its behaviour belongs to the end-to-end
 * suite.
 *
 * Operator-facing copy is Spanish, neutral register.
 */

export const metadata: Metadata = {
  title: "Editar invitación",
  robots: { index: false, follow: false },
};

export default async function EditInvitationPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  await requireOperator();

  const { id } = await params;

  // A malformed id cannot name a row, and `invitations.id` is a `uuid` column:
  // Postgres answers an unparseable value with `22P02 invalid input syntax`,
  // which would surface a mistyped URL as a broken server. Same guard, and the
  // same reasoning, as `listConsoleInvitations`.
  if (!isWellFormedUuid(id)) {
    notFound();
  }

  const client = createServerSupabaseClient();
  const [membership, dispatchEvents] = await Promise.all([
    findInvitationMembership(client, id),
    listDispatchEvents(client, id),
  ]);

  if (membership === null) {
    notFound();
  }

  const defaultCountry = requiredDefaultPhoneCountry();
  const editPath = `${CONSOLE_ROOT_PATH}/invitations/${id}/edit`;

  /**
   * The shipped actions revalidate the console list, which is the surface that
   * shows what changed. This route has to be revalidated too, or the form would
   * go on rendering the membership as it was BEFORE the write — including a
   * just-added member with no id, who a second save would add all over again.
   */
  async function save(formData: FormData) {
    "use server";

    await updateInvitationAction(formData);

    revalidatePath(editPath);
  }

  async function addMember(formData: FormData) {
    "use server";

    await addMemberAction(formData);

    revalidatePath(editPath);
  }

  async function editMember(formData: FormData) {
    "use server";

    await editMemberAction(formData);

    revalidatePath(editPath);
  }

  async function removeMember(formData: FormData) {
    "use server";

    // The impact it returns is what the console list renders as an advisory
    // badge; this route revalidates that list rather than restating it here.
    await removeMemberAction(formData);

    revalidatePath(editPath);
  }

  async function chooseRecipient(formData: FormData) {
    "use server";

    await chooseRecipientAction(formData);

    revalidatePath(editPath);
  }

  return (
    // A `div`, not a `main`: `ConsoleShell` already renders this page's one
    // `main` landmark.
    <div className="console__main console__invitation flex flex-col gap-6">
      <h2 className="text-balance">{membership.displayName}</h2>

      <p className="max-w-[68ch] text-sm text-muted-foreground">
        Cualquiera de las dos cuentas puede editar esta invitación. Los cambios
        de integrantes se guardan uno por uno; el nombre del hogar, el saludo y
        la fecha límite se guardan con el botón del final.
      </p>

      <InvitationForm
        action={save}
        invitation={{
          id,
          displayName: membership.displayName,
          greetingName: membership.greetingName,
          greetingNameSource: membership.greetingNameSource,
          rsvpDeadline: membership.rsvpDeadline,
          dispatchRecipientGuestId: membership.dispatchRecipientGuestId,
          // ANY event at all, including an opened link and a marked failure: the
          // warning is about a message that left, and the application cannot
          // observe a delivery beyond what was recorded.
          dispatched: dispatchEvents.length > 0,
          members: membership.members.map((each) => ({
            id: each.id,
            fullName: each.fullName,
            nickname: each.nickname,
            phoneE164: each.phoneE164,
            isChild: each.isChild,
            // Classified here rather than taken as "there is a number", so the
            // form's advisory about an unreachable recipient means what the
            // dispatch preflight means by it — a landline is a valid number no
            // WhatsApp will ever answer.
            dispatchable:
              each.phoneE164 !== null &&
              classifyPhoneDispatchability(each.phoneE164, defaultCountry)
                .dispatchable,
          })),
        }}
        memberActions={{
          add: addMember,
          edit: editMember,
          remove: removeMember,
          chooseRecipient,
        }}
      />

      <a
        className="self-start text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        href={CONSOLE_ROOT_PATH}
      >
        Volver al panel
      </a>
    </div>
  );
}
