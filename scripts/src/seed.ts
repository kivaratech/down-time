import { db } from "@workspace/db";
import {
  commentsTable,
  equipmentItemsTable,
  issuesTable,
  restaurantSessionsTable,
  restaurantsTable,
  supervisorSessionsTable,
  supervisorsTable,
} from "@workspace/db/schema";

import crypto from "crypto";

type InsertIssueWithTimestamps = Omit<typeof issuesTable.$inferInsert, "id">;
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
  { name: "Zeeb", location: "Zeeb Rd", username: "zeeb", password: "zeeb2025" },
  { name: "Baker", location: "Baker Rd", username: "baker", password: "baker2025" },
  { name: "Leslie", location: "Leslie Ave", username: "leslie", password: "leslie2025" },
  { name: "Stockbridge", location: "Stockbridge Rd", username: "stockbridge", password: "stockbridge2025" },
];

const SUPERVISORS = [
  { username: "admin", password: "admin123", name: "Alex Johnson" },
  { username: "supervisor", password: "pass123", name: "Maria Garcia" },
];

const EQUIPMENT_SEEDS = [
  { area: "Front Counter", name: "French Fry Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"], supportsCustomLabel: false, sortOrder: 0 },
  { area: "Front Counter", name: "Blended Ice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
  { area: "Front Counter", name: "Shake Machine", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
  { area: "Front Counter", name: "Frozen Carbonated Beverage Machine", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
  { area: "Front Counter", name: "Orange Juice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
  { area: "Front Counter", name: "Coffee Maker", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
  { area: "Front Counter", name: "Creamer Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 6 },
  { area: "Front Counter", name: "Sugar Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 7 },
  { area: "Front Counter", name: "Heated Landing Zone", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
  { area: "Front Counter", name: "Fry Warmer", subItems: [], supportsCustomLabel: false, sortOrder: 9 },
  { area: "Front Counter", name: "Fry Hopper", subItems: [], supportsCustomLabel: false, sortOrder: 10 },
  { area: "Front Counter", name: "Refrigerator", subItems: [], supportsCustomLabel: true, sortOrder: 11 },
  { area: "Front Counter", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 12 },
  { area: "Grill", name: "Grill", subItems: ["Platen 1", "Platen 2", "Platen 3", "Platen 4"], supportsCustomLabel: false, sortOrder: 0 },
  { area: "Grill", name: "Prep Table", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
  { area: "Grill", name: "Fish Steamer", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
  { area: "Grill", name: "Bun Toaster", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
  { area: "Grill", name: "Muffin Toaster", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
  { area: "Grill", name: "Q-ing Ovens", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
  { area: "Grill", name: "Convection Oven", subItems: [], supportsCustomLabel: false, sortOrder: 6 },
  { area: "Grill", name: "Refrigerator", subItems: [], supportsCustomLabel: true, sortOrder: 7 },
  { area: "Grill", name: "Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
  { area: "Grill", name: "Reach In Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 9 },
  { area: "Grill", name: "Moffat Cabinet", subItems: [], supportsCustomLabel: false, sortOrder: 10 },
  { area: "Grill", name: "Meat Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"], supportsCustomLabel: false, sortOrder: 11 },
  { area: "Grill", name: "UHC", subItems: ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6"], supportsCustomLabel: false, sortOrder: 12 },
  { area: "Grill", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 13 },
  { area: "Back of House", name: "Dishwasher", subItems: [], supportsCustomLabel: false, sortOrder: 0 },
  { area: "Back of House", name: "3 Compartment Sink", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
  { area: "Back of House", name: "Walk In Cooler", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
  { area: "Back of House", name: "Walk In Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
  { area: "Back of House", name: "Carbonated Beverage / Multiplex Equipment", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
  { area: "Back of House", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
  { area: "Technology", name: "Register", subItems: [], supportsCustomLabel: false, sortOrder: 0 },
  { area: "Technology", name: "Grill Printer", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
  { area: "Technology", name: "Receipt Printer", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
  { area: "Technology", name: "KVS Controller", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
  { area: "Technology", name: "Monitor", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
  { area: "Technology", name: "eProduction", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
  { area: "Technology", name: "Office Printer", subItems: [], supportsCustomLabel: false, sortOrder: 6 },
  { area: "Technology", name: "RHS Server", subItems: [], supportsCustomLabel: false, sortOrder: 7 },
  { area: "Technology", name: "BOS Server", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
  { area: "Technology", name: "Kiosk", subItems: [], supportsCustomLabel: false, sortOrder: 9 },
  { area: "Technology", name: "Card Reader", subItems: [], supportsCustomLabel: false, sortOrder: 10 },
  { area: "Technology", name: "Digital Menu Board", subItems: [], supportsCustomLabel: false, sortOrder: 11 },
  { area: "Technology", name: "Security Camera", subItems: [], supportsCustomLabel: false, sortOrder: 12 },
  { area: "Technology", name: "Shelf Life Tablet", subItems: [], supportsCustomLabel: false, sortOrder: 13 },
  { area: "Technology", name: "Food Safety Tablet", subItems: [], supportsCustomLabel: false, sortOrder: 14 },
  { area: "Technology", name: "Cash Drawer", subItems: [], supportsCustomLabel: false, sortOrder: 15 },
  { area: "Technology", name: "Bump Bar", subItems: [], supportsCustomLabel: false, sortOrder: 16 },
  { area: "Technology", name: "Software", subItems: [], supportsCustomLabel: false, sortOrder: 17 },
  { area: "Technology", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 18 },
];

async function seed() {
  console.log("🌱 Seeding database...");

  await db.delete(supervisorSessionsTable);
  await db.delete(restaurantSessionsTable);
  await db.delete(commentsTable);
  await db.delete(issuesTable);
  await db.delete(supervisorsTable);
  await db.delete(restaurantsTable);
  await db.delete(equipmentItemsTable);

  const restaurants = await db
    .insert(restaurantsTable)
    .values(
      RESTAURANTS.map((r) => ({
        name: r.name,
        location: r.location,
        username: r.username,
        passwordHash: hashPassword(r.password),
      }))
    )
    .returning();
  console.log(`✅ Created ${restaurants.length} restaurants`);

  const supervisors = await db
    .insert(supervisorsTable)
    .values(
      SUPERVISORS.map((s) => ({
        username: s.username,
        passwordHash: hashPassword(s.password),
        name: s.name,
      }))
    )
    .returning();
  console.log(`✅ Created ${supervisors.length} supervisors`);

  await db.insert(equipmentItemsTable).values(EQUIPMENT_SEEDS);
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
      priority: "high" as const,
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
      priority: "high" as const,
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
    .values(issueSeeds)
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
  console.log("Supervisor: admin / admin123");
  console.log("Supervisor: supervisor / pass123");
  console.log("Restaurant accounts:");
  RESTAURANTS.forEach((r) => console.log(`  ${r.name}: ${r.username} / ${r.password}`));
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
