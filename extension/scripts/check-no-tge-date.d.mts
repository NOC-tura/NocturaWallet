// Types for scripts/check-no-tge-date.mjs, read by e2e/storeScreenshots.spec.ts (TypeScript).
export function forbiddenForms(): string[];
export function dateViolations(files: {path: string; text: string}[], forms?: string[]): string[];
export function listScanned(root: string): string[];
