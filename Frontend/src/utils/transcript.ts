/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Words that carry no usable request on their own. These are common
// cut-off fragments, isolated pronouns/articles, and Whisper fillers.
const INCOMPLETE_UTTERANCES = new Set([
  'i', 'a', 'an', 'the', 'uh', 'um', 'hmm', 'hm', 'mm', 'er', 'ah', 'oh',
  'eh', 'huh', 'you', 'we', 'he', 'she', 'it', 'they', 'me', 'my', 'your',
  'our', 'their', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'so',
  'and', 'but', 'or', 'like', 'well', 'just', 'that', 'this', 'these',
  'those', 'to', 'of', 'in', 'on', 'at',
  // Hindi fragments / isolated pronouns
  'मैं', 'मुझे', 'तुम', 'आप', 'वह', 'वो', 'ये', 'यह', 'वे', 'हूँ', 'हूं',
  'था', 'थी', 'थे', 'और', 'लेकिन', 'तो', 'ही', 'भी',
]);

/**
 * Returns false for empty, punctuation-only, or clearly truncated input.
 * Short greetings such as "Hi", "Hello", "No", and "Thanks" remain valid.
 */
export function isMeaningfulUtterance(text: string): boolean {
  const cleaned = text
    .normalize('NFKC')
    // Keep combining marks (\p{M}) so Devanagari vowel signs survive.
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[\p{L}\p{N}]/u.test(cleaned)) return false;

  const words = cleaned.toLowerCase().split(' ');
  if (words.length === 1) {
    const word = words[0];
    if (INCOMPLETE_UTTERANCES.has(word)) return false;
    // A single Latin letter is almost always a cut-off fragment.
    if (/^[a-z]$/i.test(word)) return false;
  }

  return !words.every((word) => INCOMPLETE_UTTERANCES.has(word));
}
