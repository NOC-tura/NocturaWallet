# Audit Implementation Guide

> Step-by-step instructions for every finding from the 2026-04-07 full codebase audit.
> Reference: `docs/AUDIT_FINDINGS.md` for full context on each issue.

---

## C-01: Backup PBKDF2 Key Derivation

**Current:** `SHA-256(password || salt)` — zero key stretching
**Target:** PBKDF2-SHA512, 600K iterations

```
1. Open src/modules/backup/backupModule.ts
2. Add import: import {pbkdf2} from '@noble/hashes/pbkdf2.js';
                import {sha512} from '@noble/hashes/sha2.js';
3. Replace deriveKey function:
   async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
     return pbkdf2(sha512, password, salt, {c: 600_000, dkLen: 32});
   }
4. Make exportToFile and importFromFile async-aware (deriveKey is now async)
5. Change BACKUP_MAGIC to 'NOCTURA_BACKUP_V2'
6. Add migration: if imported file has V1 magic, use old SHA-256 derivation for decryption
7. Update tests — round-trip test now needs await
8. Run: npx jest --testPathPattern='backupModule' --no-coverage
```

---

## C-02: SPL TransferChecked Instruction

**Current:** TODO comment, no actual token transfer
**Target:** Full SPL TransferChecked instruction

```
1. npm install @solana/spl-token
2. Open src/modules/solana/transactionBuilder.ts
3. Add imports:
   import {createTransferCheckedInstruction, getAssociatedTokenAddress} from '@solana/spl-token';
4. In buildSPLTransferTx, after ATA creation instruction:
   - Get sender ATA: getAssociatedTokenAddress(mint, sender)
   - Get recipient ATA: getAssociatedTokenAddress(mint, recipient)
   - Add instruction: createTransferCheckedInstruction(senderAta, mint, recipientAta, sender, amount, decimals)
5. Add runtime guard at top until complete:
   if (!createTransferCheckedInstruction) throw new Error('SPL transfer not yet available');
6. Update __mocks__/@solana/web3.js.ts if needed
7. Run all tests
```

---

## C-05: parseFloat → parseTokenAmount (3 shielded screens)

**Current:** `BigInt(Math.round(parseFloat(amount) * 1e9))`
**Target:** `parseTokenAmount(amount, 9)`

```
For EACH of: DepositScreen.tsx, ShieldedTransferScreen.tsx, WithdrawScreen.tsx:

1. Add import: import {parseTokenAmount} from '../../utils/parseTokenAmount';
2. Replace the parsedAmount computation:
   FROM: const parsedAmount = BigInt(Math.round(parseFloat(amount || '0') * 1e9));
   TO:   const parsedAmount = (() => {
           try { return parseTokenAmount(amount || '0', 9); }
           catch { return 0n; }
         })();
3. Run tests for each screen
```

---

## C-06: BalanceCard parseFloat

```
1. Open src/components/BalanceCard.tsx
2. Add import: import {formatTokenAmount} from '../utils/parseTokenAmount';
3. Replace parseFloat-based display:
   FROM: const nocDisplay = (parseFloat(nocBalance) || 0) / 1e9;
   TO:   const nocDisplay = formatTokenAmount(BigInt(nocBalance || '0'), 9);
4. Same for solBalance if applicable
5. Run tests
```

---

## C-07: SendScreen Debounce

```
1. Open src/screens/transparent/SendScreen.tsx
2. Add: const lastTapRef = useRef(0);
3. At start of handleReview:
   const now = Date.now();
   if (now - lastTapRef.current < 500) return;
   lastTapRef.current = now;
4. Same pattern at start of handleConfirm
5. Run SendScreen tests
```

---

## C-08: Base58 Public Key

```
1. Open src/screens/onboarding/SuccessScreen.tsx
2. Import PublicKey: import {PublicKey} from '@solana/web3.js';
3. Replace hex encoding:
   FROM: Buffer.from(keypair.publicKey).toString('hex')
   TO:   new PublicKey(keypair.publicKey).toBase58()
4. Verify ReceiveScreen, WalletChip, Dashboard display correctly
5. Run all onboarding tests
```

---

## C-09: Remove .env Files from Git

```
1. git rm --cached .env.development .env.production
2. Verify .gitignore has: .env*
3. Create .env.example with placeholder values (no real keys)
4. git add .env.example
5. git commit -m "security: remove .env files from git tracking"
6. Document in README: copy .env.example → .env.development
```

---

## C-10: Fee Treasury Address

```
1. Get real mainnet fee treasury address from team/multisig
2. Open src/constants/programs.ts
3. Replace 'TODO_MAINNET_FEE_TREASURY' with real Base58 address
4. Add startup guard after the constant:
   if (NOCTURA_FEE_TREASURY.startsWith('TODO')) {
     throw new Error(`NOCTURA_FEE_TREASURY not configured for ${NETWORK}`);
   }
5. Same guard for other TODO addresses
```

---

## C-12: View Key Clipboard Auto-Clear

```
1. Open src/screens/settings/ExportViewKeyScreen.tsx
2. Add useRef for timer: const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
3. In copy handler, after Clipboard.setString:
   if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
   clipboardTimerRef.current = setTimeout(() => Clipboard.setString(''), 30_000);
4. Add cleanup in useEffect return: if (clipboardTimerRef.current) { clearTimeout(...); Clipboard.setString(''); }
```

