/** One duration for mouths, bubbles and ambient conversation turns. */
export const speechSeconds = (text: string) => Math.min(8, 2.5 + text.length * .06);

/** Wait for either supported translation, then leave a small pause before the reply. */
export const conversationTurnSeconds = (...translations: readonly string[]) => Math.max(...translations.map(speechSeconds)) + .45;
