/** Experiencia para pasar del nivel L al L+1: round(base × L ^ exponent). */
export const XP_CURVE = { base: 100, exponent: 1.5 };

export function experienceToNextLevel(level: number): number {
  return Math.round(XP_CURVE.base * Math.pow(Math.max(level, 1), XP_CURVE.exponent));
}
