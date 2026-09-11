import { requireOperator } from "@/lib/server/console-session";

/**
 * The console landing page.
 *
 * Deliberately minimal: this work unit delivers authentication and session
 * survival, and what this page proves is that an authorized session reaches a
 * protected render at all. The partitioned guest list, the shared progress
 * dashboard and the per-device WhatsApp declaration are work unit 6a-ii and
 * land here.
 *
 * `requireOperator()` again, even though the layout already called it. It is
 * one cached identity header and one indexed row, and the alternative is a page
 * whose authorization depends on a layout continuing to exist above it.
 */
export default async function ConsolePage() {
  const operator = await requireOperator();

  return (
    <main className="console__main">
      {/* No gendered greeting: either operator may be signed in here. */}
      <h2>Le damos la bienvenida al panel, {operator.displayName}</h2>
      <p>
        La sesión está activa y se renueva sola mientras el panel esté en uso.
      </p>
      <p className="console__pending">
        La lista de invitaciones y la declaración de dispositivo se habilitan en
        la próxima entrega.
      </p>
    </main>
  );
}
