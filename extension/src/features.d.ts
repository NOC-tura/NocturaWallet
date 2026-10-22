/**
 * B1d §1.1: whether this build carries presale — substituted by Vite's `define` in both configs (vite.config.ts,
 * vite.content.config.ts) from the one build input (scripts/presaleFlag.mjs). For inline branches that need no
 * module; it never guards an import (the presaleSwitch plugin removes modules).
 */
declare const __NOCTURA_PRESALE__: boolean;
