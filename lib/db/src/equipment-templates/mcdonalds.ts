import type { EquipmentTemplate } from "./types";

// McDonald's franchise equipment catalog. Mirrors the original inline
// EQUIPMENT_SEEDS list with one addition: McCafe Machine on Front Counter.
// Keeps McD-specific items (UHC, Q-ing Ovens, Moffat Cabinet, eProduction,
// RHS/BOS Servers, Shelf Life / Food Safety Tablets) intact.
export const mcdonaldsTemplate: EquipmentTemplate = {
  key: "mcdonalds",
  label: "McDonald's",
  description:
    "Catalog for McDonald's franchise restaurants. Includes UHC, McCafe Machine, RHS/BOS servers, and other chain-specific equipment.",
  items: [
    // Front Counter (14)
    { area: "Front Counter", name: "French Fry Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"], supportsCustomLabel: false, sortOrder: 0 },
    { area: "Front Counter", name: "Blended Ice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
    { area: "Front Counter", name: "Shake Machine", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
    { area: "Front Counter", name: "Frozen Carbonated Beverage Machine", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
    { area: "Front Counter", name: "Orange Juice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
    { area: "Front Counter", name: "Coffee Maker", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
    { area: "Front Counter", name: "McCafe Machine", subItems: [], supportsCustomLabel: false, sortOrder: 6 },
    { area: "Front Counter", name: "Creamer Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 7 },
    { area: "Front Counter", name: "Sugar Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
    { area: "Front Counter", name: "Heated Landing Zone", subItems: [], supportsCustomLabel: false, sortOrder: 9 },
    { area: "Front Counter", name: "Fry Warmer", subItems: [], supportsCustomLabel: false, sortOrder: 10 },
    { area: "Front Counter", name: "Fry Hopper", subItems: [], supportsCustomLabel: false, sortOrder: 11 },
    { area: "Front Counter", name: "Refrigerator", subItems: [], supportsCustomLabel: true, sortOrder: 12 },
    { area: "Front Counter", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 13 },

    // Grill (14)
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

    // Back of House (6)
    { area: "Back of House", name: "Dishwasher", subItems: [], supportsCustomLabel: false, sortOrder: 0 },
    { area: "Back of House", name: "3 Compartment Sink", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
    { area: "Back of House", name: "Walk In Cooler", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
    { area: "Back of House", name: "Walk In Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
    { area: "Back of House", name: "Carbonated Beverage / Multiplex Equipment", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
    { area: "Back of House", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 5 },

    // Technology (19)
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
  ],
};
