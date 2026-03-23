import { db } from "@workspace/db";
import {
  commentsTable,
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
  { name: "Maple Street", location: "Maple St & 5th Ave", pin: "1234" },
  { name: "Downtown West", location: "100 Main St", pin: "5678" },
  { name: "Airport Rd", location: "2200 Airport Road", pin: "4321" },
  { name: "Riverside", location: "300 River Blvd", pin: "9876" },
];

const SUPERVISORS = [
  { username: "admin", password: "admin123", name: "Alex Johnson" },
  { username: "supervisor", password: "pass123", name: "Maria Garcia" },
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.delete(supervisorSessionsTable);
  await db.delete(restaurantSessionsTable);
  await db.delete(commentsTable);
  await db.delete(issuesTable);
  await db.delete(supervisorsTable);
  await db.delete(restaurantsTable);

  // Insert restaurants
  const restaurants = await db
    .insert(restaurantsTable)
    .values(RESTAURANTS)
    .returning();
  console.log(`✅ Created ${restaurants.length} restaurants`);

  // Insert supervisors
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

  // Seed issues across restaurants
  const now = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  const issueSeeds: InsertIssueWithTimestamps[] = [
    // Maple Street
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
    // Downtown West
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
    // Airport Rd
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
    // Riverside
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

  // Seed some comments
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
  console.log("Restaurant PINs: 1234 (Maple St), 5678 (Downtown West), 4321 (Airport Rd), 9876 (Riverside)");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
