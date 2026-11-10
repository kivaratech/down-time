// U+FFFC OBJECT REPLACEMENT CHARACTER — a stand-in iOS puts into a text field
// for something that isn't text. In practice it arrives from voice dictation:
// while someone dictates into the multi-line "What's wrong?" field, iOS marks
// each spoken segment with this placeholder and it gets submitted as part of
// the description. It is invisible on iOS, but Android draws it as a dashed
// box reading "OBJ" in the middle of the sentence.
const OBJECT_PLACEHOLDER = "￼";

/**
 * Removes object-replacement placeholders from user-entered text.
 *
 * Each placeholder (plus any spaces hugging it) becomes a single space, so
 * "heating up￼It stays cold" doesn't get glued into "upIt"; whitespace left
 * dangling at a line end is then dropped. Text without a placeholder is
 * returned untouched.
 *
 * Applied to every free-text field on write. Mirrors stripObjectPlaceholders
 * in artifacts/mobile/lib/cleanText.ts, which also cleans rows saved before
 * this existed when they are displayed.
 */
export function stripObjectPlaceholders(text: string): string {
  if (!text.includes(OBJECT_PLACEHOLDER)) return text;
  return text
    .replace(/[ \t]*￼+[ \t]*/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
