#!/usr/bin/env node
// Two things must never reach a browser: key-shaped symbols in our sources, and a
// credential in the built output. Which rule applies is chosen by --bundle, not by
// looking for "dist" in the path — a gate that guesses its own mode is a gate that
// silently applies the wrong one.
import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const SOURCE_FORBIDDEN =
  /\b(mnemonic|generateMnemonic|secretKey|privateKey|signAllTransactions|Keypair\.(fromSecretKey|fromSeed|generate)|nacl\.sign\.keyPair)\b/;
const BUNDLE_FORBIDDEN = /api-key=|BEGIN [A-Z ]*PRIVATE KEY/;

const args = process.argv.slice(2);
const bundleMode = args.includes('--bundle');
const roots = args.filter(a => a !== '--bundle');
const rule = bundleMode ? BUNDLE_FORBIDDEN : SOURCE_FORBIDDEN;
const extensions = bundleMode ? /\.(js|css|html|map|json)$/ : /\.(ts|tsx|js|jsx|mjs)$/;

let bad = 0;

function scanFile(p) {
  const m = rule.exec(readFileSync(p, 'utf8'));
  if (m) {
    console.error(`FORBIDDEN ${m[0]} in ${p}`);
    bad += 1;
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!extensions.test(entry)) continue;
    scanFile(p);
  }
}

for (const root of roots) {
  if (!existsSync(root)) continue;
  if (statSync(root).isDirectory()) {
    walk(root);
    continue;
  }
  if (!extensions.test(root)) {
    // A security gate must fail loud on a root it cannot scan, not silently pass it
    // by — the whole reason to run this before shipping is to be told when it can't
    // do its job, not to find out later that a file was never checked.
    console.error(`CANNOT SCAN ${root}: extension not matched by ${extensions}`);
    bad += 1;
    continue;
  }
  scanFile(root);
}
process.exit(bad === 0 ? 0 : 1);
