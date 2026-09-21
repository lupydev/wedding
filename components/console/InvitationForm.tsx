"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whyDisabled } from "@/components/ui/why-disabled";
import type { DirectoryGuest } from "@/lib/domain/guest-directory";
import {
  deriveGreetingName,
  type GreetingNameSource,
} from "@/lib/domain/greeting-name";
import {
  validateInvitationDraft,
  type DraftAdvisory,
  type DraftRefusal,
  type InvitationDraftMember,
} from "@/lib/domain/invitation-draft";

/**
 * The one form that creates an invitation and edits an existing one.
 *
 * ONE FORM FOR A SOLO GUEST AND FOR A GROUP, AND NO MODE SWITCH
 *
 * The model already treats a solo guest as a one-member invitation, so a UI with
 * a "single" mode and a "group" mode would be a second definition of the same
 * thing — free to disagree with the model, and it would, the first time somebody
 * added a partner to a "single" invitation.
 *
 * THE LIVE GROUP NAME IS THE SERVER'S OWN FUNCTION, IMPORTED (design D14)
 *
 * `deriveGreetingName` is imported from `lib/domain/greeting-name.ts` — the same
 * specifier `app/console/(authenticated)/actions.ts` imports on the server. One
 * source file, bundled into two graphs: the preview cannot drift from what gets
 * stored, because there is nothing to drift from. No rule is bent to allow it.
 * `componentImportZone` bans `@/lib/server/*` and `@supabase/*` from components
 * and says nothing about `lib/domain`, which is React-free and Node-free exactly
 * so that a Client Component may import it (`tools/eslint-zones.spec.ts` pins
 * that asymmetry, and `components/invitation/RsvpAnswer.tsx` already relies on
 * it).
 *
 * NOBODY IS THE RECIPIENT UNTIL SOMEBODY CHOOSES ONE
 *
 * The recipient radio group starts with NOTHING selected. Not the first member,
 * not the primary one, not the only one with a number: a confirmed decision of
 * this capability removed the auto-pick, and a radio group that defaults to its
 * first option would put it back where nobody would notice. The choice is a
 * WRITE of its own (`chooseRecipientAction`), recorded the moment it is made,
 * because the invitation's own save does not carry it.
 *
 * WHY THE MEMBER CONTROLS ARE PER ROW WHILE EDITING
 *
 * While creating, the members do not exist yet, so they travel with the one
 * submission that creates them. While editing they DO exist, each with an id,
 * and the server has one action per membership operation — add, edit, remove —
 * each applying its own refusals before its first statement. Mirroring that
 * one-for-one is what keeps a removal from being smuggled into an unrelated
 * save, and what lets a removal report what it contradicted.
 *
 * THE SAME VALIDATOR RUNS HERE AND THERE, AND ONLY ONE OF THEM IS A BOUNDARY
 *
 * `validateInvitationDraft` is checked on every keystroke for immediate feedback
 * and again by the Server Action, which is the one that decides. A refusal is a
 * state the model does not permit and it stops the submission here; an advisory
 * is a fact worth seeing and never stops anything — refusing twins for sharing a
 * nickname would teach the couple to keep their guest list somewhere else, which
 * is the failure this whole capability was written against.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** What each refusal means, in terms the operator can act on. */
/** Shown when a write is refused by the server or never reaches it. */
/**
 * The in-flight key for the whole-form save.
 *
 * Member rows key by `row.key`; the form itself needs one that cannot collide
 * with any of them, which is why this is not a plausible row key.
 */
const FORM_WRITE_KEY = "\u0000form";

const WRITE_FAILED_COPY =
  "No pudimos guardar ese cambio. Revisá la conexión y volvé a intentarlo.";

const REFUSAL_COPY: Readonly<Record<DraftRefusal, string>> = {
  no_members:
    "Una invitación tiene que quedarse con al menos una persona. Si la idea es que esta invitación desaparezca, hay que eliminarla completa en vez de dejarla sin integrantes.",
  member_without_name: "Cada integrante necesita un nombre completo.",
  duplicate_member_id:
    "La misma persona figura dos veces entre los integrantes.",
  recipient_not_a_member:
    "La persona elegida para recibir el mensaje ya no pertenece a esta invitación. Hay que elegir de nuevo a quién se le envía.",
  custom_name_empty:
    "El nombre del grupo no puede quedar vacío. Si la idea era deshacer el cambio, el botón «Volver al nombre automático» lo devuelve al que sale de los integrantes.",
  guest_already_invited:
    "Esa persona ya quedó en otra invitación mientras esta pantalla estaba abierta. Actualizá la página para ver la lista al día.",
};

/** A fact worth showing. The save happens regardless. */
const ADVISORY_COPY: Readonly<Record<DraftAdvisory, string>> = {
  duplicate_nickname:
    "Dos integrantes tienen el mismo apodo. Puede ser correcto —gemelos, por ejemplo— y se guarda igual.",
  recipient_has_no_phone:
    "La persona elegida para recibir el mensaje todavía no tiene un número guardado. Se puede guardar igual y agregarlo después.",
  recipient_phone_unreachable:
    "El número de la persona elegida es válido, pero por su tipo de línea no parece recibir WhatsApp.",
};

