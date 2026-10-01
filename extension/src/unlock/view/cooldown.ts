import {COOLDOWN_LABEL, clockText} from '../strings';
import {h} from './dom';
import type {Timers} from '../page';

/**
 * The ring's remaining share as the `--vlt-ring` value: always a number from 0 to 1 (Math.min and Math.max
 * return a number whatever they are given), so the one custom-property write the vault page makes can carry
 * nothing but digits. The vault-isolation gate allows a `--vlt-` property only with a value formatted from a
 * number like this (controller ruling, 2026-10-01).
 */
function ringShare(share: number): string {
  return String(Math.min(1, Math.max(0, share)));
}

/**
 * #9's cooldown card (and #10's): the engine's wrong-password wait (≤ 30 s, page memory, D11), counted
 * down once a second — "0:12", the design's helper line, and the ring's remaining share (`--vlt-ring`,
 * read by unlock.css's conic gradient). Returns a stop function; the caller stops it when the wait ends.
 * The helper line is built once from text nodes and two `.noc-numeral` spans (the design's annotation B: the
 * minute and second integers are numerals); each tick sets only the spans' text — never markup.
 */
export function startCooldown(timers: Timers, ms: number, parts: {timer: HTMLElement; label: HTMLElement; ring: HTMLElement}): () => void {
  const until = timers.now() + ms;
  const minutes = h('span', 'noc-numeral');
  const seconds = h('span', 'noc-numeral');
  parts.label.replaceChildren(
    document.createTextNode(COOLDOWN_LABEL.head),
    minutes,
    document.createTextNode(COOLDOWN_LABEL.minutes),
    seconds,
    document.createTextNode(COOLDOWN_LABEL.tail),
  );
  const paint = () => {
    const left = Math.max(0, until - timers.now());
    const secs = Math.ceil(left / 1000);
    parts.timer.textContent = clockText(secs);
    minutes.textContent = String(Math.floor(secs / 60));
    seconds.textContent = String(secs % 60);
    parts.ring.style.setProperty('--vlt-ring', ringShare(ms === 0 ? 0 : left / ms));
  };
  paint();
  const id = timers.setInterval(paint, 1_000);
  return () => timers.clearInterval(id);
}
