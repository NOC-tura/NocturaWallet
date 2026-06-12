// Side-effect polyfill: expose a global Buffer for @solana/web3.js.
// Hermes has no global Buffer, and web3.js uses it for transaction
// (de)serialization. This MUST be a standalone side-effect module imported
// before App — a bare `global.Buffer = ...` statement in index.js would run
// AFTER App's import side effects (ES module evaluation order), too late.
import {Buffer} from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
