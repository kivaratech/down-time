import { Router, type IRouter } from "express";
import {
  db,
  issuesTable,
  commentsTable,
  restaurantsTable,
  supervisorsTable,
  supervisorDevicesTable,
  supervisorRestaurantsTable,
} from "@workspace/db";
import { eq, and, asc, lte, gte, isNotNull, inArray, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  requireAuth,
  requireSupervisor,
  requireOrgAdmin,
  principalCanAccessRestaurant,
  principalCanAccessIssue,
} from "../lib/auth";
import { getCategoryForArea } from "../lib/equipment";
import { notifySupervisorsOfNewIssue } from "../lib/notifications";
import { ObjectStorageService } from "../lib/objectStorage";
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
const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();

async function signIssueImageUrls<T extends { imageUrl: string | null }>(issues: T[]): Promise<T[]> {
  return Promise.all(
    issues.map(async (issue) => {
      if (!issue.imageUrl) return issue;
      const signedUrl = await objectStorageService.getSignedReadUrlFast(issue.imageUrl);
      return signedUrl ? { ...issue, imageUrl: signedUrl } : issue;
    })
  );
}

const PRIORITY_ORDER = sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`;

function buildIssueQuery() {
  return db
    .select({
      id: issuesTable.id,
      restaurantId: issuesTable.restaurantId,
      organizationId: issuesTable.organizationId,
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

  const principal = requireAuth(req, res);
  if (!principal) return;

  if (!(await principalCanAccessRestaurant(principal, restaurantId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const conditions: SQL<unknown>[] = [eq(issuesTable.restaurantId, restaurantId)];
  // Defence-in-depth: also constrain by the principal's org (super_admin bypasses).
  if (principal.organizationId != null) {
    conditions.push(eq(issuesTable.organizationId, principal.organizationId));
  }

  const { status } = query.data;
  if (status && status !== "all") {
    conditions.push(eq(issuesTable.status, status));
  }

  const issues = await buildIssueQuery()
    .where(and(...conditions))
    .orderBy(PRIORITY_ORDER, asc(issuesTable.createdAt));

  res.json(await signIssueImageUrls(issues));
});

// GET /api/issues (supervisor / admin / super_admin)
router.get("/issues", async (req, res) => {
  const principal = requireSupervisor(req, res);
  if (!principal) return;

  const query = ListIssuesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { restaurantId, status, category, priority, assignedTo, agingDays } = query.data;
  const conditions: SQL<unknown>[] = [];

  // Org scoping. super_admin (organizationId === null) sees everything.
  if (principal.organizationId != null) {
    conditions.push(eq(issuesTable.organizationId, principal.organizationId));
  }

  // Non-admin, non-super_admin supervisors are further constrained to their assignments.
  if (principal.role !== "admin" && principal.role !== "super_admin") {
    const assignments = await db
      .select({ restaurantId: supervisorRestaurantsTable.restaurantId })
      .from(supervisorRestaurantsTable)
      .where(eq(supervisorRestaurantsTable.supervisorId, principal.supervisorId));
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
  } else if (restaurantId !== undefined) {
    conditions.push(eq(issuesTable.restaurantId, restaurantId));
  }

  if (status && status !== "all") {
    conditions.push(eq(issuesTable.status, status));
    if (status === "resolved") {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      conditions.push(gte(issuesTable.resolvedAt, oneYearAgo));
    }
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

  res.json(await signIssueImageUrls(issues));
});

// POST /api/issues
router.post("/issues", async (req, res) => {
  const principal = requireAuth(req, res);
  if (!principal) return;

  const body = CreateIssueBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body", details: body.error.issues });
    return;
  }

  const { restaurantId, area, equipmentType, subItem, customLabel, description, assignedTo, imageUrl } = body.data;

  // Single access check handles device-own-restaurant, supervisor-assignment,
  // admin-same-org, and super_admin-bypass uniformly. Also rejects non-existent
  // restaurantId for everyone except super_admin (which we accept since the
  // target lookup below will 404 anyway).
  if (!(await principalCanAccessRestaurant(principal, restaurantId))) {
    res.status(403).json({ error: "Access denied" });
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

  // Derive the issue's organization from its target restaurant — single source
  // of truth, matches the Phase 1 backfill. Also validates the restaurant
  // exists (the FK would otherwise produce a 500 on insert).
  const [targetRestaurant] = await db
    .select({ organizationId: restaurantsTable.organizationId })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  if (!targetRestaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }

  const category = getCategoryForArea(area);

  const [issue] = await db
    .insert(issuesTable)
    .values({
      restaurantId,
      organizationId: targetRestaurant.organizationId,
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
  req.log.info({ issueId: issue.id, savedImageUrl: imageUrl ?? null }, "issue created");
  res.status(201).json(fullIssue);

  // Notify assigned supervisors AND same-org admins — non-blocking. Admins
  // are scoped to the issue's org so a second-org admin doesn't receive
  // notifications about another customer's issues.
  //
  // Each supervisor may have multiple devices (phone + tablet, etc.) — we
  // fan out to all of their device tokens. The Map<supervisorId, Set<token>>
  // structure dedupes both across the assigned/admin overlap (a supervisor
  // who is also an admin of their org) AND across rows returned by the
  // 1:many join.
  const log = req.log;
  const issueOrgId = targetRestaurant.organizationId;
  Promise.all([
    db
      .select({
        supervisorId: supervisorsTable.id,
        pushToken: supervisorDevicesTable.expoPushToken,
      })
      .from(supervisorsTable)
      .innerJoin(
        supervisorRestaurantsTable,
        and(
          eq(supervisorRestaurantsTable.supervisorId, supervisorsTable.id),
          eq(supervisorRestaurantsTable.restaurantId, restaurantId),
        ),
      )
      .innerJoin(
        supervisorDevicesTable,
        eq(supervisorDevicesTable.supervisorId, supervisorsTable.id),
      )
      .where(eq(supervisorsTable.isActive, true)),
    db
      .select({
        supervisorId: supervisorsTable.id,
        pushToken: supervisorDevicesTable.expoPushToken,
      })
      .from(supervisorsTable)
      .innerJoin(
        supervisorDevicesTable,
        eq(supervisorDevicesTable.supervisorId, supervisorsTable.id),
      )
      .where(
        and(
          eq(supervisorsTable.role, "admin"),
          eq(supervisorsTable.isActive, true),
          issueOrgId != null
            ? eq(supervisorsTable.organizationId, issueOrgId)
            : isNotNull(supervisorsTable.organizationId),
        ),
      ),
  ])
    .then(([assigned, admins]) => {
      // Dedupe (supervisorId, pushToken) pairs across both queries.
      const seen = new Set<string>();
      const recipients: { supervisorId: number; token: string }[] = [];
      for (const r of [...assigned, ...admins]) {
        const key = `${r.supervisorId}|${r.pushToken}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recipients.push({ supervisorId: r.supervisorId, token: r.pushToken });
      }
      return notifySupervisorsOfNewIssue({
        issueId: fullIssue.id,
        restaurantName: fullIssue.restaurantName ?? "Restaurant",
        equipmentType: fullIssue.equipmentType,
        subItem: fullIssue.subItem,
        description: fullIssue.description,
        recipients,
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

  const principal = requireAuth(req, res);
  if (!principal) return;

  const [issue] = await buildIssueQuery().where(eq(issuesTable.id, id));
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  if (!(await principalCanAccessIssue(principal, issue))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Replace raw object path with a short-lived signed read URL so the
  // mobile Image component can fetch from GCS directly without auth headers.
  let resolvedImageUrl = issue.imageUrl;
  if (issue.imageUrl) {
    const signedUrl = await objectStorageService.getSignedReadUrl(issue.imageUrl);
    if (signedUrl) {
      resolvedImageUrl = signedUrl;
    }
    req.log.info({ issueId: id, hasImage: true, signedUrlGenerated: !!signedUrl }, "issue fetched");
  } else {
    req.log.info({ issueId: id, hasImage: false }, "issue fetched");
  }

  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.issueId, id))
    .orderBy(asc(commentsTable.createdAt));

  res.json({ ...issue, imageUrl: resolvedImageUrl, comments });
});

