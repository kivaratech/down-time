import type { EquipmentTemplate } from "./types";

// Generic restaurant equipment baseline. No chain-specific terminology — names
// chosen to be recognizable across quick-service formats. Technology area is
// intentionally empty: tech stacks vary enough between chains that a seeded
// list would mostly be noise. Org admins add tech items per their setup.
export const genericTemplate: EquipmentTemplate = {
  key: "generic",
  label: "Generic Restaurant",
  description:
    "Universal restaurant equipment baseline. No Technology items — org admin adds those per their setup.",
  items: [
    // Front Counter (12)
    { area: "Front Counter", name: "Fryer", subItems: ["Vat 1", "Vat 2", "Vat 3", "Vat 4"], supportsCustomLabel: false, sortOrder: 0 },
    { area: "Front Counter", name: "Ice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
    { area: "Front Counter", name: "Shake Machine", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
    { area: "Front Counter", name: "Frozen Beverage Machine", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
    { area: "Front Counter", name: "Juice Machine", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
    { area: "Front Counter", name: "Coffee Maker", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
    { area: "Front Counter", name: "Creamer Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 6 },
    { area: "Front Counter", name: "Sugar Dispenser", subItems: [], supportsCustomLabel: false, sortOrder: 7 },
    { area: "Front Counter", name: "Hot Holding Counter", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
    { area: "Front Counter", name: "Refrigerator", subItems: [], supportsCustomLabel: true, sortOrder: 9 },
    { area: "Front Counter", name: "Freezer", subItems: [], supportsCustomLabel: true, sortOrder: 10 },
    { area: "Front Counter", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 11 },

    // Grill (11)
    { area: "Grill", name: "Grill", subItems: [], supportsCustomLabel: false, sortOrder: 0 },
    { area: "Grill", name: "Flat Top", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
    { area: "Grill", name: "Prep Table", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
    { area: "Grill", name: "Bun Toaster", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
    { area: "Grill", name: "Convection Oven", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
    { area: "Grill", name: "Microwave", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
    { area: "Grill", name: "Refrigerator", subItems: [], supportsCustomLabel: true, sortOrder: 6 },
    { area: "Grill", name: "Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 7 },
    { area: "Grill", name: "Reach In Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 8 },
    { area: "Grill", name: "Holding Cabinet", subItems: ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5", "Slot 6"], supportsCustomLabel: false, sortOrder: 9 },
    { area: "Grill", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 10 },

    // Back of House (7)
    { area: "Back of House", name: "Dishwasher", subItems: [], supportsCustomLabel: false, sortOrder: 0 },
    { area: "Back of House", name: "3 Compartment Sink", subItems: [], supportsCustomLabel: false, sortOrder: 1 },
    { area: "Back of House", name: "Hand Sink", subItems: [], supportsCustomLabel: false, sortOrder: 2 },
    { area: "Back of House", name: "Walk In Cooler", subItems: [], supportsCustomLabel: false, sortOrder: 3 },
    { area: "Back of House", name: "Walk In Freezer", subItems: [], supportsCustomLabel: false, sortOrder: 4 },
    { area: "Back of House", name: "Beverage System", subItems: [], supportsCustomLabel: false, sortOrder: 5 },
    { area: "Back of House", name: "Other", subItems: [], supportsCustomLabel: false, sortOrder: 6 },

    // Technology: intentionally empty.
  ],
};
