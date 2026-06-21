import { db } from "@workspace/db";
import {
  commentsTable,
  deviceSessionsTable,
  equipmentItemsTable,
  issuesTable,
  organizationsTable,
  pairingCodesTable,
  restaurantSessionsTable,
  restaurantsTable,
  supervisorSessionsTable,
  supervisorsTable,
} from "@workspace/db/schema";
import { mcdonaldsTemplate } from "@workspace/db/equipment-templates";

import crypto from "crypto";

// organizationId is injected via the .map at insert time, so the seed array
// itself doesn't need to carry it (and shouldn't have to repeat it 12 times).
type InsertIssueWithTimestamps = Omit<typeof issuesTable.$inferInsert, "id" | "organizationId">;
type InsertComment = typeof commentsTable.$inferInsert;

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
  return `${salt}:${hash}`;
}

const RESTAURANTS = [
  { name: "Zeeb", location: "Zeeb Rd" },
  { name: "Baker", location: "Baker Rd" },
  { name: "Leslie", location: "Leslie Ave" },
  { name: "Stockbridge", location: "Stockbridge Rd" },
];

const SUPERVISORS = [
  { email: "admin@downtime.local", password: "admin123", name: "Alex Johnson", role: "admin" as const },
  { email: "supervisor@downtime.local", password: "pass123", name: "Maria Garcia", role: "supervisor" as const },
];

const SUPER_ADMIN = { email: "superadmin@downtime.local", password: "super123", name: "Platform Super Admin" };

// Dev seed uses the McDonald's template so DownTime org's catalog continues to
// match its existing customer profile. The Phase 3 super-admin create-org flow
// will let you pick any template from @workspace/db/equipment-templates.
const EQUIPMENT_SEEDS = mcdonaldsTemplate.items;