---

## C-13: Session Timeout Enforcement

```
1. Open src/app/App.tsx (or create a SessionGuard component)
2. Add AppState listener:
   import {AppState} from 'react-native';
   import {useSessionStore} from '../store/zustand/sessionStore';

   useEffect(() => {
     const sub = AppState.addEventListener('change', (state) => {
       if (state === 'active') {
         const session = useSessionStore.getState();
         if (session.isExpired()) {
           session.lock();
           // Navigate to Unlock
         }
       }
     });
     return () => sub.remove();
   }, []);
3. Also add a periodic check (every 30s) while app is in foreground
4. Wire navigation to Unlock screen on expiry
```

---

## C-14: FLAG_SECURE on Shielded Screens

```
For EACH of: DepositScreen.tsx, ShieldedTransferScreen.tsx, WithdrawScreen.tsx:

1. Add import: import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
2. Add useEffect:
   useEffect(() => {
     ScreenSecurityManager.enableSecureScreen();
     return () => ScreenSecurityManager.disableSecureScreen();
   }, []);
```

---

## C-15: MMKV Secure Adapter

```
Option A (Queue + Replay):
1. Open src/store/mmkv/secureAdapter.ts
2. Add a write queue: const pendingWrites: Array<{name: string; value: string}> = [];
3. In setItem, if store is null: push to pendingWrites instead of dropping
4. In initSecureMmkv: after creating store, replay all pending writes
5. Clear pendingWrites after replay

Option B (Throw):
1. In setItem, if store is null: throw new Error('Secure MMKV not initialized')
2. Callers must handle the error — breaks silent behavior but surfaces bugs
```

---

## I-01: getKeypair Expiry Check

```
1. Open src/modules/session/sessionModule.ts
2. Change getKeypair:
   getKeypair(): Uint8Array | null {
     if (!this.isActive()) return null;
     return this.keypair;
   }
```

---

## I-05: Stub Device Token Guard

```
1. Open src/modules/notifications/notificationModule.ts
2. In registerToken(), replace:
   const token = this.deviceToken ?? 'stub-device-token';
   WITH:
   if (!this.deviceToken) return; // Don't register stub token with backend
   const token = this.deviceToken;
3. Same in unregisterToken()
```

---

## I-10: Transaction History → Detail Navigation

```
1. Open src/app/Navigator.tsx
2. Find TransactionHistoryScreenNav (line ~279)
3. Replace no-op onSelectTx with cross-stack navigation:
   onSelectTx={(_signature: string) => {
     navigation.navigate('SendTab', {
       screen: 'TransactionDetail',
       params: {signature: _signature},
     });
   }}
4. Ensure SendStackParamList includes TransactionDetail route
```

---

## I-18: Deep Link Auth Guard

```
1. Open src/app/Navigator.tsx
2. In the RootStack navigator, add auth check before rendering deep-linked screens:
   - Read sessionStore.isUnlocked
   - If not unlocked and route is Deposit/ShieldedTransfer/Withdraw/etc:
     redirect to Unlock with a return-to parameter
3. Alternative: wrap deep-linked routes in a guard component that checks session
```

---

## I-20: Fix npm audit CI

```
1. Open .github/workflows/ci.yml
2. Change audit step:
   FROM: npm audit --omit=dev --audit-level=critical || true
   TO:   npm audit --omit=dev --audit-level=critical
3. If known unfixable vulns exist, use:
   npx better-npm-audit audit --level critical
   (which supports per-CVE ignoring)
```

---

## I-24: Session Timeout from Settings

```
1. Open src/store/zustand/sessionStore.ts
2. Import: import {useSecureSettingsStore} from './secureSettingsStore';
3. In unlock() and touchActivity(), read configured timeout:
   const timeoutMinutes = useSecureSettingsStore.getState().sessionTimeoutMinutes;
   const timeoutMs = timeoutMinutes * 60 * 1000;
4. Use timeoutMs instead of hardcoded DEFAULT_TIMEOUT_MINUTES * 60 * 1000
```

---

## Hidden Risks Summary

1. **JS string zeroization is best-effort** — Hermes/V8 doesn't overwrite original string memory. Uint8Array.fill(0) works; string replacement does not. Document this limitation.

2. **Client-side geo-fence is bypassable** — setKycCountry() allows override. Server-side relayer enforcement required for real OFAC compliance.

3. **RPC calls bypass SSL pinning** — Solana Connection uses its own HTTP client, not pinnedFetch. MITM on RPC could return fake balances (but can't steal funds since signing is client-side).

4. **Rate limiter deduplication shares failures** — If first caller's request fails, all deduped callers get the same error. No independent retry opportunity.

5. **Cooldown + wipe session race** — At 10 PIN failures, both cooldown and wipe flags are set. Wipe may be deferred by 30s cooldown.

6. **HDKey intermediate state not zeroized** — BIP-32 derivation leaves chainCode in memory after key extraction.

7. **React batching can bypass state-based debounce** — `sending` flag set via setState may not take effect before second tap in same batch. Ref-based debounce is the correct pattern.
