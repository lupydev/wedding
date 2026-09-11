"use client";

import { useState } from "react";

import type { PhoneLineType } from "@/lib/domain/phone-reachability";

/**
 * One guest's phone number, editable in place.
 *
 * WHY INLINE
 *
 * A reference project left a note that is worth quoting, because it is the
 * whole justification for this component existing: "sending three people to a
 * full edit screen to type ten digits is the kind of friction that means the
 * data never gets entered." A console whose guest list is missing numbers
 * cannot dispatch anything, so the cost of that friction is the product.
 *
 * WHY THE FLAG IS HERE AND NOT AT DISPATCH TIME
 *
 * A landline is a perfectly valid E.164 number that no WhatsApp will ever
 * answer. Discovered at dispatch, it is a message that reached nobody while the
 * console reported it as sent. Discovered here, next to the field that holds
 * it, it is a number somebody can fix in ten seconds. The classification itself
 * lives in `lib/domain/phone-reachability.ts` and is computed on the server;
 * this component only renders its verdict.
 *
 * The action is a prop. In production the page passes a bound Server Action;
 * validation is the server's (`updateGuestPhone` runs the same strict
 * `normalizeForStorage` the import does), because a browser-side check is a
 * convenience and never a boundary.
 */

export interface GuestPhoneFieldProps {
  readonly guestId: string;
  readonly guestName: string;
  /** The stored E.164 number, or `null` for a guest who has none. */
  readonly phoneE164: string | null;
  readonly lineType: PhoneLineType;
  readonly dispatchable: boolean;
  readonly action: (formData: FormData) => void | Promise<void>;
  /** No editor at all while the device declaration blocks the console. */
  readonly readOnly?: boolean;
}

/** Why this number cannot carry a WhatsApp message, in the operator's words. */
function unreachableReason(
  lineType: PhoneLineType,
  phoneE164: string | null,
): string | null {
  if (phoneE164 === null) {
    return null;
  }

  if (lineType === "fixed_line") {
    return "Parece un número fijo, que no parece recibir WhatsApp.";
  }

  if (lineType === "not_normalizable") {
    return "El número guardado no parece válido, así que no parece recibir WhatsApp.";
  }

  return "Este tipo de línea no parece recibir WhatsApp.";
}

export function GuestPhoneField({
  guestId,
  guestName,
  phoneE164,
  lineType,
  dispatchable,
  action,
  readOnly = false,
}: GuestPhoneFieldProps) {
  const [editing, setEditing] = useState(false);
  const warning = dispatchable ? null : unreachableReason(lineType, phoneE164);

  if (editing) {
    return (
      <form
        className="guest-phone guest-phone--editing"
        action={(formData) => {
          setEditing(false);
          return action(formData);
        }}
      >
        <input type="hidden" name="guestId" value={guestId} />
        <label htmlFor={`phone-${guestId}`}>Número de {guestName}</label>
        <input
          id={`phone-${guestId}`}
          name="phone"
          type="tel"
          autoComplete="off"
          defaultValue={phoneE164 ?? ""}
          // Vacío borra el número. No es un accidente: una persona invitada sin
          // número es un dato válido, y guardarlo como cadena vacía rompería el
          // acceso por teléfono.
          placeholder="Vacío borra el número"
        />
        <button type="submit">Guardar</button>
        <button type="button" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="guest-phone">
      <span className="guest-phone__value">{phoneE164 ?? "Sin número"}</span>

      {warning !== null && (
        <span className="guest-phone__warning" role="status">
          {warning}
        </span>
      )}

      {!readOnly && (
        <button type="button" onClick={() => setEditing(true)}>
          Editar el número de {guestName}
        </button>
      )}
    </div>
  );
}
