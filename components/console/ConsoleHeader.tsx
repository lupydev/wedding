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
  readonly signOutPath: string;
}

export function ConsoleHeader({
  operatorDisplayName,
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

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {/*
          CREATION IS NOT HERE EITHER ANY MORE, AND THAT IS NOT A RETREAT.

          It started at the foot of a scrolling guest list with nothing in the
          navigation pointing at it, moved here, and now lives in the nav — one
          place, where a destination belongs. On a phone that bar is at the
          bottom of the screen, under the thumb.

          Two doors to the same screen is the pattern this console has been
          losing everywhere else; adding one back here would be the same
          mistake in a nicer coat.
        */}

        {/*
          THE DEVICE LINK IS GONE FROM HERE, AND IT WAS THE FOURTH DOOR.

          That screen already has a nav tab, a forced redirect when no
          declaration exists, and a red interstitial above every page when the
          declaration does not match. A permanent header link asking an operator
          to change their WhatsApp account, on every page, was one door too many
          for a question answered once per handset.
        */}

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