/**
 * What a re-derived name does NOT do to a message that already went out.
 *
 * The greeting travels inside the WhatsApp text, and the text is in the guest's
 * chat history: no console can reach in and edit it. So an invitation whose name
 * is derived keeps re-deriving — correctly — while every household that already
 * received it goes on reading the name as it stood the day it was sent. Stated
 * where the name is edited, as text on the page rather than a tooltip, for the
 * same reason `WeddingFactsForm` states the cached Open Graph card: the
 * operators are on phones, and a phone cannot hover.
 */
const DISPATCHED_DERIVED_WARNING =
  "Esta invitación ya se envió. El mensaje que llegó a WhatsApp conserva el " +
  "nombre que tenía ese día: cambiar los integrantes o sus apodos actualiza el " +
  "nombre acá y en la página de la invitación, pero no reescribe la " +
  "conversación que ya salió.";

/**
 * A bound Server Action, as every form in this codebase receives one.
 *
 * A membership write may ANSWER with the refusals that stopped it. Returning
 * them is the only channel that survives production: Next replaces a thrown
 * message with an opaque `digest` expressly to keep server text out of the
 * browser, and a thrown value proves nothing about who wrote it anyway. An
 * absent or empty answer means the write happened.
 */
export type InvitationFormAction = (
  formData: FormData,
) => void | Promise<void | readonly DraftRefusal[]>;

/**
 * A write that MUST answer, even when it has nothing to refuse.
 *
 * The refusals cross two hops to reach the operator — the action returns them
 * and the route's wrapper passes them on — and a wrapper that awaited and
 * discarded would break the chain silently, which is precisely what the two
 * pre-existing returns in this codebase do (`MembershipChangeImpact` is returned
 * and rendered nowhere). `InvitationFormAction` permits `void`, so it cannot
 * catch that. This type can: discarding the answer is a compile error.
 */
export type InvitationRefusingAction = (
  formData: FormData,
) => Promise<readonly DraftRefusal[]>;

/**
 * The membership writes, which exist only for an invitation that exists.
 *
 * ALL FOUR ANSWER. Every membership refusal now travels as a code and is
 * translated below, so none of the four is permitted to discard its answer on
 * the way here — `InvitationRefusingAction` makes a wrapper that awaited and
 * threw the refusals away a compile error rather than a silence nobody notices.
 *
 * The whole-form `action` prop is still the permissive `InvitationFormAction`:
 * `createInvitationAction` and `updateInvitationAction` are a separate slice and
 * still throw theirs.
 */
export interface InvitationMemberActions {
  readonly add: InvitationRefusingAction;
  readonly edit: InvitationRefusingAction;
  readonly remove: InvitationRefusingAction;
  readonly chooseRecipient: InvitationRefusingAction;
  /**
   * Takes somebody the directory holds into THIS invitation, immediately.
   *
   * Optional, because the create form has no saved invitation to place anybody
   * into — there, a pick is a local row until the whole form is submitted.
   */
  readonly place?: InvitationRefusingAction;
}

/** One member as the server currently holds them. */
export interface InvitationFormMember {
  readonly id: string;
  readonly fullName: string;
  readonly nickname: string | null;
  readonly phoneE164: string | null;
  readonly isChild: boolean;
  /** Computed upstream by `classifyPhoneDispatchability`, as elsewhere. */
  readonly dispatchable: boolean;
}

/** The invitation being edited. Absent while one is being created. */
export interface InvitationFormInvitation {
  readonly id: string;
  readonly displayName: string;
  readonly greetingName: string;
  readonly greetingNameSource: GreetingNameSource;
  /** ISO calendar day, or `null` for an invitation that never closes. */
  readonly dispatchRecipientGuestId: string | null;
  readonly members: readonly InvitationFormMember[];
  /** True when at least one `dispatch_events` row exists for it. */
  readonly dispatched: boolean;
}

export interface InvitationFormProps {
  /**
   * `createInvitationAction` while creating, `updateInvitationAction` while
   * editing. Bound by the page, so the acting operator is never a client value.
   */
  readonly action: InvitationFormAction;
  readonly invitation?: InvitationFormInvitation | null;
  /**
   * The people the directory holds and no household does.
   *
   * Only meaningful while CREATING. Picking one moves that person into this
   * household instead of writing a second record with the same name — which is
   * possible at all only since migration 0015, and is what "la creación de
   * invitaciones donde se pueda agregar un invitado" asked for.
   *
   * Adding somebody to an invitation that already exists is a different write
   * against a saved row, with its own server action, so the edit screen does
   * not read this.
   */
  readonly freeGuests?: readonly DirectoryGuest[];
  /** Required to edit membership; there is none to edit while creating. */
  readonly memberActions?: InvitationMemberActions;
}

/** One row of the member editor, saved or not. */
interface MemberRow {
  /** Stable across re-renders, including for a row with no id yet. */
  readonly key: string;
  /** `null` for a row this form added that has never been written. */
  readonly id: string | null;
  /**
   * Set when this card names somebody the DIRECTORY already holds.
   *
   * Distinct from `id`, which means "already a member of THIS invitation".
   * A picked person exists as a row and belongs to nobody, so the submission
   * moves them rather than writing them; their details are read-only here
   * because `/console/guests` is where they are corrected for everybody.
   */
  readonly existingGuestId: string | null;
  readonly fullName: string;
  readonly nickname: string;
  readonly phone: string;
  readonly isChild: boolean;
  /**
   * Whether a WhatsApp could reach the number.
   *
   * For a persisted row it is what the server computed. For a row being typed
   * it is only "there is a number", because deciding a LINE TYPE needs the
   * phone metadata library and this is immediate feedback, not a boundary — the
   * Server Action re-classifies every number it stores.
   */
  readonly dispatchable: boolean;
}

