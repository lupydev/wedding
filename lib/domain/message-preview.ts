/**
 * What the console's mock WhatsApp bubble is allowed to claim — pure.
 *
 * WHY THE DISCLAIMERS ARE CODE AND NOT A COMMENT IN A COMPONENT
 *
 * A preview is useful exactly in proportion to how closely it matches the real
 * thing, and dangerous in exactly the same proportion: an operator who trusts
 * the mock stops reading the message, and a WhatsApp message cannot be recalled
 * once it is sent. Every line below names a specific way the mock is KNOWN to
 * be wrong, so that a difference the operator notices in a real chat reads as
 * "the preview said this would differ" rather than as a defect in the
 * invitation.
 *
 * They live here, pinned by tests, because a divergence quietly dropped during
 * a markup refactor is precisely the kind of loss nobody notices until it
 * matters. WhatsApp publishes none of this behavior, so there is no upstream
 * document to re-derive it from.
 *
 * Operator-facing copy is Spanish, neutral register. Identifiers and comments
 * stay English.
 */

/** The label the whole preview pane carries. */
export const MESSAGE_PREVIEW_APPROXIMATE_LABEL =
  "Aproximado — el resultado real varía según el dispositivo";

/**
 * Every way the mock is known to diverge from a real WhatsApp chat.
 *
 * Ordered from the most likely to be mistaken for a defect to the least.
 *
 * THE LAST ENTRY USED TO NAME THE CARD, AND THAT CLAIM DIED WITH SATORI.
 *
 * It said «la imagen de la tarjeta dibuja los emoji con el juego Twemoji».
 * True while the card went through `ImageResponse`; the card is a JPEG read
 * off the disk now, there is no emoji on it and no Twemoji anywhere in this
 * product. A list whose whole contract is "every line names a specific way
 * the mock is KNOWN to be wrong" cannot carry a line that is itself wrong: a
 * false caveat spends the operator's attention looking for a difference that
 * cannot occur, which is the opposite of what this list is for.
 *
 * It was replaced rather than deleted because the divergence went LIVE the
 * day the draft gained 👰🏻‍♀️🤵🏼‍♂️. The bubble draws them with the operator's
 * own fonts and the recipient's phone draws them with its own, and a joined
 * sequence carrying a skin tone is exactly the kind a system that does not
 * know it renders as separate pieces. Same slot, same count, a claim that is
 * true again.
 */
export const MESSAGE_PREVIEW_DIVERGENCES: readonly string[] = [
  "WhatsApp pliega los mensajes largos detrás de «Ver más». No publica a partir de cuántos caracteres lo hace, y el punto de corte cambia con el ancho de la pantalla y con el tamaño de letra que tenga configurado quien lo lee.",
  "La tarjeta puede dibujarse grande, con la imagen arriba, o pequeña, con una miniatura al lado. Esa elección es un comportamiento de la aplicación, no una garantía: la misma imagen puede verse de las dos formas.",
  "iOS, Android y WhatsApp Web no dibujan la tarjeta igual. Cambian los bordes, cuántas líneas de título se muestran y si la descripción aparece siquiera.",
  "Solo el primer enlace del mensaje genera vista previa. Un segundo enlace no añade otra tarjeta: quita la primera. Por eso la plantilla lleva un único enlace.",
  "La tarjeta aparece únicamente cuando WhatsApp ya descargó la imagen en el dispositivo de quien envía. Si todavía no la descargó, se ve texto plano durante unos segundos.",
  "Los emoji del mensaje los dibuja cada dispositivo con su propio juego: aquí se ven con los de este equipo y en el teléfono de quien lo reciba se verán con los suyos. Un sistema que no conozca uno de ellos puede partirlo en varios.",
];

/**
 * Where WhatsApp is ROUGHLY known to start collapsing a message.
 *
 * Explicitly an approximation, and treated as one everywhere it is used. The
 * real threshold is undocumented and depends on screen width and the reader's
 * font size, so the honest thing a preview can do is warn near the region where
 * folding becomes likely — never announce a limit, which would be a lie with a
 * number in it, and therefore the most believable kind.
 */
export const READ_MORE_APPROX_CHARACTERS = 650;

export interface MessageLengthDescription {
  readonly characters: number;
  /** `true` once the draft is long enough that folding becomes likely. */
  readonly mayCollapse: boolean;
  /** The operator-facing sentence. Always states the count. */
  readonly sentence: string;
}

/** Describes how long a draft is, and whether it is near the folding region. */
export function describeMessageLength(
  message: string,
): MessageLengthDescription {
  const characters = message.length;
  const mayCollapse = characters > READ_MORE_APPROX_CHARACTERS;

  return {
    characters,
    mayCollapse,
    sentence: mayCollapse
      ? `${characters} caracteres. A partir de aproximadamente ${READ_MORE_APPROX_CHARACTERS} WhatsApp suele plegar el mensaje detrás de «Ver más»; el punto exacto no está documentado.`
      : `${characters} caracteres.`,
  };
}
