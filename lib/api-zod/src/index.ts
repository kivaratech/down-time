// NOTE: orval re-adds `export * from "./generated/types"` here on every
// codegen. Strip it back out — generated/api already re-exports the TS types
// inferred from the Zod schemas; double-exporting causes TS2308 ambiguity.
// See commit cf2bef3 for the prior fix.
export * from "./generated/api";
