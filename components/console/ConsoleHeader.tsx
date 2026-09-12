/**
 * The console's header — presentational, props only.
 *
 * Two links out, and both are ordinary anchors. Signing out and changing this
 * device's WhatsApp declaration must both work with JavaScript disabled, because
 * the state they repair — a session on the wrong handset, halfway through a
 * dispatch run — is precisely the state in which an operator starts turning things
 * off to make the console behave.
 *
 * SIGN-OUT IS HERE AND NOT IN THE BOTTOM BAR. A tab bar sits under the thumb; an
 * accidental sign-out mid-run costs a re-authentication on a phone, in a venue,
 * with the rest of the households still waiting.
 */

export interface ConsoleHeaderProps {
  readonly operatorDisplayName: string;
  readonly devicePath: string;
  readonly signOutPath: string;
}

export function ConsoleHeader({
  operatorDisplayName,
  devicePath,
  signOutPath,
}: ConsoleHeaderProps) {
  return (
    <header className="console__header flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-4 py-3 md:px-6">
      <h1 className="text-lg leading-tight">Panel de envíos</h1>

      <p className="console__operator text-sm text-muted-foreground">
        Sesión iniciada como{" "}
        <strong className="font-semibold text-foreground">
          {operatorDisplayName}
        </strong>
      </p>

      <div className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        {/* A plain link, so changing the declaration works with no JavaScript. */}
        <a
          className="console__device text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={devicePath}
        >
          Cambiar la cuenta de WhatsApp de este dispositivo
        </a>

        {/* A plain link, so signing out works with no JavaScript at all. */}
        <a
          className="console__sign-out text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href={signOutPath}
        >
          Cerrar sesión
        </a>
      </div>
    </header>
  );
}
