/**
 * Has the person done anything on this page yet?
 *
 * This exists to answer one question precisely, because the answer decides whether the
 * page may connect to a wallet on its own.
 *
 * `autoConnect={false}` was chosen for a real reason: a page that connects the moment it
 * loads is the shape every drainer uses, and users are right to be trained against it.
 * But it also cost a click the user should never have had to make — after picking
 * Solflare from the dialog, the button turned into "Connect" and waited to be pressed
 * again, for a connection the user had just asked for.
 *
 * The two cases are different and the flag tells them apart. A restore from localStorage
 * happens before anyone has touched anything; a selection happens after they opened the
 * dialog. So the rule the page actually wants is not "never connect automatically" but
 * "never connect except in response to something the user did", and that is what this
 * measures.
 *
 * Listeners are passive and capture-phase, so nothing can stop them by swallowing the
 * event, and they remove themselves after the first one.
 */
let acted = false;

const EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

function mark() {
  acted = true;
  // Once is enough: the flag never goes back to false in a real session, so keeping three
  // capture-phase listeners alive for the life of the page would be work for nothing.
  for (const type of EVENTS) document.removeEventListener(type, mark, true);
}

function listen() {
  if (typeof document === 'undefined') return;
  for (const type of EVENTS) document.addEventListener(type, mark, {capture: true, passive: true});
}

listen();

export function userHasActed(): boolean {
  return acted;
}

/**
 * Tests only. It has to re-subscribe, not just clear the flag: `mark` removes the
 * listeners after the first gesture, so a reset that only set `acted = false` would leave
 * the module deaf and every later case would report "no gesture" for the wrong reason.
 * Found by the second test in the file failing after the first one passed.
 */
export function resetUserGestureForTests(): void {
  acted = false;
  for (const type of EVENTS) document.removeEventListener(type, mark, true);
  listen();
}
