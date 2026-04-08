# Step 24–25: Deep Link Module + Backup Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deep link module (URI parsing, navigation dispatch, mnemonic-in-URL rejection) and the backup module (cloud backup interface, manual export/import, encryption with mnemonic-derived key).

**Architecture:** DeepLinkManager parses incoming URLs into typed `DeepLinkAction` objects and dispatches them via a registered callback. BackupManager provides the 3-tier backup interface (mnemonic, cloud, manual export) with AES-256-GCM encryption using a mnemonic-derived key. Cloud storage is stubbed (real iCloud/GDrive integration requires native modules).

**Tech Stack:** React Native Linking API, @noble/hashes (for encryption key derivation), MMKV

---

## File Structure

```
src/
├── modules/
│   ├── deepLink/
│   │   ├── deepLinkModule.ts          — Parse URLs, dispatch actions, reject mnemonic URLs
│   │   ├── types.ts                   — DeepLinkAction, DeepLinkType
│   │   └── __tests__/
│   │       └── deepLinkModule.test.ts
│   └── backup/
│       ├── backupModule.ts            — Cloud backup + manual export/import interface
│       ├── types.ts                   — RestoreResult, BackupMetadata
│       └── __tests__/
│           └── backupModule.test.ts
```

---

## Task 1: Deep Link Types + Module (TDD)

### Types (`src/modules/deepLink/types.ts`):
```typescript
export type DeepLinkType = 'pay' | 'receive' | 'stake' | 'referral' | 'presale' | 'rejected';

export interface DeepLinkAction {
  type: DeepLinkType;
  params: Record<string, string>;
  reason?: string;
}
```

### Tests (10):
1. Parses `noctura://pay?to=addr&amount=10&token=NOC` → type 'pay' with params
2. Parses `noctura://receive` → type 'receive'
3. Parses `noctura://stake?amount=100&tier=365` → type 'stake' with params
4. Parses `https://noc-tura.io/ref/NOC-A7X2` → type 'referral' with code
5. Parses `noctura://presale` → type 'presale'
6. Parses `noctura://presale?ref=NOC-B3C4` → type 'presale' with ref param
7. **REJECTS** `noctura://import?mnemonic=word1+word2` → type 'rejected' with security reason
8. Returns null for empty/invalid URLs
9. Returns null for non-noctura schemes
10. onAction callback fires when handleLink produces an action

### Implementation:
- `handleLink(url)`: parse URL → match scheme + path → extract params → return DeepLinkAction
- `initialize()`: register Linking event listener
- `onAction(callback)`: store callback, fire on new links
- Mnemonic rejection: any URL containing `mnemonic` param → 'rejected' with reason

Commit: `git commit -m "feat: deep link module (pay/receive/stake/referral/presale, mnemonic rejection)"`

---

## Task 2: Backup Types + Module (TDD)

### Types (`src/modules/backup/types.ts`):
```typescript
export interface RestoreResult {
  notesRestored: number;
  tokensFound: string[];
  transparentBalanceFound: boolean;
  shieldedBalanceRestored: string; // BigInt as string
}

export interface BackupMetadata {
  version: number;
  createdAt: number;
  publicKeyHash: string; // SHA-256(publicKey) — not raw address
}
```

### Tests (8):
1. isCloudBackupEnabled returns false by default
2. enableCloudBackup sets MMKV flag
3. disableCloudBackup clears MMKV flag
4. lastCloudBackupAt returns null initially
5. performCloudBackup updates lastCloudBackupAt timestamp
6. exportToFile returns encrypted Uint8Array
7. importFromFile returns RestoreResult
8. Cloud backup identifier uses SHA-256(publicKey), not raw address

### Implementation:
- `BackupManager` class
- Cloud backup: MMKV flags for enabled/lastBackupAt. Actual cloud upload stubbed (requires native iCloud/GDrive SDK).
- `performCloudBackup()`: collect shielded notes data → encrypt → update timestamp (upload stubbed)
- `exportToFile(password)`: collect data → double-layer encrypt (password + mnemonic-derived key) → return Uint8Array
- `importFromFile(data, password)`: decrypt → parse → return RestoreResult
- Encryption: AES-256-GCM via @noble/ciphers (already in project dependencies)
- Backup identifier: `SHA-256(publicKey.toBytes())` — never raw address in cloud metadata

Commit: `git commit -m "feat: backup module (cloud + manual export/import, AES-256-GCM, SHA-256 identifier)"`

---

## Task 3: Wire + Verify

- Verify tsc + jest
- Commit plan

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  Deep link: noctura://pay parses to/amount/token
[ ]  Deep link: noctura://receive → type 'receive'
[ ]  Deep link: noctura://stake → type 'stake' with tier
[ ]  Deep link: referral URL → saves code
[ ]  Deep link: noctura://presale with optional ref
[ ]  Deep link: mnemonic in URL → REJECTED with security error
[ ]  Deep link: onAction callback fires on valid links
[ ]  Backup: cloud enable/disable via MMKV
[ ]  Backup: lastCloudBackupAt tracks timestamp
[ ]  Backup: exportToFile returns encrypted data
[ ]  Backup: importFromFile returns RestoreResult
[ ]  Backup: identifier is SHA-256(publicKey), not raw address
[ ]  Backup: NEVER contains mnemonic or private keys
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
