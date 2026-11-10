// The reaction set offered on comments, in display order:
//   👍 thumbs up · ✅ check mark · ❤️ red heart · 😂 tears of joy · 😮 open mouth · 👀 eyes
// Written as escapes so the exact code points are unambiguous — in particular
// the heart MUST carry the U+FE0F variation selector or it renders as a plain
// text glyph instead of the red emoji on some platforms.
//
// Keep in sync with REACTION_EMOJI in artifacts/api-server/src/lib/reactions.ts
// — the server rejects any emoji that isn't in its copy of this list.
export const REACTION_EMOJI: readonly string[] = [
  "\u{1F44D}",
  "✅",
  "❤️",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F440}",
];
