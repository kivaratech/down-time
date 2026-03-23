import { Router, type IRouter } from "express";
import {
  db,
  issuesTable,
  commentsTable,
  restaurantsTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, gte, lte, isNull, ne } from "drizzle-orm";
import {
  extractToken,
  getRestaurantFromToken,
  getSupervisorFromToken,
} from "../lib/auth";
import { getCategoryForArea } from "../lib/equipment";

const router: IRouter = Router();

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
  const restaurantId = parseInt(req.params.id, 10);
  if (isNaN(restaurantId)) {
    res.status(400).json({ error: "Invalid restaurant ID" });
    return;
  }

  const statusFilter = req.query.status as string;
  const conditions = [eq(issuesTable.restaurantId, restaurantId)];

  if (!statusFilter || statusFilter === "all") {
    // all statuses
  } else {
    conditions.push(eq(issuesTable.status, statusFilter as any));
  }

  const issues = await buildIssueQuery()
    .where(and(...conditions))
    .orderBy(
      // priority: urgent first (null last), then oldest first
      sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`,
      asc(issuesTable.createdAt)
    );

  res.json(issues);
});

// GET /api/issues (supervisor)
router.get("/issues", async (req, res) => {
  const token = extractToken(req);
  const supervisor = await getSupervisorFromToken(token);
  if (!supervisor) {
    // Allow restaurant users to list their own issues via this endpoint too
    const restaurant = await getRestaurantFromToken(token);
    if (!restaurant) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    // Redirect to restaurant-scoped query
    const issues = await buildIssueQuery()
      .where(eq(issuesTable.restaurantId, restaurant.id))
      .orderBy(
        sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`,
        asc(issuesTable.createdAt)
      );
    res.json(issues);
    return;
  }

  const conditions: any[] = [];

  const { restaurantId, status, category, priority, assignedTo, agingDays } = req.query;

  if (restaurantId) {
    conditions.push(eq(issuesTable.restaurantId, parseInt(restaurantId as string, 10)));
  }
  if (status && status !== "all") {
    conditions.push(eq(issuesTable.status, status as any));
  }
  if (category) {
    conditions.push(eq(issuesTable.category, category as any));
  }
  if (priority) {
    conditions.push(eq(issuesTable.priority, priority as any));
  }
  if (assignedTo) {
    conditions.push(eq(issuesTable.assignedTo, assignedTo as string));
  }
  if (agingDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(agingDays as string, 10));
    conditions.push(lte(issuesTable.createdAt, cutoff));
  }

  const query = buildIssueQuery();
  const issues = conditions.length > 0
    ? await query
        .where(and(...conditions))
        .orderBy(
          sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`,
          asc(issuesTable.createdAt)
        )
    : await query.orderBy(
        sql`CASE WHEN ${issuesTable.priority} = 'urgent' THEN 0 WHEN ${issuesTable.priority} = 'high' THEN 1 WHEN ${issuesTable.priority} = 'normal' THEN 2 ELSE 3 END`,
        asc(issuesTable.createdAt)
      );

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

  const { restaurantId, area, equipmentType, subItem, customLabel, description, assignedTo } = req.body;

  if (!restaurantId || !area || !equipmentType || !description) {
    res.status(400).json({ error: "restaurantId, area, equipmentType, and description are required" });
    return;
  }

  const category = getCategoryForArea(area);

  const [issue] = await db
    .insert(issuesTable)
    .values({
      restaurantId: parseInt(restaurantId, 10),
      area,
      category,
      equipmentType,
      subItem: subItem ?? null,
      customLabel: customLabel ?? null,
      description,
      status: "open",
      assignedTo: assignedTo ?? null,
    })
    .returning();

  // Fetch with restaurant name
  const [fullIssue] = await buildIssueQuery().where(eq(issuesTable.id, issue.id));
  res.status(201).json(fullIssue);
});

// GET /api/issues/:id
router.get("/issues/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }

  const [issue] = await buildIssueQuery().where(eq(issuesTable.id, id));
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
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
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { status, assignedTo, priority, description } = req.body;

  // Only supervisors can set priority
  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (status !== undefined) {
    updates.status = status;
    if (status === "resolved") {
      updates.resolvedAt = new Date();
    } else {
      updates.resolvedAt = null;
    }
  }
  if (assignedTo !== undefined) updates.assignedTo = assignedTo || null;
  if (description !== undefined) updates.description = description;
  if (priority !== undefined && supervisor) {
    updates.priority = priority || null;
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
  const issueId = parseInt(req.params.id, 10);
  if (isNaN(issueId)) {
    res.status(400).json({ error: "Invalid issue ID" });
    return;
  }

  const token = extractToken(req);
  const restaurant = await getRestaurantFromToken(token);
  const supervisor = !restaurant ? await getSupervisorFromToken(token) : null;

  if (!restaurant && !supervisor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { authorName, body } = req.body;
  if (!authorName || !body) {
    res.status(400).json({ error: "authorName and body are required" });
    return;
  }

  const [issue] = await db.select().from(issuesTable).where(eq(issuesTable.id, issueId)).limit(1);
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ issueId, authorName, body })
    .returning();

  res.status(201).json(comment);
});

export default router;
