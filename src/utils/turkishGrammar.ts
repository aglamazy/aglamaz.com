/**
 * Turkish dative-case ("-e/-a hali") helpers for interpolating arbitrary
 * names (e.g. site names) into fixed tr strings such as "{{name}}'ye Hoş
 * Geldiniz". A static suffix is wrong for most names because Turkish dative
 * suffixes vary with the last vowel of the preceding word (front/back vowel
 * harmony) and with a buffer consonant when the word ends in a vowel.
 *
 * This is a deliberately small heuristic, not a morphological analyzer:
 * - Vowel harmony is resolved by scanning back from the end of the last
 *   word for its last vowel (front: e/i/ö/ü -> "e"; back: a/ı/o/u -> "a").
 * - Words ending in a consonant take the harmony vowel directly.
 * - Words ending in a vowel take a buffer consonant: "n" if the ending
 *   looks like the 3rd-person possessive -sI suffix (e.g. "sitesi" ->
 *   "sitesi'ne"), otherwise "y" (e.g. "Ankara" -> "Ankara'ya").
 * - Consonant softening (kitap -> kitaba) is intentionally skipped: per TDK
 *   convention, apostrophe-suffixed proper nouns keep their original
 *   spelling before the apostrophe.
 */

const TURKISH_UPPER_TO_LOWER: Record<string, string> = {
  A: 'a', B: 'b', C: 'c', Ç: 'ç', D: 'd', E: 'e', F: 'f', G: 'g', Ğ: 'ğ',
  H: 'h', I: 'ı', İ: 'i', J: 'j', K: 'k', L: 'l', M: 'm', N: 'n', O: 'o',
  Ö: 'ö', P: 'p', R: 'r', S: 's', Ş: 'ş', T: 't', U: 'u', Ü: 'ü', V: 'v',
  Y: 'y', Z: 'z',
};

function toTurkishLower(char: string): string {
  return TURKISH_UPPER_TO_LOWER[char] ?? char.toLowerCase();
}

const FRONT_VOWELS = new Set(['e', 'i', 'ö', 'ü']);
const BACK_VOWELS = new Set(['a', 'ı', 'o', 'u']);

/**
 * Returns `name` with a grammatically-correct Turkish dative suffix appended
 * (e.g. "Ankara" -> "Ankara'ya", "Demo sitesi" -> "Demo sitesi'ne").
 * Harmony/buffer rules are computed from the last word of `name`.
 */
export function turkishDativeForm(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const lastWord = trimmed.split(/\s+/).pop() ?? trimmed;
  const chars = Array.from(lastWord);

  let harmonyVowel: string | null = null;
  for (let i = chars.length - 1; i >= 0; i--) {
    const lower = toTurkishLower(chars[i]);
    if (FRONT_VOWELS.has(lower) || BACK_VOWELS.has(lower)) {
      harmonyVowel = lower;
      break;
    }
  }
  const suffixVowel = harmonyVowel && BACK_VOWELS.has(harmonyVowel) ? 'a' : 'e';

  const lastChar = toTurkishLower(chars[chars.length - 1]);
  const endsInVowel = FRONT_VOWELS.has(lastChar) || BACK_VOWELS.has(lastChar);
  if (!endsInVowel) {
    return `${trimmed}'${suffixVowel}`;
  }

  const secondLastChar = chars.length > 1 ? toTurkishLower(chars[chars.length - 2]) : '';
  const isPossessiveEnding = secondLastChar === 's';
  const buffer = isPossessiveEnding ? 'n' : 'y';
  return `${trimmed}'${buffer}${suffixVowel}`;
}
