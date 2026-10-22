import { CLASSES, RACES, classLabel, raceLabel, type CharData } from '../data/data';
import { translations } from './translations';

export type Language = 'es' | 'en';

const reverseTranslations = new Map(Object.entries(translations).map(([source, translated]) => [translated, source]));
const normalizeLineEndings = (text: string) => text.replace(/\r\n/g, '\n');
const normalizedTranslations = new Map(Object.entries(translations).map(([source, translated]) => [normalizeLineEndings(source), translated]));
const normalizedReverseTranslations = new Map([...reverseTranslations].map(([translated, source]) => [normalizeLineEndings(translated), source]));
const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();

let language: Language = localStorage.getItem('brumaluz-language') === 'en' ? 'en' : 'es';

export function getLanguage() {
  return language;
}

export function setLanguage(next: Language) {
  language = next;
  localStorage.setItem('brumaluz-language', next);
  applyLanguage(document);
  document.dispatchEvent(new CustomEvent('brumaluz-language-change', { detail: next }));
}

export function t(source: string, values: Record<string, string | number> = {}) {
  const normalizedSource = normalizeLineEndings(source);
  let translated = language === 'en'
    ? translations[source] ?? normalizedTranslations.get(normalizedSource) ?? source
    : reverseTranslations.get(source) ?? normalizedReverseTranslations.get(normalizedSource) ?? source;
  for (const [key, value] of Object.entries(values)) translated = translated.replaceAll(`{${key}}`, String(value));
  return translated;
}

/** Raza y clase con el género del personaje; en inglés no hay distinción de género. */
export const raceText = (d: Pick<CharData, 'race' | 'sex'>) => (language === 'en' ? t(RACES[d.race].label) : raceLabel(d));
export const classText = (d: Pick<CharData, 'cls' | 'sex'>) => (language === 'en' ? t(CLASSES[d.cls].label) : classLabel(d));

export function applyLanguage(root: ParentNode) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const source = textSources.get(text) ?? reverseTranslations.get(text.data.trim()) ?? text.data;
    textSources.set(text, source);
    const translated = language === 'en' ? translations[source.trim()] : reverseTranslations.get(source.trim());
    if (translated) {
      const leading = source.match(/^\s*/)?.[0] ?? '';
      const trailing = source.match(/\s*$/)?.[0] ?? '';
      text.data = `${leading}${translated}${trailing}`;
    } else if (language === 'es') {
      text.data = source;
    }
  }
  const elements = root instanceof Document ? root.querySelectorAll('*') : root.querySelectorAll('*');
  for (const element of elements) {
    const sources = attributeSources.get(element) ?? new Map<string, string>();
    for (const attribute of ['title', 'placeholder', 'aria-label', 'aria-description']) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      const source = sources.get(attribute) ?? value;
      sources.set(attribute, source);
      const translated = language === 'en' ? translations[source] : reverseTranslations.get(source);
      if (translated) element.setAttribute(attribute, translated);
      else if (language === 'es') element.setAttribute(attribute, source);
    }
    attributeSources.set(element, sources);
  }
}