const NO_MEMBERS: readonly InvitationFormMember[] = [];
/** Module scope, so the default prop is not a new array on every render. */
const NO_FREE_GUESTS: readonly DirectoryGuest[] = [];

function rowOf(member: InvitationFormMember): MemberRow {
  return {
    key: member.id,
    id: member.id,
    // A saved member is already in this household; the directory's picker is
    // about people who are in none.
    existingGuestId: null,
    fullName: member.fullName,
    nickname: member.nickname ?? "",
    phone: member.phoneE164 ?? "",
    isChild: member.isChild,
    dispatchable: member.dispatchable,
  };
}

/**
 * A card standing for somebody the directory already holds.
 *
 * Their details are COPIED for display and for validation, never re-saved:
 * `existingGuestId` is what turns this card into a move rather than an insert,
 * and `/console/guests` remains the one screen where those details change.
 */
function pickedRow(guest: DirectoryGuest): MemberRow {
  return {
    key: `picked-${guest.id}`,
    id: null,
    existingGuestId: guest.id,
    fullName: guest.fullName,
    nickname: guest.nickname ?? "",
    phone: guest.phoneE164 ?? "",
    isChild: guest.isChild,
    dispatchable: guest.phoneE164 !== null,
  };
}

/** A row nobody has typed into yet — what a new invitation starts as. */
function blankRow(): MemberRow {
  return {
    key: `new-${globalThis.crypto.randomUUID()}`,
    id: null,
    existingGuestId: null,
    fullName: "",
    nickname: "",
    phone: "",
    isChild: false,
    dispatchable: false,
  };
}

function rowsOf(members: readonly InvitationFormMember[]): MemberRow[] {
  return members.length === 0 ? [blankRow()] : members.map(rowOf);
}

/** The row as the pure validator wants it. */
function draftMemberOf(row: MemberRow): InvitationDraftMember {
  return {
    id: row.id,
    fullName: row.fullName,
    nickname: nicknameOf(row),
    phoneE164: row.phone.trim() === "" ? null : row.phone.trim(),
    isChild: row.isChild,
    dispatchable: row.dispatchable,
  };
}

