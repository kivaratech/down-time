import { check, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { commentsTable } from "./comments";
import { restaurantsTable } from "./restaurants";
import { supervisorsTable } from "./supervisors";

// Emoji reactions on issue comments (org-derived via comment → issue).
//
// A reaction belongs to exactly one actor:
//  - a supervisor/admin account (supervisorId), or
//  - a restaurant (restaurantId) — paired tablets are shared devices with no
//    per-person login, so every tablet at a restaurant reacts as that
//    restaurant.
// The comment_reactions_one_actor CHECK enforces "exactly one of the two".
//
// An actor can add several different emoji to the same comment but each emoji
// only once — the two partial unique indexes back the toggle semantics of
// POST /issues/:id/comments/:commentId/reactions.
//
// Everything cascades: deleting a comment (or its issue), a supervisor, or a
// restaurant removes the matching reactions, so none of the existing delete
// flows need to know this table exists.
export const commentReactionsTable = pgTable(
  "comment_reactions",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    supervisorId: integer("supervisor_id").references(() => supervisorsTable.id, { onDelete: "cascade" }),
    restaurantId: integer("restaurant_id").references(() => restaurantsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("comment_reactions_comment_id_idx").on(table.commentId),
    uniqueIndex("comment_reactions_supervisor_unique")
      .on(table.commentId, table.emoji, table.supervisorId)
      .where(sql`${table.supervisorId} IS NOT NULL`),
    uniqueIndex("comment_reactions_restaurant_unique")
      .on(table.commentId, table.emoji, table.restaurantId)
      .where(sql`${table.restaurantId} IS NOT NULL`),
    check(
      "comment_reactions_one_actor",
      sql`(${table.supervisorId} IS NULL) <> (${table.restaurantId} IS NULL)`,
    ),
  ],
);

export type CommentReaction = typeof commentReactionsTable.$inferSelect;
