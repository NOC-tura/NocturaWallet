import {clockText, cooldownLabel} from '../strings';
import type {Timers} from '../page';

/**
 * #9's cooldown card (and #10's): the engine's wrong-password wait (≤ 30 s, page memory, D11), counted
 * down once a second — "0:12", the design's helper line, and the ring's remaining share (`--vlt-ring`,
 * read by unlock.css's conic gradient). Returns a stop function; the caller stops it when the wait ends.
 */
export function startCooldown(timers: Timers, ms: number, parts: {timer: HTMLElement; label: HTMLElement; ring: HTMLElement}): () => void {
  const until = timers.now() + ms;
  const paint = () => {
    const left = Math.max(0, until - timers.now());
    const seconds = Math.ceil(left / 1000);
    parts.timer.textContent = clockText(seconds);
    parts.label.textContent = cooldownLabel(seconds);
    parts.ring.style.setProperty('--vlt-ring', String(ms === 0 ? 0 : left / ms));
  };
  paint();
  const id = timers.setInterval(paint, 1_000);
  return () => timers.clearInterval(id);
}
