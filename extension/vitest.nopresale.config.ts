import {defineConfig} from 'vite';
import {appConfig} from './vite.config';

/**
 * B1d §1.1, §6.1 "Switch, off build": the second vitest run of `npm run test` — vite.config.ts with NOCTURA_PRESALE=0,
 * so the presaleSwitch plugin resolves the three entries to their stubs and `__NOCTURA_PRESALE__` is false, exactly as
 * in `node scripts/build.mjs --no-presale`. It runs the named shared test files below (each must hold in both builds),
 * not the whole suite; `test.env` marks the run, so a test can tell which one it is in without trusting the constant.
 */
export const NOPRESALE_TESTS = [
  'src/__tests__/presaleSwitch.test.ts',
  'src/background/__tests__/messages.test.ts',
  'src/app/__tests__/router.test.ts',
  'src/app/__tests__/App.test.tsx',
  'src/unlock/__tests__/challenge.test.ts',
  'src/background/__tests__/intents.test.ts',
  'src/background/__tests__/pendingKinds.test.ts',
  'src/app/__tests__/genericRecord.test.tsx',
  'src/app/__tests__/homePresale.test.tsx',
  'src/app/__tests__/engine.test.ts',
  'src/background/geo/__tests__/gate.test.ts',
  '../core/geo/**/*.test.ts',
];

const base = appConfig({...process.env, NOCTURA_PRESALE: '0'});
export default defineConfig({...base, test: {...base.test, include: NOPRESALE_TESTS, env: {NOCTURA_PRESALE: '0'}}});
