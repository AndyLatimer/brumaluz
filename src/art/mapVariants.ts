import files from './mapVariants.json';

/** Acabados propios: los IDs y los originales CC0 de la biblioteca se conservan. */
const variants: Readonly<Record<string, string>> = files;
const urls = import.meta.glob<string>('../assets/models/props/medieval-bridge*.glb', { eager: true, query: '?url', import: 'default' });

export function mapVariantUrl(id: string): string | undefined {
  const file = variants[id];
  return file ? urls[`../assets/${file}`] : undefined;
}