async function seed() {
  console.log("🌱 Seeding database...");

  await db.delete(supervisorSessionsTable);
  await db.delete(deviceSessionsTable);
  // Legacy table whose restaurant_id FK has no ON DELETE CASCADE — without
  // this wipe a re-seed against a DB with any restaurant_sessions row would
  // FK-violate on the restaurants delete below.
  await db.delete(restaurantSessionsTable);
  await db.delete(pairingCodesTable);
  await db.delete(commentsTable);
  await db.delete(issuesTable);
  await db.delete(supervisorsTable);
  await db.delete(restaurantsTable);
  await db.delete(equipmentItemsTable);
  await db.delete(organizationsTable);

  const [organization] = await db
    .insert(organizationsTable)
    .values({ name: "DownTime" })
    .returning();
  const orgId = organization.id;
  console.log(`✅ Created default organization "DownTime" (id=${orgId})`);

  const restaurants = await db
    .insert(restaurantsTable)
    .values(
      RESTAURANTS.map((r) => ({
        organizationId: orgId,
        name: r.name,
        location: r.location,
      }))
    )
    .returning();
  console.log(`✅ Created ${restaurants.length} restaurants`);

  const supervisors = await db
    .insert(supervisorsTable)
    .values(
      SUPERVISORS.map((s) => ({
        organizationId: orgId,
        email: s.email,
        passwordHash: hashPassword(s.password),
        name: s.name,
        role: s.role,
      }))
    )
    .returning();
  console.log(`✅ Created ${supervisors.length} supervisors`);

  await db.insert(supervisorsTable).values({
    organizationId: null,
    email: SUPER_ADMIN.email,
    passwordHash: hashPassword(SUPER_ADMIN.password),
    name: SUPER_ADMIN.name,
    role: "super_admin",
  });
  console.log("✅ Created platform super_admin");

  await db.insert(equipmentItemsTable).values(EQUIPMENT_SEEDS.map((e) => ({ ...e, organizationId: orgId })));
  console.log(`✅ Created ${EQUIPMENT_SEEDS.length} equipment items`);

  const now = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  const issueSeeds: InsertIssueWithTimestamps[] = [
    {
      restaurantId: restaurants[0].id,
      area: "Front Counter" as const,
      category: "equipment" as const,
      equipmentType: "French Fry Fryer",
      subItem: "Vat 2",
      description: "Temperature not holding. Fryer cycling off early.",
      status: "open" as const,
      priority: "urgent" as const,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      restaurantId: restaurants[0].id,
      area: "Grill" as const,
      category: "equipment" as const,
      equipmentType: "UHC",
      subItem: "Slot 3",
      description: "Heating element not working. Slot running cold.",
      status: "in_progress" as const,
      assignedTo: "Tech Team",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1),
    },
    {
      restaurantId: restaurants[0].id,
      area: "Technology" as const,
      category: "technology" as const,
      equipmentType: "Register",
      description: "Register 2 freezing intermittently. Requires reboot every 2-3 hours.",
      status: "open" as const,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
    },
    {
      restaurantId: restaurants[1].id,
      area: "Back of House" as const,
      category: "equipment" as const,
      equipmentType: "Walk In Cooler",
      description: "Door seal damaged. Temperature slowly climbing. At 42°F.",
      status: "open" as const,
      priority: "urgent" as const,
      assignedTo: "Facilities",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      restaurantId: restaurants[1].id,
      area: "Front Counter" as const,
      category: "equipment" as const,
      equipmentType: "Shake Machine",
      description: "Unit making loud grinding noise when mixing. Producing output but concerning.",
      status: "waiting" as const,
      assignedTo: "Equipment Vendor",
      createdAt: daysAgo(4),
      updatedAt: daysAgo(2),
    },
    {
      restaurantId: restaurants[1].id,
      area: "Technology" as const,
      category: "technology" as const,
      equipmentType: "Digital Menu Board",
      description: "Board 3 has dead pixels in upper left quadrant. Content still readable.",
      status: "open" as const,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      restaurantId: restaurants[2].id,
      area: "Grill" as const,
      category: "equipment" as const,
      equipmentType: "Grill",
      subItem: "Platen 1",
      description: "Platen not closing properly. Gap at front edge. Possible hinge issue.",
      status: "open" as const,
      priority: "urgent" as const,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      restaurantId: restaurants[2].id,
      area: "Technology" as const,
      category: "technology" as const,
      equipmentType: "Kiosk",
      description: "Kiosk #2 touchscreen unresponsive in bottom third of screen.",
      status: "in_progress" as const,
      assignedTo: "IT Support",
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1),
    },
    {
      restaurantId: restaurants[2].id,
      area: "Front Counter" as const,
      category: "equipment" as const,
      equipmentType: "Coffee Maker",
      description: "Machine not completing full brew cycle. Drip stops at ~60%.",
      status: "resolved" as const,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(3),
      resolvedAt: daysAgo(3),
    },
    {
      restaurantId: restaurants[3].id,
      area: "Front Counter" as const,
      category: "equipment" as const,
      equipmentType: "Frozen Carbonated Beverage Machine",
      description: "Not freezing correctly. Product too liquid. Possible refrigerant issue.",
      status: "open" as const,
      priority: "urgent" as const,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
    },
    {
      restaurantId: restaurants[3].id,
      area: "Technology" as const,
      category: "technology" as const,
      equipmentType: "BOS Server",
      description: "Server running slow. Reports taking 3-4 minutes to generate.",
      status: "open" as const,
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
    },
    {
      restaurantId: restaurants[3].id,
      area: "Back of House" as const,
      category: "equipment" as const,
      equipmentType: "Dishwasher",
      description: "Rinse cycle not completing. Dishes coming out with soap residue.",
      status: "waiting" as const,
      assignedTo: "Facilities",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(2),
    },
  ];

  const issues = await db
    .insert(issuesTable)
    .values(issueSeeds.map((s) => ({ ...s, organizationId: orgId })))
    .returning();
  console.log(`✅ Created ${issues.length} issues`);

  const commentSeeds: InsertComment[] = [
    {
      issueId: issues[1].id,
      authorName: "Maria G.",
      body: "Tech team notified. Parts ordered. ETA 2-3 business days.",
      createdAt: daysAgo(4),
    },
    {
      issueId: issues[1].id,
      authorName: "Alex J.",
      body: "Confirmed parts are on order. Using adjacent slots in the meantime.",
      createdAt: daysAgo(1),
    },
    {
      issueId: issues[3].id,
      authorName: "Mike L.",
      body: "Facilities called. Sending tech tomorrow morning.",
      createdAt: daysAgo(1),
    },
    {
      issueId: issues[7].id,
      authorName: "Sam R.",
      body: "IT is remoting in to diagnose. May need on-site visit.",
      createdAt: daysAgo(1),
    },
    {
      issueId: issues[8].id,
      authorName: "Carlos M.",
      body: "Descaled machine and replaced filter. Issue resolved.",
      createdAt: daysAgo(3),
    },
  ];

  await db.insert(commentsTable).values(commentSeeds);
  console.log(`✅ Created ${commentSeeds.length} comments`);

  console.log("✅ Seed complete!");
  console.log("\nTest accounts:");
  console.log("Super Admin: superadmin@downtime.local / super123  (role: super_admin, no org)");
  console.log("Admin:       admin@downtime.local / admin123  (role: admin)");
  console.log("Supervisor:  supervisor@downtime.local / pass123  (role: supervisor)");
  console.log("\nRestaurants (pair via admin pairing code):");
  RESTAURANTS.forEach((r) => console.log(`  ${r.name} — ${r.location}`));
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
