/**
 * Bidirectional-text helpers.
 *
 * THE BUG THESE FIX — observed on a real Arabic build, not theorised:
 *
 *   "40" + "SAR / الليلة"   rendered as   40 الليلة / SAR
 *   "2 ضيوف · 1 غرفة"       rendered as   2 ضيوف 1 · غرفة
 *
 * In both cases the app's own markup was correct and the Unicode
 * Bidirectional Algorithm reordered it anyway. Digits are WEAK and
 * punctuation like "/" and "·" is NEUTRAL, so in an Arabic (RTL) paragraph
 * they take their direction from whatever surrounds them — which tore "SAR"
 * away from the number it belongs to, and slid the "·" separator to the
 * wrong side of the room count so it read as part of it.
 *
 * The remedy is an ISOLATE, not a direction override. U+2068 FIRST STRONG
 * ISOLATE ... U+2069 POP DIRECTIONAL ISOLATE tells the algorithm to resolve
 * the enclosed run on its own and treat the whole thing as a single neutral
 * object in the outer paragraph. Unlike the older LRM/RLM marks or the
 * deprecated LRE/RLE embeddings, it does not force a direction — an Arabic
 * value inside an isolate still lays out RTL. Both characters are
 * zero-width, so nothing shifts visually in English either.
 */

/** U+2068 FIRST STRONG ISOLATE */
const FSI = '⁨';
/** U+2069 POP DIRECTIONAL ISOLATE */
const PDI = '⁩';

/**
 * Protects a run from being reordered by the surrounding paragraph. Use it
 * for anything whose internal order is meaningful but whose script may not
 * match the UI language: amounts with a currency, a date range, a booking
 * reference, a phone number.
 */
export function bidiIsolate(text: string | number): string {
  return FSI + String(text) + PDI;
}

/**
 * An amount and its currency, kept adjacent in either direction.
 *
 * `40` + `SAR` reads "40 SAR" in English and "٤٠ SAR" in Arabic — the
 * currency never drifts to the far side of a qualifier like "/ night",
 * which is what made a price look like it applied to something else.
 */
export function formatMoney(amount: number | string, currency: string | null | undefined): string {
  const value = typeof amount === 'number' ? amount.toLocaleString() : amount;
  return bidiIsolate(currency ? `${value} ${currency}` : String(value));
}

/**
 * Joins summary segments with a separator that cannot migrate into either
 * neighbour — "2 guests · 1 room" and "٢ ضيوف · ١ غرفة" both keep the dot
 * between the two groups rather than stuck to a number.
 *
 * Empty and nullish segments are dropped, so a caller can pass conditional
 * parts without assembling the list itself.
 */
/**
 * The direction a piece of USER-written text reads in — from its first strong
 * letter, like the browser's `dir="auto"`. A guest's English message in an
 * Arabic app (or the reverse) must keep its own direction, or its full stop
 * jumps to the front: ".Yes, free parking is available".
 */
export function textDirectionOf(text: string | null | undefined): 'rtl' | 'ltr' | null {
  const m = (text ?? '').match(/[A-Za-zÀ-ɏ֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/);
  if (!m) return null;
  return /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(m[0]) ? 'rtl' : 'ltr';
}

/** Style for a block of user-written text: its own direction and leading edge. */
export function autoDirectionStyle(text: string | null | undefined): { writingDirection: 'rtl' | 'ltr'; textAlign: 'right' | 'left' } | undefined {
  const dir = textDirectionOf(text);
  return dir ? { writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' } : undefined;
}

/**
 * "start → end" that points the way the line reads. `→` is not a mirrored
 * character, so inside Arabic text it pointed BACKWARDS, from the end date to
 * the start. The web flips its arrow icon the same way (DateArrow).
 */
export function formatRange(start: string, end: string, isArabic: boolean): string {
  return `${bidiIsolate(start)} ${isArabic ? '←' : '→'} ${bidiIsolate(end)}`;
}

export function joinIsolated(segments: (string | number | null | undefined)[], separator = ' · '): string {
  return segments
    .filter((s) => s !== null && s !== undefined && String(s).trim() !== '')
    .map((s) => bidiIsolate(String(s).trim()))
    .join(separator);
}
