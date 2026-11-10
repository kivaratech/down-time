// U+FFFC OBJECT REPLACEMENT CHARACTER — a stand-in iOS puts into a text field
// for something that isn't text. In practice it arrives from voice dictation:
// while someone dictates into the multi-line "What's wrong?" field, iOS marks
// each spoken segment with this placeholder and it ends up in the submitted
// description. It is invisible on iOS, but Android draws it as a dashed box
// reading "OBJ" in the middle of the sentence.
const OBJECT_PLACEHOLDER = "￼";

/**
 * Removes object-replacement placeholders from text.
 *
 * Each placeholder (plus any spaces hugging it) becomes a single space, so
 * "heating up￼It stays cold" doesn't get glued into "upIt"; whitespace left
 * dangling at a line end is then dropped. Text without a placeholder is
 * returned untouched.
 *
 * Use it in two places:
 *  - on text about to be SENT (the server strips it too, but cleaning first
 *    means a field holding nothing but a placeholder counts as empty here);
 *  - on text being DISPLAYED, because issues saved before this existed still
 *    contain the character.
 *
 * Do NOT call it from a TextInput's onChangeText: rewriting the value while
 * iOS dictation is in progress cuts the dictation off.
 *
 * Mirrors stripObjectPlaceholders in artifacts/api-server/src/lib/text.ts.
 */
export function stripObjectPlaceholders(text: string): string {
  if (!text.includes(OBJECT_PLACEHOLDER)) return text;
  return text
    .replace(/[ \t]*￼+[ \t]*/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
