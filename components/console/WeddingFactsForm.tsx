import type { WeddingFactsState } from "@/app/console/(authenticated)/wedding/wedding-facts-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WEDDING_FACT_LABELS,
  WEDDING_FACT_MAX_LENGTHS,
  type WeddingFactField,
  type WeddingFacts,
} from "@/lib/domain/wedding-facts";

/**
 * The one screen where the wedding's own facts are edited.
 *
 * ONE FORM, ONE SAVE, SEVEN FIELDS
 *
 * Not seven inline editors. Every surface reads these values together, and a
 * partial save is how the date comes to belong to one correction while the venue
 * still belongs to the previous one. The guest list's inline phone editor is the
 * opposite case for the opposite reason: three people and ten digits, where
 * sending somebody to a full edit screen means the data never gets entered at
 * all.
 *
 * PROPS ONLY, STATE INCLUDED. `useActionState` lives in a thin client wrapper
 * beside the page, the same split as `ConsoleNav` and `ConsoleNavCurrent`: every
 * rule worth asserting is here, and taking the state as a prop makes all of them
 * testable with no hook to drive and no session to fake.
 *
 * VALIDATION IS THE SERVER'S. `maxLength` and `required` below are a convenience
 * so a 400-character address is refused by the field instead of by a round trip.
 * `parseWeddingFacts` re-applies every rule on the server, and the `ceremony`
 * table's own check constraints sit behind that. A browser-side check is never a
 * boundary.
 *
 * BOTH OPERATORS MAY EDIT, AND THERE IS NO APPROVAL STEP. Two people are getting
 * married; an approval workflow between them would be a queue with nobody in it.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/**
 * The consequence of editing the couple's names, stated where they are edited.
 *
 * THE OPEN GRAPH CARD IS IMMUTABLE AND WhatsApp CACHES IT PER URL.
 * `app/i/[slug]/opengraph-image.tsx` answers `immutable, max-age=31536000`, and
 * WhatsApp keeps one preview per link. So a name changed after invitations went
 * out leaves every already-delivered card showing the old text, permanently, and
 * nothing in this console can reach into a chat history to fix it. The only cure
 * is a new slug — a new URL, therefore a new card — and sending the message
 * again.
 *
 * It is a paragraph on the page and not a tooltip or a `title` attribute. A
 * consequence nobody can undo has to be readable without hovering anything, and
 * the operators are on phones, which cannot hover.
 */
const CARD_CACHE_WARNING =
  "Las invitaciones ya enviadas no van a cambiar. WhatsApp guarda la imagen " +
  "de vista previa por cada enlace y no la vuelve a pedir, así que si " +
  "editan estos nombres después de haber enviado invitaciones, esas " +
  "conversaciones van a seguir mostrando los nombres anteriores para " +
  "siempre. La única forma de corregirlas es generar un enlace nuevo para " +
  "cada invitación y volver a enviarlas.";

/**
 * The consequence of editing the Zoom passcode.
 *
 * It is not a secret of the operators'. Every household that answered "no"
 * already reads it on their own invitation page, behind the phone gate, and has
 * possibly written it down. Changing it here stops the OLD one from working for
 * anybody; it does not un-share it, and it does not tell those households that
 * the passcode they were given no longer opens the call.
 */
const PASSCODE_SHARED_WARNING =
  "Esta clave ya la vieron las familias que nos dijeron que no pueden " +
  "acompañarnos en persona: aparece en su invitación. Cambiarla acá no la " +
  "borra de donde ya la anotaron, y a ellas nadie les va a avisar de la " +
  "clave nueva de forma automática.";

/** What the field is for, beside its label, when the label is not enough. */
const FIELD_HINTS: Partial<Record<WeddingFactField, string>> = {
  ceremonyDate:
    "Se muestra tal como se escriba acá, en la invitación y en la transmisión. Es una sola fecha para las dos cosas.",
  ceremonyTime: "También se muestra tal como se escriba acá.",
};

export type WeddingFactsFormAction = (formData: FormData) => void;

export interface WeddingFactsFormProps {
  /** The values currently stored in the `ceremony` row. */
  readonly facts: WeddingFacts;
  /** What the last submission produced. */
  readonly state: WeddingFactsState;
  /** The `useActionState` dispatcher, supplied by the client wrapper. */
  readonly action: WeddingFactsFormAction;
  /** Whether a submission is in flight. */
  readonly pending?: boolean;
}

/**
 * One field, with its label, its hint, its warning and its error all attached.
 *
 * `aria-describedby` collects every one of them. A warning rendered beside a
 * field but not attached to it is a warning a screen-reader user never hears,
 * and the two warnings on this form are the reason it exists.
 */
