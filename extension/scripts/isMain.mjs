import {pathToFileURL} from 'node:url';

/**
 * Whether `url` (a script's own `import.meta.url`) is the URL of the script node was invoked with
 * (`process.argv[1]`) — every gate's CLI guard (B1d-1a Task 2 review I2).
 *
 * The old idiom, `import.meta.url === \`file://${process.argv[1]}\``, builds the right-hand side by string
 * concatenation: it is never percent-encoded, so it never matches `import.meta.url` (which always is) once the
 * path contains a space or another reserved character. At such a path every gate below silently takes its `else`
 * branch — exports its functions, prints nothing, exits 0 — so `npm run gates` reports the gate green without it
 * having run at all. `pathToFileURL` encodes the same way `import.meta.url` does, so the two sides compare equal
 * at any path.
 */
export const isMain = url => typeof process.argv[1] === 'string' && url === pathToFileURL(process.argv[1]).href;
