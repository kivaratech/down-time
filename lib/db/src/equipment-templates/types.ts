import type { InsertEquipmentItem } from "../schema/equipment";

// Template items omit `organizationId` (and `id`) — they're injected at insert
// time when a template is applied to a specific organization, whether by the
// dev seed or the super-admin create-org flow.
export type EquipmentTemplateItem = Omit<InsertEquipmentItem, "id" | "organizationId">;

export type EquipmentTemplate = {
  /** Stable key used in API requests (e.g. "mcdonalds", "generic"). */
  key: string;
  /** Human label shown in the super-admin org-creation picker. */
  label: string;
  /** One-line description shown next to the label in the picker. */
  description: string;
  items: EquipmentTemplateItem[];
};
