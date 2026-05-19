/**
 * UI primitives barrel — single import path for DS-aligned components.
 *
 * Usage:
 *   import {Text, Button, Card} from '@/components/ui';
 *
 * Primitives match DS v0.2 + v0.2.1 (see tailwind.config.js + src/global.css).
 * Each primitive consumes NativeWind utility classes + the cn() merge helper.
 *
 * As Phase B per-screen migration progresses, new primitives land here:
 *   - Input (text / numeric / search)         — Phase B Screen #1-2 use
 *   - Sheet (bottom)                          — Phase B Screen #18 / #43 use
 *   - Chip (filter / selection)               — Phase B Screen #20 / #26 use
 *   - Toggle / Radio / Checkbox               — Phase B Screen #31 / #45 use
 *   - Skeleton (line / circle / tile)         — Phase B Screen #11 cold-mount
 *   - Banner (info / warning / danger)        — Phase B Screen #11 / #33 use
 *   - StickyBottomBar (column / row)          — Phase B Screen #12 / #20 use
 */
export {Text} from './Text';
export type {TextVariant} from './Text';

export {Button} from './Button';
export type {ButtonVariant} from './Button';

export {Card} from './Card';
export type {CardSurface} from './Card';
