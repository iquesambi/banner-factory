/**
 * Danish/Nordic folding: the taxonomy slugs are ASCII-folded (ø→o, æ→a, å→a)
 * while the feed keeps the real characters, so both sides must be folded the
 * same way before any comparison.
 */
const FOLD: Record<string, string> = {
  ø: 'o', æ: 'a', å: 'a', ö: 'o', ä: 'a', ü: 'u', é: 'e', è: 'e',
  ê: 'e', á: 'a', à: 'a', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ç: 'c', ß: 'ss',
};

export function fold(input: string): string {
  let out = input.toLowerCase();
  for (const [from, to] of Object.entries(FOLD)) out = out.replaceAll(from, to);
  return out.replace(/[^a-z0-9]+/g, ' ').trim();
}

export function words(input: string): string[] {
  const f = fold(input);
  return f ? f.split(' ') : [];
}
