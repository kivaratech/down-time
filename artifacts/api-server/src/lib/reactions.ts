import { db, commentReactionsTable, restaurantsTable, supervisorsTable } from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Principal } from "../middleware/principal";

// The reaction set offered on comments, in display order:
//   👍 thumbs up · ✅ check mark · ❤️ red heart · 😂 tears of joy · 😮 open mouth · 👀 eyes
// Written as escapes so the exact code points are unambiguous — in particular
// the heart MUST carry the U+FE0F variation selector or it renders as a plain
// text glyph instead of the red emoji on some platforms.
//
// Keep in sync with REACTION_EMOJI in artifacts/mobile/constants/reactions.ts.
// All six date from Unicode 6.0/6.1, so they render on every device the app
// supports — don't add newer emoji without checking the oldest tablets.
export const REACTION_EMOJI: readonly string[] = [
  "\u{1F44D}",
  "✅",
  "❤️",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F440}",
];

export function isSupportedReaction(emoji: string): boolean {
  return REACTION_EMOJI.includes(emoji);
}

export type CommentReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  names: string[];
};

/**
 * Loads reactions for a set of comments and aggregates them per emoji.
 * Returns a map keyed by comment id; comments without reactions are absent
 * (callers default to an empty array).
 *
 * `reactedByMe` is relative to the principal: a supervisor/admin matches on
 * their own id, a paired tablet matches on its restaurant.
 */
export async function loadCommentReactions(
  commentIds: number[],
  principal: Principal,
): Promise<Map<number, CommentReactionSummary[]>> {
  const byComment = new Map<number, CommentReactionSummary[]>();
  if (commentIds.length === 0) return byComment;

  const rows = await db
    .select({
      commentId: commentReactionsTable.commentId,
      emoji: commentReactionsTable.emoji,
      supervisorId: commentReactionsTable.supervisorId,
      restaurantId: commentReactionsTable.restaurantId,
      supervisorName: supervisorsTable.name,
      restaurantName: restaurantsTable.name,
    })
    .from(commentReactionsTable)
    .leftJoin(supervisorsTable, eq(commentReactionsTable.supervisorId, supervisorsTable.id))
    .leftJoin(restaurantsTable, eq(commentReactionsTable.restaurantId, restaurantsTable.id))
    .where(inArray(commentReactionsTable.commentId, commentIds))
    // Oldest first so `names` reads in the order people reacted.
    .orderBy(asc(commentReactionsTable.createdAt), asc(commentReactionsTable.id));

  for (const row of rows) {
    let summaries = byComment.get(row.commentId);
    if (!summaries) {
      summaries = [];
      byComment.set(row.commentId, summaries);
    }
    let summary = summaries.find((s) => s.emoji === row.emoji);
    if (!summary) {
      summary = { emoji: row.emoji, count: 0, reactedByMe: false, names: [] };
      summaries.push(summary);
    }
    summary.count += 1;
    summary.names.push(row.supervisorName ?? row.restaurantName ?? "Unknown");
    const mine =
      principal.kind === "supervisor"
        ? row.supervisorId === principal.supervisorId
        : row.restaurantId === principal.restaurantId;
    if (mine) summary.reactedByMe = true;
  }

  // Fixed display order (the picker's order) so chips don't shuffle around as
  // people react.
  for (const summaries of byComment.values()) {
    summaries.sort((a, b) => REACTION_EMOJI.indexOf(a.emoji) - REACTION_EMOJI.indexOf(b.emoji));
  }

  return byComment;
}

/**
 * Adds the principal's reaction if absent, removes it if present.
 *
 * Delete-then-insert rather than select-then-branch so two rapid taps can't
 * both decide "absent" and collide — and the insert still ignores a unique
 * violation in case a second tablet at the same restaurant reacts in the same
 * instant.
 */
export async function toggleCommentReaction(
  commentId: number,
  emoji: string,
  principal: Principal,
): Promise<void> {
  const actorMatch =
    principal.kind === "supervisor"
      ? eq(commentReactionsTable.supervisorId, principal.supervisorId)
      : eq(commentReactionsTable.restaurantId, principal.restaurantId);

  const removed = await db
    .delete(commentReactionsTable)
    .where(
      and(
        eq(commentReactionsTable.commentId, commentId),
        eq(commentReactionsTable.emoji, emoji),
        actorMatch,
      ),
    )
    .returning({ id: commentReactionsTable.id });

  if (removed.length > 0) return;

  await db
    .insert(commentReactionsTable)
    .values(
      principal.kind === "supervisor"
        ? { commentId, emoji, supervisorId: principal.supervisorId }
        : { commentId, emoji, restaurantId: principal.restaurantId },
    )
    .onConflictDoNothing();
}
