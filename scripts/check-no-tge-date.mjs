#!/usr/bin/env node
/**
 * The owner's rule (2026-09-26): the TGE date is not published anywhere yet — no UI, doc, test,
 * comment or commit in this public repository may carry it. It is on chain (presale config) and
 * in old git history, which this cannot change; it keeps the date from coming back.
 *
 * The date itself never appears in this file: every form is assembled from parts at run time, so
 * the gate cannot be the leak. Case-insensitive, over every tracked file.
 *
 *   node scripts/check-no-tge-date.mjs              scan `git ls-files`
 *   node scripts/check-no-tge-date.mjs --self-test  prove every form is caught and a near miss is not
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const Y = String(2000 + 27);
const M = 1;
const D = 18;
const MM = String(M).padStart(2, '0');
const MONTH_SHORT = ['J', 'a', 'n'].join('');
const MONTH_LONG = MONTH_SHORT + 'uary';
const SL_MONTH = 'januar';

/** Unix seconds and milliseconds of the date at every whole hour (the on-chain value may carry one). */
function timestamps() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    const s = Date.UTC(Number(Y), M - 1, D, h) / 1000;
    out.push(String(s), String(s * 1000));
  }
  return out;
}

export function forms() {
  return [
    `${Y}-${MM}-${D}`,
    `${Y}/${MM}/${D}`,
    `${Y}.${MM}.${D}`,
    `${MM}/${D}/${Y}`,
    `${M}/${D}/${Y}`,
    `${D}/${MM}/${Y}`,
    `${D}.${MM}.${Y}`,
    `${D}.${M}.${Y}`,
    `${D}. ${M}. ${Y}`,
    `${MONTH_SHORT} ${D}, ${Y}`,
    `${MONTH_SHORT} ${D} ${Y}`,
    `${MONTH_LONG} ${D}, ${Y}`,
    `${MONTH_LONG} ${D} ${Y}`,
    `${D} ${MONTH_SHORT} ${Y}`,
    `${D} ${MONTH_LONG} ${Y}`,
    `${D}th ${MONTH_LONG}`,
    `${D}th of ${MONTH_LONG}`,
    `${D}. ${SL_MONTH} ${Y}`,
    `${D}. ${SL_MONTH}a ${Y}`,
    ...timestamps(),
  ].map(f => f.toLowerCase());
}

export function findings(files) {
  const all = forms();
  const out = [];
  for (const {path, text} of files) {
    const lines = text.toLowerCase().split('\n');
    lines.forEach((line, i) => {
      if (all.some(f => line.includes(f))) out.push(`${path}:${i + 1}`);
    });
  }
  return out;
}

function selfTest() {
  let failed = 0;
  for (const f of forms()) {
    // Every form must be caught, in any case, inside other text.
    const text = `before ${f.toUpperCase()} after`;
    if (findings([{path: 'x', text}]).length !== 1) {
      failed++;
      console.error('FAIL: a form was not caught (index ' + forms().indexOf(f) + ')');
    }
  }
  // Near misses must pass: a neighbouring day and year.
  const near = [`${Y}-${MM}-${D + 1}`, `${Number(Y) + 1}-${MM}-${D}`, `${MONTH_SHORT} ${D + 1}, ${Y}`];
  for (const n of near) {
    if (findings([{path: 'x', text: n}]).length !== 0) {
      failed++;
      console.error('FAIL: a near miss was flagged');
    }
  }
  if (failed) {
    console.error(`self-test: ${failed} case(s) wrong`);
    process.exit(2);
  }
  console.log(`self-test ok: ${forms().length} forms caught, near misses pass`);
}

function main() {
  const tracked = execFileSync('git', ['ls-files', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
  const files = [];
  for (const path of tracked) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue; // a deleted-but-staged path or a submodule
    }
    if (text.includes('\0')) continue; // binary
    files.push({path, text});
  }
  const hits = findings(files);
  if (hits.length) {
    // Locations only — never the matching text.
    console.error('The TGE date (or its timestamp) appears in tracked files. The owner has not published it:');
    for (const h of hits) console.error('  ' + h);
    process.exit(1);
  }
  console.log(`no TGE date in ${files.length} tracked text files`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}
