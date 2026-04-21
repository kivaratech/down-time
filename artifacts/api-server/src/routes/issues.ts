import { Router, type IRouter } from "express";
import {
  db,
  issuesTable,
  commentsTable,
  restaurantsTable,
  supervisorsTable,
  supervisorRestaurantsTable,
} from "@workspace/db";
import { eq, and, asc, lte, isNotNull, inArray, or, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  extractToken,
  getRestaurantFromToken,
  getSupervisorFromToken,
} from "../lib/auth";
import { getCategoryForArea } from "../lib/equipment";
import { notifySupervisorsOfNewIssue } from "../lib/notifications";
import {
  ListRestaurantIssuesParams,
  ListRestaurantIssuesQueryParams,
  ListIssuesQueryParams,
  CreateIssueBody,
  GetIssueParams,
  UpdateIssueParams,
  UpdateIssueBody,
  AddCommentParams,
  AddCommentBody,
} from "@workspace/api-zod";
import { z } from "zod";

const SAFE_OBJECT_PATH = /^[\w\-.\/]+$/;

const router: IRouter = Router();

const PRIORITY_ORDER = sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`;

function buildIssueQuery() {
  return db
    .select({
      id: issuesTable.id,
      restaurantId: issuesTable.restaurantId,
      restaurantName: restaurantsTable.name,
      area: issuesTable.area,
      category: issuesTable.category,
      equipmentType: issuesTable.equipmentType,
      subItem: issuesTable.subItem,
      customLabel: issuesTable.customLabel,
      description: issuesTable.description,
      status: issuesTable.status,
      assignedTo: issuesTable.assignedTo,
      priority: issuesTable.priority,
      imageUrl: issuesTable.imageUrl,
      createdAt: issuesTable.createdAt,
      updatedAt: issuesTable.updatedAt,
      resolvedAt: issuesTable.resolvedAt,
      commentCount: sql<number>`(select count(*) from comments where comments.issue_id = issues.id)`.as("comment_count"),
    })
    .from(issuesTable)
    .leftJoin(restaurantsTable, eq(issuesTable.restaurantId, restaurantsTable.id));
}

// GET /api/restaurants/:id/issues
router.get("/restaurants/:id/issues", async (req, res) => {
  const params = ListRestaurantIssuesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid restaurant ID" });
    return;
  }
  const restaurantId = params.data.id;

  const query = ListRestaurantIssuesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (restaurant && restaurant.id !== restaurantId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const conditions: SQL<unknown>[] = [eq(issuesTable.restaurantId, restaurantId)];

  const { status } = query.data;
  if (status && status !== "all") {
    conditions.push(eq(issuesTable.status, status));
  }

  const issues = await buildIssueQuery()
    .where(and(...conditions))
    .orderBy(PRIORITY_ORDER, asc(issuesTable.createdAt));

  res.json(issues);
});

// GET /api/issues (supervisor only)
router.get("/issues", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const query = ListIssuesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { restaurantId, status, category, priority, assignedTo, agingDays } = query.data;
  const conditions: SQL<unknown>[] = [];

  // Non-admin supervisors only see issues from their assigned restaurants
  if (supervisor.role !== "admin") {
    const assignments = await db
      .select({ restaurantId: supervisorRestaurantsTable.restaurantId })
      .from(supervisorRestaurantsTable)
      .where(eq(supervisorRestaurantsTable.supervisorId, supervisor.id));
    const assignedIds = assignments.map((a) => a.restaurantId);
    if (assignedIds.length === 0) {
      res.json([]);
      return;
    }
    if (restaurantId !== undefined) {
      // Honour the specific filter only if that restaurant is assigned to them
      if (!assignedIds.includes(restaurantId)) {
        res.json([]);
        return;
      }
      conditions.push(eq(issuesTable.restaurantId, restaurantId));
    } else {
      conditions.push(inArray(issuesTable.restaurantId, assignedIds));
    }
  } else {
    if (restaurantId !== undefined) {
      conditions.push(eq(issuesTable.restaurantId, restaurantId));
    }
  }

  if (status && status !== "all") {
    conditions.push(eq(issuesTable.status, status));
  }
  if (category) {
    conditions.push(eq(issuesTable.category, category));
  }
  if (priority) {
    conditions.push(eq(issuesTable.priority, priority));
  }
  if (assignedTo) {
    conditions.push(eq(issuesTable.assignedTo, assignedTo));
  }
  if (agingDays !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - agingDays);
    conditions.push(lte(issuesTable.createdAt, cutoff));
  }

  const baseQuery = buildIssueQuery();
  const issues = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(PRIORITY_ORDER, asc(issuesTable.createdAt))
    : await baseQuery.orderBy(PRIORITY_ORDER, asc(issuesTable.createdAt));

  res.json(issues);
});

// POST /api/issues
router.post("/issues", async (req, res) => {
  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const body = CreateIssueBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const { restaurantId, area, equipmentType, subItem, customLabel, description, assignedTo, imageUrl } = body.data;

  if (restaurant && restaurant.id !== restaurantId) {
    res.status(403).json({ error: "Access denied: cannot create issues for another restaurant" });
    return;
  }

  if (description.length > 500) {
    res.status(400).json({ error: "Description must be 500 characters or less" });
    return;
  }

  if (imageUrl && !SAFE_OBJECT_PATH.test(imageUrl)) {
    res.status(400).json({ error: "Invalid imageUrl format" });
    return;
  }

  const category = getCategoryForArea(area);

  const [issue] = await db
    .insert(issuesTable)
    .values({
      restaurantId,
      area,
      category,
      equipmentType,
      subItem: subItem ?? null,
      customLabel: customLabel ?? null,
      description,
      status: "open",
      assignedTo: assignedTo ?? null,
      imageUrl: imageUrl ?? null,
    })
    .returning();

  const [fullIssue] = await buildIssueQuery().where(eq(issuesTable.id, issue.id));
  res.status(201).json(fullIssue);

  // Notify supervisors assigned to this restaurant and all admins — non-blocking
  const log = req.log;
  Promise.all([
    db
      .select({ expoPushToken: supervisorsTable.expoPushToken })
      .from(supervisorsTable)
      .innerJoin(
        supervisorRestaurantsTable,
        and(
          eq(supervisorRestaurantsTable.supervisorId, supervisorsTable.id),
          eq(supervisorRestaurantsTable.restaurantId, restaurantId),
        ),
      )
      .where(and(isNotNull(supervisorsTable.expoPushToken), eq(supervisorsTable.isActive, true))),
    db
      .select({ expoPushToken: supervisorsTable.expoPushToken })
      .from(supervisorsTable)
      .where(
        and(
          eq(supervisorsTable.role, "admin"),
          isNotNull(supervisorsTable.expoPushToken),
          eq(supervisorsTable.isActive, true),
        ),
      ),
  ])
    .then(([assigned, admins]) => {
      const tokenSet = new Set(
        [...assigned, ...admins]
          .map((s) => s.expoPushToken)
          .filter((t): t is string => t !== null),
      );
      return notifySupervisorsOfNewIssue({
        restaurantName: fullIssue.restaurantName,
        equipmentType: fullIssue.equipmentType,
        subItem: fullIssue.subItem,
        description: fullIssue.description,
        supervisorTokens: Array.from(tokenSet),
      });
    })
    .catch((err) => {
      log.error({ err }, "Notification send failed");
    });
});

// GET /api/issues/:id
router.get("/issues/:id", async (req, res) => {
  const params = GetIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const id = params.data.id;

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [issue] = await buildIssueQuery().where(eq(issuesTable.id, id));
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  if (restaurant && issue.restaurantId !== restaurant.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.issueId, id))
    .orderBy(asc(commentsTable.createdAt));

  res.json({ ...issue, comments });
});

// PATCH /api/issues/:id
router.patch("/issues/:id", async (req, res) => {
  const params = UpdateIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const id = params.data.id;

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const body = UpdateIssueBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const [existing] = await db.select().from(issuesTable).where(eq(issuesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  if (restaurant && existing.restaurantId !== restaurant.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { status, assignedTo, priority, description } = body.data;

  const updates: Partial<typeof issuesTable.$inferInsert> & { updatedAt: Date; resolvedAt?: Date | null } = {
    updatedAt: new Date(),
  };

  if (status !== undefined) {
    updates.status = status;
    updates.resolvedAt = status === "resolved" ? new Date() : null;
  }
  if (assignedTo !== undefined) {
    updates.assignedTo = assignedTo ?? null;
  }
  if (description !== undefined) {
    updates.description = description;
  }
  if (priority !== undefined && supervisor) {
    updates.priority = priority ?? null;
  }

  const [updated] = await db
    .update(issuesTable)
    .set(updates)
    .where(eq(issuesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  const [fullIssue] = await buildIssueQuery().where(eq(issuesTable.id, id));
  res.json(fullIssue);
});

// POST /api/issues/:id/comments
router.post("/issues/:id/comments", async (req, res) => {
  const params = AddCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const issueId = params.data.id;

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const body = AddCommentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const [issue] = await db.select().from(issuesTable).where(eq(issuesTable.id, issueId)).limit(1);
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  if (restaurant && issue.restaurantId !== restaurant.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ issueId, authorName: body.data.authorName, body: body.data.body })
    .returning();

  res.status(201).json(comment);
});

const DeleteCommentParams = z.object({ id: z.coerce.number().int().positive(), commentId: z.coerce.number().int().positive() });

// DELETE /api/issues/:id/comments/:commentId — admin only
router.delete("/issues/:id/comments/:commentId", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor || supervisor.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue or comment ID" });
    return;
  }
  const { id: issueId, commentId } = params.data;

  const [deleted] = await db
    .delete(commentsTable)
    .where(and(eq(commentsTable.id, commentId), eq(commentsTable.issueId, issueId)))
    .returning({ id: commentsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
