import { Button } from "@/components/ui/button";

/**
 * The per-device WhatsApp account picker — presentational, props only.
 *
 * It asks a question the server cannot answer and cannot check: which WhatsApp
 * account is installed on THIS handset. `wa.me` addresses the recipient only —
 * there is no sender parameter — so the message leaves from whichever account
 * the phone has, and the only entity that knows which one that is, is the
 * person holding the phone.
 *
 * NOTHING IS PRESELECTED WHEN THE DEVICE HAS NOT ANSWERED. A default would make
 * clearing site data silently pick an operator, and the declaration's whole
 * value is that it was stated by a human. Only a previous answer from this same
 * device is shown as selected, so changing it is one tap rather than a re-read.
 *
 * No `'use client'`: it is a plain form posting to a Server Action, so it works
 * with JavaScript disabled and holds no state worth hydrating.
 */

export interface DeviceOperatorChoice {
  readonly id: string;
  readonly displayName: string;
}

export interface DeviceDeclarationFormProps {
  readonly operators: readonly DeviceOperatorChoice[];
  /** What this device declared before, or `null` if it never has. */
  readonly declaredSenderId: string | null;
  readonly action: (formData: FormData) => void | Promise<void>;
}

export function DeviceDeclarationForm({
  operators,
  declaredSenderId,
  action,
}: DeviceDeclarationFormProps) {
  return (
    <form className="device-declaration flex flex-col gap-4" action={action}>
      <fieldset className="rounded-lg border border-border bg-card px-4 py-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          ¿Qué cuenta de WhatsApp está instalada en este dispositivo?
        </legend>

        <p
          className="device-declaration__why mt-1 text-sm text-hint"
          style={{ maxWidth: "48ch" }}
        >
          Los enlaces wa.me solo indican quién recibe el mensaje: no existe
          forma de elegir desde qué cuenta se envía. El mensaje sale de la
          cuenta instalada en este teléfono, así que esta respuesta se guarda
          por dispositivo y no por sesión.
        </p>

        {operators.map((operator) => (
          <p
            className="mt-3 flex min-h-11 items-center gap-3 rounded-md bg-muted px-3"
            key={operator.id}
          >
            <input
              className="size-4 accent-[var(--primary)]"
              type="radio"
              id={`device-sender-${operator.id}`}
              name="senderId"
              value={operator.id}
              defaultChecked={operator.id === declaredSenderId}
              required
            />
            <label
              className="flex-1 text-sm text-foreground"
              htmlFor={`device-sender-${operator.id}`}
            >
              {operator.displayName}
            </label>
          </p>
        ))}
      </fieldset>

      <Button className="self-start" size="lg" type="submit">
        Guardar la declaración de este dispositivo
      </Button>
    </form>
  );
}
