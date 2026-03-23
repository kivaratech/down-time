export type EquipmentItem = {
  name: string;
  subItems?: string[];
  supportsCustomLabel?: boolean;
};

export type EquipmentArea = {
  area: "Front Counter" | "Grill" | "Back of House" | "Technology";
  category: "equipment" | "technology";
  items: EquipmentItem[];
};

export const EQUIPMENT_CATALOG: EquipmentArea[] = [
  {
    area: "Front Counter",
    category: "equipment",
    items: [
      { name: "French Fry Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"] },
      { name: "Blended Ice Machine" },
      { name: "Shake Machine" },
      { name: "Frozen Carbonated Beverage Machine" },
      { name: "Orange Juice Machine" },
      { name: "Coffee Maker" },
      { name: "Creamer Dispenser" },
      { name: "Sugar Dispenser" },
      { name: "Heated Landing Zone" },
      { name: "Fry Warmer" },
      { name: "Fry Hopper" },
      { name: "Refrigerator", supportsCustomLabel: true },
      { name: "Other" },
    ],
  },
  {
    area: "Grill",
    category: "equipment",
    items: [
      { name: "Grill", subItems: ["Platen 1", "Platen 2", "Platen 3", "Platen 4"] },
      { name: "Prep Table" },
      { name: "Fish Steamer" },
      { name: "Bun Toaster" },
      { name: "Muffin Toaster" },
      { name: "Q-ing Ovens" },
      { name: "Convection Oven" },
      { name: "Refrigerator", supportsCustomLabel: true },
      { name: "Freezer" },
      { name: "Reach In Freezer" },
      { name: "Moffat Cabinet" },
      { name: "Meat Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"] },
      { name: "UHC", subItems: ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6"] },
      { name: "Other" },
    ],
  },
  {
    area: "Back of House",
    category: "equipment",
    items: [
      { name: "Dishwasher" },
      { name: "3 Compartment Sink" },
      { name: "Walk In Cooler" },
      { name: "Walk In Freezer" },
      { name: "Carbonated Beverage / Multiplex Equipment" },
      { name: "Other" },
    ],
  },
  {
    area: "Technology",
    category: "technology",
    items: [
      { name: "Register" },
      { name: "Grill Printer" },
      { name: "Receipt Printer" },
      { name: "KVS Controller" },
      { name: "Monitor" },
      { name: "eProduction" },
      { name: "Office Printer" },
      { name: "RHS Server" },
      { name: "BOS Server" },
      { name: "Kiosk" },
      { name: "Card Reader" },
      { name: "Digital Menu Board" },
      { name: "Security Camera" },
      { name: "Shelf Life Tablet" },
      { name: "Food Safety Tablet" },
      { name: "Cash Drawer" },
      { name: "Bump Bar" },
      { name: "Software" },
      { name: "Other" },
    ],
  },
];

export function getCategoryForArea(area: string): "equipment" | "technology" {
  const areaData = EQUIPMENT_CATALOG.find((a) => a.area === area);
  return areaData?.category ?? "equipment";
}
