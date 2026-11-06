// Types for scripts/png.mjs, read by e2e/storeScreenshots.spec.ts (TypeScript).
export const STORE_SHOT: Readonly<{width: 1280; height: 800; bitDepth: 8; colourType: 2}>;
export function pngHeader(bytes: Uint8Array): {width: number; height: number; bitDepth: number; colourType: number; chunks: string[]};
export function storeShotProblems(bytes: Uint8Array): string[];