function FactField({
  field,
  value,
  error,
  warningId,
}: {
  readonly field: WeddingFactField;
  readonly value: string;
  readonly error: string | undefined;
  readonly warningId?: string;
}) {
  const inputId = `wedding-${field}`;
  const hint = FIELD_HINTS[field];
  const hintId = hint === undefined ? undefined : `${inputId}-hint`;
  const errorId = error === undefined ? undefined : `${inputId}-error`;
  const describedBy = [warningId, hintId, errorId].filter(
    (id): id is string => id !== undefined,
  );

  return (
    <div className="wedding-facts__field flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{WEDDING_FACT_LABELS[field]}</Label>

      {hint !== undefined && (
        <p className="max-w-[68ch] text-xs text-muted-foreground" id={hintId}>
          {hint}
        </p>
      )}

      <Input
        className="h-11"
        id={inputId}
        name={field}
        // `text` for every one of the seven, the passcode included. A
        // `type="password"` field makes the browser offer to save the value into
        // the operator's own credential store and a phone keychain syncs it
        // everywhere — for a meeting passcode a hundred households already read
        // on their own invitation. Masking it would also hide a value the
        // operator is checking against a Zoom screen, from nobody.
        type="text"
        // Nothing here is an identity of the operator's, so nothing here belongs
        // in the browser's autofill store.
        autoComplete="off"
        defaultValue={value}
        maxLength={WEDDING_FACT_MAX_LENGTHS[field]}
        required
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={
          describedBy.length === 0 ? undefined : describedBy.join(" ")
        }
      />

      {error !== undefined && (
        // `text-destructive` because something is BROKEN and the save did not
        // happen. One of the three signal colours, used for one of its meanings.
        <p
          className="wedding-facts__error text-sm text-destructive"
          id={errorId}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** A consequence the operator cannot see, stated beside what causes it. */
function Consequence({
  id,
  testId,
  children,
}: {
  readonly id: string;
  readonly testId: string;
  readonly children: string;
}) {
  return (
    // Gold, not red: nothing is broken, and this is not a refusal. It is the one
    // thing on the screen that needs the operator's attention before they type,
    // which is exactly what this project's gold means.
    <p
      className="wedding-facts__warning max-w-[68ch] rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
      data-testid={testId}
      id={id}
    >
      {children}
    </p>
  );
}

export function WeddingFactsForm({
  facts,
  state,
  action,
  pending = false,
}: WeddingFactsFormProps) {
  const cardWarningId = "wedding-card-warning";
  const passcodeWarningId = "wedding-passcode-warning";

  return (
    <form action={action} className="wedding-facts flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-base">La pareja</h3>

        <Consequence id={cardWarningId} testId={cardWarningId}>
          {CARD_CACHE_WARNING}
        </Consequence>

        <FactField
          field="coupleNames"
          value={facts.coupleNames}
          error={state.errors.coupleNames}
          warningId={cardWarningId}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-base">Cuándo y dónde</h3>

        <FactField
          field="ceremonyDate"
          value={facts.ceremonyDate}
          error={state.errors.ceremonyDate}
        />
        <FactField
          field="ceremonyTime"
          value={facts.ceremonyTime}
          error={state.errors.ceremonyTime}
        />
        <FactField
          field="venueName"
          value={facts.venueName}
          error={state.errors.venueName}
        />
        <FactField
          field="venueAddress"
          value={facts.venueAddress}
          error={state.errors.venueAddress}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-base">La transmisión por Zoom</h3>

        <FactField
          field="streamMeetingId"
          value={facts.streamMeetingId}
          error={state.errors.streamMeetingId}
        />

        <Consequence id={passcodeWarningId} testId={passcodeWarningId}>
          {PASSCODE_SHARED_WARNING}
        </Consequence>

        <FactField
          field="streamPasscode"
          value={facts.streamPasscode}
          error={state.errors.streamPasscode}
          warningId={passcodeWarningId}
        />
      </section>

      {/*
        ONE BUTTON, AND IT SAVES ALL SEVEN. The label names what is saved rather
        than saying "Guardar": on a phone, a bare verb beside a form the operator
        has scrolled away from does not say what it applies to.
      */}
      <Button
        className="self-start"
        size="lg"
        type="submit"
        disabled={pending}
        aria-describedby={pending ? "wedding-facts-pending" : undefined}
      >
        Guardar los datos de la boda
      </Button>

      {pending && (
        <p
          className="text-sm text-muted-foreground"
          id="wedding-facts-pending"
          role="status"
        >
          Se están guardando los datos. Un momento.
        </p>
      )}

      {state.notice !== null && (
        // A refusal that belongs to no field. `role="alert"` rather than
        // `status`: nothing was saved and the operator has to act.
        <p
          className="wedding-facts__notice text-sm text-destructive"
          role="alert"
        >
          {state.notice}
        </p>
      )}

      {state.saved && !pending && (
        // The form re-renders holding exactly what the operator typed, so a
        // successful save looks identical to one that never happened. This is the
        // only difference between the two.
        <p className="wedding-facts__saved text-sm text-success" role="status">
          Se guardaron los datos de la boda.
        </p>
      )}
    </form>
  );
}