/** An emptied field is the absence of a nickname, not a blank one. */
function nicknameOf(row: MemberRow): string | null {
  const trimmed = row.nickname.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * The rows that can contribute a name, and therefore the ones the preview reads.
 *
 * A row with neither a name nor a nickname is a row somebody is about to fill
 * in. Feeding it to the derivation would render a stray conjunction next to an
 * empty field and make the preview look broken while it is merely early.
 */
function nameableRows(rows: readonly MemberRow[]): readonly MemberRow[] {
  return rows.filter(
    (candidate) =>
      candidate.fullName.trim() !== "" || candidate.nickname.trim() !== "",
  );
}

/**
 * What the CURRENT rows derive to, or `null` when nothing is named yet.
 *
 * `deriveGreetingName` throws on an empty list on purpose (an invitation with no
 * members must not exist), and an empty creation form is exactly that list. The
 * guard is here rather than in the domain so the throw keeps its meaning for
 * every other caller.
 */
function derivedNameOf(rows: readonly MemberRow[]): string | null {
  const nameable = nameableRows(rows);

  if (nameable.length === 0) {
    return null;
  }

  return deriveGreetingName(
    nameable.map((member) => ({
      fullName: member.fullName,
      nickname: nicknameOf(member),
    })),
  );
}

export function InvitationForm({
  action,
  freeGuests = NO_FREE_GUESTS,
  invitation = null,
  memberActions,
}: InvitationFormProps) {
  const persisted = invitation?.members ?? NO_MEMBERS;

  const [rows, setRows] = useState<readonly MemberRow[]>(() =>
    rowsOf(persisted),
  );
  const [source, setSource] = useState<GreetingNameSource>(
    invitation?.greetingNameSource ?? "derived",
  );
  const [customName, setCustomName] = useState(
    invitation === null || invitation.greetingNameSource === "derived"
      ? ""
      : invitation.greetingName,
  );
  const [recipientId, setRecipientId] = useState(
    invitation?.dispatchRecipientGuestId ?? null,
  );

  // THE SERVER'S MEMBER LIST WINS WHEN IT CHANGES.
  //
  // A membership write revalidates this route, so new props arrive while the
  // form is still mounted holding the rows as they were BEFORE it. Re-seeding
  // from the new list is what makes a just-added member appear with the real id
  // the server gave them — without which their row would still read `null` and a
  // second save would add them twice. Adjusting state during render rather than
  // in an effect is React's own answer for this: it re-renders immediately
  // instead of painting the stale list first.
  const [seededFrom, setSeededFrom] = useState(persisted);

  if (persisted !== seededFrom) {
    setSeededFrom(persisted);
    // MERGE, NEVER REPLACE.
    //
    // The edit page revalidates this route after every membership write, so this
    // branch runs while the operator may be mid-word in another row. Replacing
    // the array discarded that text silently. Server rows decide WHO is in the
    // household and carry the ids this branch exists to adopt; a local row's own
    // field values win, because they are what the operator can see and has not
    // saved yet. Rows never saved at all have no server counterpart and survive.
    setRows((current) => {
      const locallyEdited = new Map(
        current.filter((row) => row.id !== null).map((row) => [row.id, row]),
      );
      const unsaved = current.filter((row) => row.id === null);
      const absorbed = new Set<string>();

      const merged = rowsOf(persisted).map((row) => {
        const local = locallyEdited.get(row.id);

        if (local !== undefined) {
          return { ...local, id: row.id };
        }

        // A ROW WHOSE ADD JUST LANDED IS THE SAME PERSON, NOT A SECOND ONE.
        //
        // A member added here has no id until the server accepts them. When the
        // list comes back carrying them WITH an id, keeping the local row too
        // renders that person twice and a second save adds them twice — which is
        // the double-add this whole branch exists to prevent. Matched by name
        // because a row with no id has nothing else to be matched by.
        const justLanded = unsaved.find(
          (candidate) =>
            !absorbed.has(candidate.key) &&
            candidate.fullName.trim() !== "" &&
            candidate.fullName.trim() === row.fullName.trim(),
        );

        if (justLanded !== undefined) {
          absorbed.add(justLanded.key);

          return { ...justLanded, id: row.id };
        }

        return row;
      });

      return [...merged, ...unsaved.filter((row) => !absorbed.has(row.key))];
    });
    setRecipientId(invitation?.dispatchRecipientGuestId ?? null);
  }

  const [attempted, setAttempted] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  // WHICH ROWS HAVE A WRITE IN FLIGHT, BY KEY.
  //
  // This console is used from a phone, and phones get double-tapped. A row added
  // here keeps a null id until the server list comes back, so a second press
  // before the first write returns takes the ADD branch again and inserts the
  // same person twice — and nothing downstream catches it, because
  // `duplicate_member_id` compares stored ids and the two rows have different
  // ones. A duplicated member raises the derived greeting name, the member count
  // and the seat cap: the couple's guest list, silently wrong.
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());

  /**
   * The card whose name field should take the cursor, or `null` for none.
   *
   * `null` on the first render, always, which is what keeps this from stealing
   * focus when the page loads: no card's key can match it, so `autoFocus` is
   * false everywhere until the operator presses "Agregar otra persona".
   */
  const [focusKey, setFocusKey] = useState<string | null>(null);

  /**
   * Which member receives the message, while they are still only positions.
   *
   * Zero rather than `null`: the first person is marked to begin with, and the
   * marking is ON SCREEN where the operator can change it in one tap. Nothing
   * is defaulted silently — what this replaces is an invitation saved,
   * apparently complete, and unsendable until somebody reopened it.
   */
  const [recipientIndex, setRecipientIndex] = useState(0);

  const derivedName = derivedNameOf(rows);
  const shownName = source === "derived" ? (derivedName ?? "") : customName;

  const { refusals, advisories } = validateInvitationDraft({
    // The validator wants a label for its messages, and the greeting is the
    // one the operator can see. The server fills the column from it too.
    displayName: shownName,
    greetingName: shownName,
    greetingNameSource: source,
    members: rows.map(draftMemberOf),
    dispatchRecipientGuestId: recipientId,
  });

  /*
    WHO THE PICKER MAY STILL OFFER.

    Derived rather than kept in state: the answer is a function of the rows on
    screen, and a second copy of it is a second thing that can be wrong.
  */
  const takenHere = new Set(
    rows
      .map((row) => row.existingGuestId)
      .filter((id): id is string => id !== null),
  );
  const offerable = freeGuests.filter((guest) => !takenHere.has(guest.id));
  /*
    Nothing is rendered when there is nobody to lend. An empty picker reads as
    "this feature is broken" rather than "the directory is empty", and the
    directory is empty for most of this wedding's life. While editing it also
    needs somewhere to send the pick, which is `memberActions.place`.
  */
  const picksAreOffered =
    offerable.length > 0 &&
    (invitation === null || memberActions?.place !== undefined);

  function pickGuest(guest: DirectoryGuest) {
    /*
      AN EXISTING INVITATION TAKES THEM IMMEDIATELY.

      Creating builds a whole household in one submit, so a pick there is a
      local row waiting for that submit. An invitation that already exists has
      no submit button for membership — every member write on this screen is
      its own action — so a pick held locally would simply be lost.
    */
    if (invitation !== null && memberActions?.place !== undefined) {
      const fields = new FormData();

      fields.set("invitationId", invitation.id);
      fields.set("guestId", guest.id);

      void runWrite(memberActions.place, fields, {
        rowKey: `place-${guest.id}`,
      });

      return;
    }

    setRows((current) => {
      const picked = pickedRow(guest);
      /*
        THE UNTOUCHED BLANK CARD IS CONSUMED, NOT PUSHED DOWN.

        A new form opens with one empty card. Appending after it leaves an
        empty "Integrante 1" above the person just added — which the validator
        then refuses for having no name, on a form where the operator did
        nothing wrong. A card somebody HAS typed into is never consumed.
      */
      const onlyBlank =
        current.length === 1 &&
        current[0].existingGuestId === null &&
        current[0].id === null &&
        current[0].fullName.trim() === "" &&
        current[0].phone.trim() === "";

      return onlyBlank ? [picked] : [...current, picked];
    });
  }

  function patchRow(key: string, patch: Partial<MemberRow>) {
    setRows((current) =>
      current.map((candidate) =>
        candidate.key === key ? { ...candidate, ...patch } : candidate,
      ),
    );
  }

  /** One member's own fields, as every membership action reads them back. */
  function memberFields(row: MemberRow): FormData {
    const formData = new FormData();

    if (invitation !== null) {
      formData.set("invitationId", invitation.id);
    }

    if (row.id !== null) {
      formData.set("guestId", row.id);
    }

    formData.set("fullName", row.fullName);
    formData.set("nickname", row.nickname);
    formData.set("phone", row.phone);
    formData.set("isChild", row.isChild ? "true" : "false");

    return formData;
  }

  /**
   * Why this member cannot be taken off the invitation, or `null`.
   *
   * The SAME rule the Server Action applies, run on the membership the removal
   * would leave behind: `removeMember` validates the after-state before its
   * first statement and refuses `no_members`, so previewing it here cannot
   * disagree with it. An unsaved row is exempt — it exists only in this form,
   * and removing it writes nothing.
   *
   * A removed member's own recipient choice is cleared by the database rather
   * than refused, so the check is against the members that REMAIN, exactly as
   * `refuseInvalidMembership` does it.
   */
  function removalRefusalOf(row: MemberRow): string | null {
    if (invitation === null || row.id === null) {
      return null;
    }

    const after = rows.filter((candidate) => candidate.key !== row.key);
    const outcome = validateInvitationDraft({
      displayName: shownName,
      greetingName: shownName,
      greetingNameSource: source,
      members: after.map(draftMemberOf),
      dispatchRecipientGuestId: after.some(
        (candidate) => candidate.id === recipientId,
      )
        ? recipientId
        : null,
    });

    return outcome.refusals.includes("no_members")
      ? REFUSAL_COPY.no_members
      : null;
  }

  /**
   * RUNS A WRITE AND MAKES ITS FAILURE VISIBLE.
   *
   * Every write here used to be fire-and-forget: the promise was discarded and
   * no rejection reached the operator. The recipient case was the worst of them —
   * local state was updated first, so a rejected write left the radio rendered
   * as chosen while the server had recorded nothing, and dispatch stayed blocked
   * with no explanation anywhere. `onFailure` is how a caller undoes whatever it
   * showed optimistically.
   */
  async function runWrite(
    write: InvitationFormAction,
    fields: FormData,
    options: { readonly onFailure?: () => void; readonly rowKey?: string } = {},
  ): Promise<void> {
    const { onFailure, rowKey } = options;

    if (rowKey !== undefined) {
      setInFlight((current) => new Set(current).add(rowKey));
    }

    try {
      // A RETURNED REFUSAL IS AN ANSWER, NOT A FAULT.
      //
      // The write reached the server and the server declined it, naming which
      // rule stopped it. That is worth saying out loud: the codes come from a
      // closed vocabulary this component already translates, and a rule that
      // refused once refuses identically on every retry, so the connectivity
      // copy below would be futile advice. `onFailure` still runs — whatever was
      // shown optimistically was shown on a promise the server did not keep.
      //
      // `?? []` is the void arm: an action with nothing to refuse returns
      // nothing. Narrowing with `Array.isArray` instead would widen the codes to
      // `any` and lose the `REFUSAL_COPY` key check, which is the one thing
      // making an untranslated refusal a compile error.
      const refusals: readonly DraftRefusal[] = (await write(fields)) ?? [];

      if (refusals.length > 0) {
        onFailure?.();
        setWriteError(refusals.map((code) => REFUSAL_COPY[code]).join(" "));

        return;
      }

      setWriteError(null);
    } catch {
      onFailure?.();
      setWriteError(WRITE_FAILED_COPY);
    } finally {
      if (rowKey !== undefined) {
        setInFlight((current) => {
          const next = new Set(current);

          next.delete(rowKey);

          return next;
        });
      }
    }
  }

  function saveMember(row: MemberRow) {
    if (memberActions === undefined) {
      return;
    }

    const write = row.id === null ? memberActions.add : memberActions.edit;

    if (inFlight.has(row.key)) {
      return;
    }

    void runWrite(write, memberFields(row), { rowKey: row.key });
  }

  function removeMember(row: MemberRow) {
    // An unsaved row exists only here, so removing it is a local edit and there
    // is nothing for the server to refuse.
    if (row.id === null || memberActions === undefined) {
      setRows((current) =>
        current.filter((candidate) => candidate.key !== row.key),
      );

      return;
    }

    if (inFlight.has(row.key)) {
      return;
    }

    void runWrite(memberActions.remove, memberFields(row), { rowKey: row.key });
  }

  function chooseRecipient(row: MemberRow) {
    if (row.id === null || invitation === null || memberActions === undefined) {
      return;
    }

    const previous = recipientId;

    setRecipientId(row.id);

    const formData = new FormData();

    formData.set("invitationId", invitation.id);
    formData.set("guestId", row.id);

    void runWrite(memberActions.chooseRecipient, formData, {
      rowKey: row.key,
      onFailure: () => {
        setRecipientId(previous);
      },
    });
  }

  function save(formData: FormData) {
    // The operator learns about a refusal the moment they ask to save, not after
    // a round trip — and, until they ask, an incomplete form is not scolded for
    // being incomplete.
    setAttempted(true);

    if (refusals.length > 0) {
      return;
    }

    // THE SAME DOUBLE-TAP GUARD THE MEMBER ROWS GET, AND IT MATTERS MORE HERE.
    //
    // Two presses in create mode make TWO households: two slugs, two recipients
    // to choose, and two possible dispatches to the same guest. Nothing
    // de-duplicates downstream — `createInvitation` mints a fresh slug per call
    // and a console-created row carries no `source_key`, so neither the
    // duplicate-member check nor the import conflict path ever sees it.
    if (inFlight.has(FORM_WRITE_KEY)) {
      return;
    }

    void runWrite(action, formData, { rowKey: FORM_WRITE_KEY });
  }

  return (
    <form
      action={save}
      className="invitation-form flex flex-col gap-6"
      // The console is operated on phones; the browser's own name and phone
      // suggestions are the operator's own identity, never a guest's.
      autoComplete="off"
    >
      {invitation !== null && (
        <input type="hidden" name="invitationId" value={invitation.id} />
      )}

      <fieldset className="invitation-form__members flex flex-col gap-4">
        <legend className="text-sm font-medium">Integrantes</legend>

        {/*
          THE PEOPLE THE DIRECTORY CAN STILL LEND, and nobody else.

          Offering only free guests is the first half of the couple's rule —
          "no se debería poder escoger en una próxima invitación". The server
          holds the other half, because a page that was correct when it loaded
          can be wrong when it is submitted.

          Somebody already on a card here is withheld too: offering them twice
          would let one form build a household holding the same person twice,
          which `duplicate_member_id` refuses on submit — after the operator
          had done the work.

          Nothing is rendered when there is nobody to lend. An empty picker
          says "this feature is broken" rather than "the directory is empty",
          and the directory is empty for most of this wedding's life.
        */}
        {picksAreOffered && (
          <div className="invitation-form__directory flex flex-col gap-2 rounded-lg border border-dashed border-input px-3 py-3">
            <p className="text-xs text-muted-foreground">
              Ya en la lista de invitados, sin invitación todavía:
            </p>

            <div className="flex flex-wrap gap-2">
              {offerable.map((guest) => (
                <Button
                  disabled={inFlight.has(`place-${guest.id}`)}
                  key={guest.id}
                  onClick={() => pickGuest(guest)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {/*
                    The person's name is IN the label rather than only in an
                    `aria-label`, because a row of bare "Agregar" buttons is
                    the thing this console already removed once.
                  */}
                  Agregar de la lista: {guest.fullName}
                </Button>
              ))}
            </div>
          </div>
        )}

        {rows.map((row, index) => {
          const removalRefusal = removalRefusalOf(row);

          return (
            <fieldset
              className="invitation-form__member flex flex-col gap-2 rounded-lg border border-input px-3 py-3"
              key={row.key}
            >
              {/*
                The marker is only on cards that are NOT on the invitation yet,
                and that is the whole signal: on every card it would be
                decoration, and an operator learns to ignore decoration.

                On the create form every card is unsaved — the whole form is one
                submit — so there is nothing to distinguish and no marker.
              */}
              <legend className="px-1 text-xs text-muted-foreground">
                Integrante {index + 1}
                {invitation !== null && row.id === null ? " · sin guardar" : ""}
              </legend>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`member-${row.key}-full-name`}>
                  Nombre completo
                </Label>
                <Input
                  // Only ever true for a card the operator just opened: the
                  // state starts `null`, so nothing is focused on load.
                  autoFocus={row.key === focusKey}
                  className="h-11"
                  id={`member-${row.key}-full-name`}
                  // The four member columns travel with the CREATE submission and
                  // are read as parallel arrays. While editing, membership has its
                  // own actions and these inputs submit nothing.
                  name={invitation === null ? "memberFullName" : undefined}
                  onChange={(event) =>
                    patchRow(row.key, { fullName: event.target.value })
                  }
                  /*
                    A PICKED PERSON'S DETAILS ARE SHOWN, NOT REWRITTEN HERE.

                    The directory owns them, and `/console/guests` is where a
                    correction reaches every household at once. Two places to
                    change one name is two names.
                  */
                  readOnly={row.existingGuestId !== null}
                  value={row.fullName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`member-${row.key}-nickname`}>Apodo</Label>
                <Input
                  className="h-11"
                  id={`member-${row.key}-nickname`}
                  name={invitation === null ? "memberNickname" : undefined}
                  onChange={(event) =>
                    patchRow(row.key, { nickname: event.target.value })
                  }
                  readOnly={row.existingGuestId !== null}
                  value={row.nickname}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`member-${row.key}-phone`}>Teléfono</Label>
                <Input
                  className="h-11"
                  id={`member-${row.key}-phone`}
                  inputMode="tel"
                  name={invitation === null ? "memberPhone" : undefined}
                  onChange={(event) =>
                    patchRow(row.key, {
                      phone: event.target.value,
                      dispatchable: event.target.value.trim() !== "",
                    })
                  }
                  readOnly={row.existingGuestId !== null}
                  value={row.phone}
                />
              </div>

              <Label className="gap-2" htmlFor={`member-${row.key}-is-child`}>
                <input
                  checked={row.isChild}
                  id={`member-${row.key}-is-child`}
                  onChange={(event) =>
                    patchRow(row.key, { isChild: event.target.checked })
                  }
                  type="checkbox"
                />
                Es niño o niña
              </Label>

              {/* An unchecked checkbox submits NOTHING, which would shift every
                row after it in the parallel columns the action reads. The value
                travels in a hidden field that is always present instead. */}
              {invitation === null && (
                <input
                  name="memberIsChild"
                  type="hidden"
                  value={row.isChild ? "true" : "false"}
                />
              )}

              {/* One entry per member, empty for a person being written for the
                first time. `readMemberRows` refuses a column whose length
                disagrees with the names — a rule it holds because a short
                column attaches one person's value to another person's row. */}
              {invitation === null && (
                <input
                  name="memberExistingId"
                  type="hidden"
                  value={row.existingGuestId ?? ""}
                />
              )}

              <div className="flex flex-wrap gap-2">
                {invitation !== null && (
                  <Button
                    // The guard is in `saveMember` too: this one is so the
                    // operator SEES that the press landed, instead of pressing
                    // again because nothing appeared to happen.
                    disabled={inFlight.has(row.key)}
                    onClick={() => saveMember(row)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Guardar integrante {index + 1}
                  </Button>
                )}

                <Button
                  {...whyDisabled(removalRefusal)}
                  onClick={() => removeMember(row)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Quitar integrante {index + 1}
                </Button>
              </div>

              {/* The reason as TEXT, not only as the `title` the disabled props
                carry: the operators are on phones, and a phone cannot hover. */}
              {removalRefusal !== null && (
                <p
                  className="max-w-[68ch] text-xs text-muted-foreground"
                  data-testid="invitation-member-refusal"
                  role="status"
                >
                  {removalRefusal}
                </p>
              )}
            </fieldset>
          );
        })}

        {/*
          IT USED TO SAY "Agregar integrante", AND IT ADDED NOBODY.

          Pressing it opens a blank card; the person reaches the invitation on a
          SECOND press, on a different button, further down. An operator who
          pressed this once and walked away had added no one, and the screen had
          told them otherwise.

          So it says what it opens, the card it opens says it is not saved yet,
          and the cursor lands in the name — press, type, save, with nothing to
          aim at in between.
        */}
        <Button
          className="self-start"
          onClick={() => {
            const opened = blankRow();

            setRows((current) => [...current, opened]);
            setFocusKey(opened.key);
          }}
          type="button"
          variant="secondary"
        >
          Agregar otra persona
        </Button>
      </fieldset>

      {/*
        ONE NAME FIELD, AND THERE WERE TWO.

        This asked for a "Nombre del hogar" as well, each field under its own
        paragraph explaining how it differed from the other — ten lines of
        prose to separate two values, one of which the operator never sees
        again. `display_name` surfaces on exactly ONE surface in the whole
        console: the sentence confirming a deletion. Everything else — every
        list, heading and label — shows the greeting.

        The column still exists and the server fills it from the greeting it
        resolves, so nothing internal changed. What went away is a question
        asked of somebody with no way to know the answer did not matter.
      */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invitation-greeting-name">Nombre del grupo</Label>
        <p
          className="max-w-[68ch] text-xs text-muted-foreground"
          id="invitation-greeting-name-hint"
        >
          Es el saludo con el que abre la invitación. Se arma solo con los
          nombres y apodos de arriba; si se escribe algo distinto, queda tal
          cual y deja de actualizarse.
        </p>
        <Input
          aria-describedby="invitation-greeting-name-hint"
          className="h-11"
          id="invitation-greeting-name"
          name="greetingName"
          onChange={(event) => {
            // TOUCHING THE FIELD IS THE DECISION. There is no separate "use a
            // custom name" toggle: a toggle can disagree with the text beside
            // it, and the text is what gets stored.
            setSource("custom");
            setCustomName(event.target.value);
          }}
          value={shownName}
        />

        {/*
          `imported` is submitted as `custom`, deliberately.
          An imported name is a string a script wrote and nobody has reviewed;
          the domain treats it like a custom one until an operator acts on it,
          and saving this form IS acting on it. Submitting `imported` would be
          read as "not custom" by the action and silently replace the stored name
          with the derived one.
        */}
        <input
          data-testid="invitation-greeting-source"
          name="greetingNameSource"
          type="hidden"
          value={source === "derived" ? "derived" : "custom"}
        />

        {invitation !== null &&
          invitation.dispatched &&
          invitation.greetingNameSource === "derived" && (
            <p
              className="max-w-[68ch] rounded-lg border border-input px-3 py-2 text-xs text-muted-foreground"
              data-testid="invitation-dispatched-warning"
            >
              {DISPATCHED_DERIVED_WARNING}
            </p>
          )}

        {/*
          SHOWN ALWAYS, INCLUDING BESIDE A CUSTOM NAME (B3).
          The alternative would be working out whether a hand-written name
          "still mentions" a member who has since been removed — by matching its
          text against the member names. That is unreliable in both directions: a
          nickname that is a common word matches a name that is not there, and a
          diminutive nobody typed misses one that is. A wrong answer either
          silently rewrites the couple's own wording or silently keeps a greeting
          that names somebody who is not coming. So nothing is inferred: both
          strings are on screen, and the operator decides.
        */}
        <p
          className="text-xs text-muted-foreground"
          data-testid="invitation-derived-name"
        >
          Nombre automático: {derivedName ?? "todavía sin integrantes"}
          {source === "derived"
            ? ""
            : " — es el que saldría de los integrantes de arriba; no se está usando porque el nombre está escrito a mano."}
        </p>

        <Button
          className="self-start"
          onClick={() => setSource("derived")}
          type="button"
          variant="ghost"
        >
          Volver al nombre automático
        </Button>
      </div>

      {/*
        THE DEADLINE IS NOT ASKED FOR HERE ANY MORE.

        A "Fecha límite para confirmar" field stood here, on the create form and
        on the edit form, which meant the couple typed the same date into every
        household they made — and a household where they forgot was one whose
        invitation said nothing about confirming and never closed.

        There is one wedding, so there is one deadline. It is derived from the
        wedding's own date in `lib/domain/wedding-day.ts`, one week before, and
        every invitation reads the same value.
      */}

      {/*
        AN INVITATION USED TO BE BORN BLOCKED.

        A paragraph stood here on the create form — "A quién se le envía el
        mensaje se elige después de guardar" — because the members have no ids
        until they are written. True, and it meant every household created in
        the console landed straight in "Sin destinatario elegido", and the
        operator had to find it again and reopen it to finish something they
        believed they had finished.

        The members have POSITIONS before they have ids, and a position is all
        the server needs: it inserts the guests and resolves the choice against
        the rows it has just created. So the same question is asked here, and
        the only difference is what the answer is spelled with.
      */}
      <fieldset className="invitation-form__recipient flex flex-col gap-2">
        <legend className="text-sm font-medium">
          ¿Quién recibe el mensaje?
        </legend>

        {invitation === null || memberActions === undefined ? (
          <>
            <p className="max-w-[68ch] text-xs text-muted-foreground">
              El mensaje va a una sola persona de la invitación. Queda marcada
              la primera; se puede cambiar acá mismo.
            </p>

            {rows.map((row, index) => (
              <Label
                className="gap-2"
                htmlFor={`recipient-${row.key}`}
                key={row.key}
              >
                <input
                  checked={recipientIndex === index}
                  id={`recipient-${row.key}`}
                  /*
                   * The POSITION, because that is all that exists yet. A guest
                   * id here would be an invention: these people have not been
                   * written, so there is nothing to name them by except where
                   * they sit on this form.
                   */
                  name="recipientIndex"
                  onChange={() => setRecipientIndex(index)}
                  type="radio"
                  value={index}
                />
                {row.fullName === "" ? `Integrante ${index + 1}` : row.fullName}
                {row.phone.trim() === "" ? " — sin número guardado" : ""}
              </Label>
            ))}
          </>
        ) : (
          <>
            <p className="max-w-[68ch] text-xs text-muted-foreground">
              Nadie queda elegido por defecto. Mientras no se marque a alguien,
              el envío de esta invitación queda bloqueado.
            </p>

            {rows
              .filter(
                (row): row is MemberRow & { id: string } => row.id !== null,
              )
              .map((row) => (
                <Label
                  className="gap-2"
                  htmlFor={`recipient-${row.id}`}
                  key={row.id}
                >
                  <input
                    checked={recipientId === row.id}
                    id={`recipient-${row.id}`}
                    name="recipientChoice"
                    onChange={() => chooseRecipient(row)}
                    type="radio"
                    value={row.id}
                  />
                  {row.fullName === "" ? "Sin nombre" : row.fullName}
                  {row.phone.trim() === "" ? " — sin número guardado" : ""}
                </Label>
              ))}
          </>
        )}
      </fieldset>

      {writeError !== null && (
        <p
          className="max-w-[68ch] rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-3 text-sm"
          data-testid="invitation-write-error"
          // A write that failed is announced, because the alternative is what
          // this replaced: the form showing a change the server never took.
          role="alert"
        >
          {writeError}
        </p>
      )}

      {attempted && refusals.length > 0 && (
        <ul
          className="flex max-w-[68ch] list-disc flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-6 py-3 text-sm"
          data-testid="invitation-refusals"
          // Announced, not merely rendered: the operator asked to save and the
          // answer is that nothing was saved.
          role="alert"
        >
          {refusals.map((refusal) => (
            <li key={refusal}>{REFUSAL_COPY[refusal]}</li>
          ))}
        </ul>
      )}

      {advisories.length > 0 && (
        <ul
          className="flex max-w-[68ch] list-disc flex-col gap-1 rounded-lg border border-input px-6 py-3 text-sm text-muted-foreground"
          data-testid="invitation-advisories"
          role="status"
        >
          {advisories.map((advisory) => (
            <li key={advisory}>{ADVISORY_COPY[advisory]}</li>
          ))}
        </ul>
      )}

      <Button
        className="self-start"
        // Visible as well as guarded: an operator who sees nothing happen
        // presses again, which is how the second submit gets sent at all.
        disabled={inFlight.has(FORM_WRITE_KEY)}
        type="submit"
      >
        Guardar invitación
      </Button>
    </form>
  );
}
