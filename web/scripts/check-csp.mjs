#!/usr/bin/env node
// §6.4 says the production build must need neither 'unsafe-inline' nor 'unsafe-eval'.
// That sentence is only worth something if something refuses to ship a build that
// breaks it — a strict CSP fails in the BROWSER, at run time, on the deployed site,
// and a page whose modal renders unstyled or whose bundle throws on load is exactly
// the failure nobody sees in CI.
//
// So this gate reads the built output and reports the constructs a strict policy
// blocks. It never reads our policy: a gate that checked the build against our own
// header file would go green the moment someone loosened the header, which is
// backwards.
//
//   inline <script> / <style> / style="…"   → needs 'unsafe-inline'
//   eval( / new Function(                   → needs 'unsafe-eval'
//   document.createElement('style')         → injects a stylesheet at run time,
//                                             blocked by style-src without 'unsafe-inline'
//
// The last one cannot be seen in index.html, because it happens later — and it is the
// one that turned out to be real here (see RUNTIME_STYLE_ALLOWED).
import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {join, relative} from 'node:path';

/**
 * Runtime stylesheet injection we know about, each with its reason and an exact count.
 *
 * The count is the point. Matching on the marker alone would excuse every future
 * injection that happened to land in the same bundle as an explained one — one entry
 * would silently cover a library nobody reviewed. Pinning the count means a new
 * injection fails the gate even when it comes from code that is already on the list,
 * the same way the ZK manifest pins seven rows rather than one file hash.
 *
 * Markers are matched against the MINIFIED bundle, so a dependency update that renames
 * one stops matching and the gate fails. That is also correct: the decision recorded
 * here was made about code that is no longer there.
 */
export const RUNTIME_STYLE_ALLOWED = [
  // Empty, and that is the goal state. It held one entry for the length of an afternoon:
  // @solana-mobile/wallet-adapter-mobile's embedded modal, twice, because
  // @solana-mobile/wallet-standard-mobile rode in on the same dependency. Rather than
  // loosen style-src for it, the adapter was replaced with a stub
  // (web/src/wallet/mobileAdapterStub.ts) — which also removed the Google Fonts request it
  // made and 123 kB of bundle.
  //
  // Adding an entry here is a decision to ship something a strict policy blocks. Write the
  // reason and the exact count; the count is what stops one entry from covering the next.
];

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i;
const INLINE_STYLE_EL = /<style[^>]*>/i;
const STYLE_ATTR = /\sstyle\s*=\s*["']/i;

// `eval(` preceded by a word character is a method named *eval (safeEval, $eval) and
// `.eval(` is a property access. Only the bare global call needs 'unsafe-eval'.
const EVAL_CALL = /(^|[^.\w$])eval\s*\(/;
const FUNCTION_CTOR = /\bnew\s+Function\s*\(/;

// Minifiers emit createElement("style"), createElement('style') and createElement(`style`).
const CREATE_STYLE = /createElement\s*\(\s*[`'"]style[`'"]\s*\)/g;

/** Findings for one HTML document. */
export function checkHtml(source) {
  const found = [];
  if (INLINE_SCRIPT.test(source)) found.push("inline <script> — needs script-src 'unsafe-inline'");
  if (INLINE_STYLE_EL.test(source)) found.push("<style> element — needs style-src 'unsafe-inline'");
  if (STYLE_ATTR.test(source)) found.push('style="…" attribute — needs style-src \'unsafe-inline\'');
  return found;
}

/** Findings for one JavaScript file that are independent of the allowlist. */
export function checkJs(source) {
  const found = [];
  if (EVAL_CALL.test(source)) found.push("eval( — needs script-src 'unsafe-eval'");
  if (FUNCTION_CTOR.test(source)) found.push("new Function( — needs script-src 'unsafe-eval'");
  return found;
}

export function countStyleInjections(source) {
  return (source.match(CREATE_STYLE) ?? []).length;
}

/**
 * Compare the runtime style injections across the whole build against the allowlist.
 * Returns a list of complaints; empty means the build matches what was written down.
 */
export function auditRuntimeStyleInjection(sources, allowed = RUNTIME_STYLE_ALLOWED) {
  const complaints = [];
  const joined = sources.join('\n');
  const found = sources.reduce((n, s) => n + countStyleInjections(s), 0);

  let explained = 0;
  for (const entry of allowed) {
    if (!joined.includes(entry.marker)) {
      complaints.push(
        `allowlisted marker "${entry.marker}" is no longer in the build — the decision it ` +
          'records was made about code that is gone; re-read it rather than delete the line',
      );
      continue;
    }
    explained += entry.count;
  }

  if (found > explained) {
    complaints.push(
      `${found} runtime style injections, ${explained} explained — ${found - explained} new one(s) ` +
        "blocked by style-src 'self' with nobody having written down why they are acceptable",
    );
  } else if (found < explained) {
    complaints.push(
      `${found} runtime style injections but the allowlist claims ${explained} — an entry is stale; ` +
        'confirm what the dependency does now before lowering the count',
    );
  }
  return complaints;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error('usage: check-csp.mjs <built-dir>…');
    process.exit(2);
  }

  let bad = 0;
  let htmlSeen = 0;
  const jsSources = [];

  for (const root of roots) {
    if (!existsSync(root)) {
      console.error(`NOT BUILT ${root} — run the build first`);
      process.exit(2);
    }
    for (const file of walk(root)) {
      if (file.endsWith('.html')) {
        htmlSeen += 1;
        for (const f of checkHtml(readFileSync(file, 'utf8'))) {
          console.error(`CSP ${relative(process.cwd(), file)}: ${f}`);
          bad += 1;
        }
      } else if (file.endsWith('.js')) {
        const source = readFileSync(file, 'utf8');
        jsSources.push(source);
        for (const f of checkJs(source)) {
          console.error(`CSP ${relative(process.cwd(), file)}: ${f}`);
          bad += 1;
        }
      }
    }
  }

  // A gate that inspected nothing reports success indistinguishable from a gate that
  // inspected everything. Refuse the empty run rather than print a green line for it.
  if (htmlSeen === 0 || jsSources.length === 0) {
    console.error(
      `INCONCLUSIVE: ${htmlSeen} HTML and ${jsSources.length} JS files read — expected at least one of each`,
    );
    process.exit(2);
  }

  for (const complaint of auditRuntimeStyleInjection(jsSources)) {
    console.error(`CSP ${complaint}`);
    bad += 1;
  }

  if (bad === 0) {
    const explained = RUNTIME_STYLE_ALLOWED.reduce((n, e) => n + e.count, 0);
    console.log(
      `CSP ok: ${htmlSeen} HTML + ${jsSources.length} JS need no 'unsafe-inline' or 'unsafe-eval'; ` +
        `${explained} runtime style injection(s) allowlisted with a written reason`,
    );
  }
  process.exit(bad === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
