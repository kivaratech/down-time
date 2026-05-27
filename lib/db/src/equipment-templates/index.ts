import { mcdonaldsTemplate } from "./mcdonalds";
import { genericTemplate } from "./generic";
import type { EquipmentTemplate } from "./types";

export * from "./types";
export { mcdonaldsTemplate, genericTemplate };

/**
 * Registry of all built-in equipment templates. The super-admin org-creation
 * endpoint validates the request's `templateKey` against this map; the dev
 * seed imports `EQUIPMENT_TEMPLATES.mcdonalds` directly.
 *
 * To add a new template: create a new file alongside this one, export an
 * `EquipmentTemplate`, and register it here. No DB schema or API changes
 * required.
 */
export const EQUIPMENT_TEMPLATES = {
  generic: genericTemplate,
  mcdonalds: mcdonaldsTemplate,
} as const satisfies Record<string, EquipmentTemplate>;

export type EquipmentTemplateKey = keyof typeof EQUIPMENT_TEMPLATES;

/** Default template applied when super-admin omits `templateKey`. */
export const DEFAULT_EQUIPMENT_TEMPLATE_KEY: EquipmentTemplateKey = "generic";