// PATCH /api/issues/:id
router.patch("/issues/:id", async (req, res) => {
  const params = UpdateIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const id = params.data.id;

  const principal = requireAuth(req, res);
  if (!principal) return;

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

  if (!(await principalCanAccessIssue(principal, existing))) {
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
  // Priority is a supervisor-side concern; devices can't set it.
  if (priority !== undefined && principal.kind === "supervisor") {
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

// DELETE /api/issues/:id — supervisor only, resolved issues only
router.delete("/issues/:id", async (req, res) => {
  const params = GetIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const id = params.data.id;

  const principal = requireSupervisor(req, res);
  if (!principal) return;

  const [existing] = await db.select().from(issuesTable).where(eq(issuesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  if (!(await principalCanAccessIssue(principal, existing))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (existing.status !== "resolved") {
    res.status(400).json({ error: "Only resolved issues can be deleted" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.issueId, id));
  await db.delete(issuesTable).where(eq(issuesTable.id, id));

  res.json({ success: true });
});

// POST /api/issues/:id/comments
router.post("/issues/:id/comments", async (req, res) => {
  const params = AddCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }
  const issueId = params.data.id;

  const principal = requireAuth(req, res);
  if (!principal) return;

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

  if (!(await principalCanAccessIssue(principal, issue))) {
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

// DELETE /api/issues/:id/comments/:commentId — admin only, same-org only
router.delete("/issues/:id/comments/:commentId", async (req, res) => {
  const admin = requireOrgAdmin(req, res);
  if (!admin) return;

  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid issue or comment ID" });
    return;
  }
  const { id: issueId, commentId } = params.data;

  // Verify the parent issue is in the admin's org before deleting any comment.
  const [issue] = await db
    .select({ organizationId: issuesTable.organizationId })
    .from(issuesTable)
    .where(eq(issuesTable.id, issueId))
    .limit(1);
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  if (issue.organizationId !== admin.organizationId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

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
