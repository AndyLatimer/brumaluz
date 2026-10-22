// Atajos para el DOM de la interfaz.

// ---------------- Interfaz ----------------
export const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
