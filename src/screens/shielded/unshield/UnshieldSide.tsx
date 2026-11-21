import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, Pressable, TextInput, ScrollView} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import {AlertTriangle, RefreshCw, Shield} from 'lucide-react-native';
import {Text} from '../../../components/ui';
import {AmountLimitHint, DestinationRow, DetailsDisclosure, overLimit, type DestinationChoice} from '../../../components/private';
import {cn} from '../../../utils/cn';
import {parseTokenAmount, formatTokenAmount} from '../../../utils/parseTokenAmount';
import {A0_TOKEN, a0ErrorText, displayAmount} from '../../../modules/shielded/a0/screenSupport';
import {fetchA0RelayerQuote} from '../../../modules/shielded/a0/relayerClient';
import type {A0RelayerQuote} from '../../../modules/shielded/a0/relayerClient';
import {a0UnshieldDestinationOffer, a0UnshieldSource} from '../../../modules/shielded/a0/unshieldFlow';
import type {A0UnshieldDestination, A0UnshieldSource} from '../../../modules/shielded/a0/unshieldFlow';
import {loadA0NoteStore} from '../../../modules/shielded/a0/noteStore';
import {loadTransparentScheme} from '../../../modules/keyDerivation/derivationScheme';
import type {TransparentScheme} from '../../../modules/keyDerivation/transparent';
import {getConnection} from '../../../modules/solana/connection';
import {useWalletStore} from '../../../store/zustand/walletStore';
import type {A0ShieldedView} from '../../../hooks/useA0Shielded';
import {BalanceRow} from '../shieldedParts';
import {
  DESTINATION_FRESH_SCHEME_UNREADABLE,
  PRIVATE_BALANCE,
  WHAT_STAYS_PUBLIC,
  makePublicCta,
  makePublicCtaIdle,
  makePublicLimit,
} from '../../../copy/modes';
import {
  A0_EXTERNAL_WARNING,
  A0_FRESH_UNAVAILABLE_COPY,
  A0_MAIN_ACCOUNT_WARNING,
  A0_RELAYED_COPY,
  a0AmountLine,
  a0FreshDefaultCopy,
  a0OneNoteLimit,
} from './unshieldCopy';

/**
 * #16's "Make public" screen — the A0 unshield (spec §6 steps 1–2, §11; M1c Task 8). Mirrors the
 * design's states 2 (Make public · idle: the one balance line, the nested MAX, the warning banner —
 * titled "What stays public" since the owner phone pass 2026-11-21) and 5 (amount entered · fees ·
 * the warning), plus
 * what the A0 unshield adds, UNDRAWN and built from the design system (listed for the owner's
 * visual pass): the relayer quote's states (asking / refused + Retry), the destination, the
 * one-note limit line and the amount line.
 *
 * Shielded UX part B (spec 2026-11-20 §3–§4): ONE balance line, "Private balance" (decision B-2).
 * The destination is one collapsed `DestinationRow` — "To: {choice} · Change", the three options
 * (a new account, my main account, another address with its input) behind Change (decision B-5).
 * The fresh account is preselected when the relayer grants SOL (S11, controller ruling 4); when it
 * is not offered (S9 cli, S11 no grant, an unreadable key scheme) NOTHING is preselected, as M1c
 * ruled ("To: Choose a destination" and the one-line reason; owner decision 2026-11-20, plan A1).
 * §11's warnings for the chosen destination show under the row, never behind Change or Details.
 * The network fee, the ZK proof fee and the one-note explanation sit behind "Details ▾"
 * (decision B-3); `AmountLimitHint` replaces the max line (decision B-4).
 *
 * WHAT IT DECIDES: nothing about the unshield itself. The quote fetched here only feeds the
 * offer (`a0UnshieldDestinationOffer`), the fee rows and the most one note can pay
 * (`a0UnshieldSource`); the flow (`unshieldA0`, on the next screen) fetches its own quote, and the
 * native dialog shows the terms the human approves. The CTA hands over the choice and the amount
 * in base units (BigInt-exact, cardinal rule 2).
 *
 * THE CTA (cardinal rule 6, Task 7's hand-over): debounced 500 ms AND disabled on tap — it stays
 * disabled until this screen is focused again (`focusKey`); disabled while the A0 startup step is
 * not `ready` (the flow does not look at it), while the quote is not in, and while the amount or
 * the destination is not valid. The flow refuses a second concurrent unshield on its own
 * (`E_A0_UNSHIELD_BUSY`).
 */

export type UnshieldChoice = DestinationChoice;

export interface UnshieldSideProps {
  view: A0ShieldedView;
  /** #16's private-side STATUS (startup states, a refusal, the pending sum, "Check again"), shared with the Make private screen */
  shieldedLine: React.ReactNode;
  /** CTA → the unshield run (#18 → #21), the amount in base units */
  onUnshield: (request: {destination: A0UnshieldDestination; amount: string}) => void;
  /** changes each time the screen regains focus: the CTA's tap-disable ends there */
  focusKey?: number;
}

type QuoteState =
  | {kind: 'loading'}
  | {kind: 'ok'; quote: A0RelayerQuote}
  | {kind: 'error'; code: string | null; message: string};

type Parsed = {kind: 'empty'} | {kind: 'invalid'} | {kind: 'ok'; units: bigint};

function parseAmount(text: string): Parsed {
  if (text.trim() === '') return {kind: 'empty'};
  try {
    const units = parseTokenAmount(text, A0_TOKEN.decimals);
    return units > 0n ? {kind: 'ok', units} : {kind: 'invalid'};
  } catch {
    return {kind: 'invalid'};
  }
}

/** "Another address": a canonical base58 wallet address on the Ed25519 curve, not the main account. */
export function externalOwnerProblem(text: string, main: string | null): string | null {
  const t = text.trim();
  if (t === '') return null;
  let k: PublicKey;
  try {
    k = new PublicKey(t);
  } catch {
    return 'Not a Solana address.';
  }
  if (k.toBase58() !== t || !PublicKey.isOnCurve(k.toBytes())) {
    return 'Not a wallet address (a program or token account cannot receive here).';
  }
  if (main !== null && t === main) {
    return 'This is your main account: choose "My main account" instead.';
  }
  return null;
}

function readScheme(): TransparentScheme | null {
  try {
    return loadTransparentScheme();
  } catch {
    return null;
  }
}

function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

export function UnshieldSide({view, shieldedLine, onUnshield, focusKey = 0}: UnshieldSideProps) {
  const mainAddress = useWalletStore().publicKey;
  const [quote, setQuote] = useState<QuoteState>({kind: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<UnshieldChoice | null>(null);
  const [external, setExternal] = useState('');
  const [amount, setAmount] = useState('');
  const [tapped, setTapped] = useState(false);
  const lastTapRef = useRef(0);
  const preselectedRef = useRef(false);
  const [scheme] = useState<TransparentScheme | null>(readScheme);

  useEffect(() => {
    setTapped(false);
  }, [focusKey]);

  useEffect(() => {
    let alive = true;
    setQuote({kind: 'loading'});
    fetchA0RelayerQuote(getConnection()).then(
      q => {
        if (alive) setQuote({kind: 'ok', quote: q});
      },
      (e: unknown) => {
        if (alive) setQuote({kind: 'error', ...a0ErrorText(e)});
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const q = quote.kind === 'ok' ? quote.quote : null;
  const offer = q && scheme ? a0UnshieldDestinationOffer(q, scheme) : null;

  // S11 / controller ruling 4: the fresh account is preselected when the quote grants SOL; the
  // preselection happens once (a later re-fetch never overrides the user's own pick).
  useEffect(() => {
    if (offer && !preselectedRef.current) {
      preselectedRef.current = true;
      if (offer.preselected !== null) setChoice(offer.preselected);
    }
  }, [offer]);

  const ready = view.kind === 'ready';
  // M-9: the note store is read when the startup view, the quote or the focus changes — never on a
  // keystroke (the view object is replaced on every startup / Check-again refresh)
  const {source, notesError} = useMemo((): {source: A0UnshieldSource | null; notesError: string | null} => {
    if (!(ready && q)) {
      return {source: null, notesError: null};
    }
    try {
      return {source: a0UnshieldSource(loadA0NoteStore().notes, q.fee), notesError: null};
    } catch (e) {
      const t = a0ErrorText(e);
      // final review M-4: the code alone where there is one; the raw message only without a code
      return {source: null, notesError: t.code ?? t.message};
    }
    // `view` stands for a refreshed store (a new object per refresh); focusKey for a return to #16
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, q, focusKey]);
  const vault = view.kind === 'ready' ? view.unspent : null;
  const max = source?.maxAmount ?? 0n;

  const parsed = parseAmount(amount);
  const hasAmount = parsed.kind === 'ok';
  const units = parsed.kind === 'ok' ? parsed.units : 0n;
  const overMax = overLimit(hasAmount && source !== null ? units : null, max);
  const extProblem = choice === 'external' ? externalOwnerProblem(external, mainAddress) : null;
  const destinationValid =
    choice === 'fresh'
      ? offer?.fresh.available === true
      : choice === 'main'
        ? true
        : choice === 'external'
          ? external.trim() !== '' && extProblem === null
          : false;
  const canSubmit = ready && q !== null && source !== null && hasAmount && !overMax && destinationValid && !tapped;

  const handleMax = useCallback(() => {
    if (max <= 0n) return;
    setAmount(formatTokenAmount(max, A0_TOKEN.decimals));
  }, [max]);

  const handleSubmit = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 500) return; // cardinal rule 6
    lastTapRef.current = now;
    if (!canSubmit || choice === null) return;
    setTapped(true); // disabled on tap, until the screen is focused again
    const destination: A0UnshieldDestination =
      choice === 'external' ? {kind: 'external', owner: external.trim()} : {kind: choice};
    onUnshield({destination, amount: units.toString()});
  }, [canSubmit, choice, external, onUnshield, units]);

  const sym = A0_TOKEN.symbol;
  const fee = q?.fee ?? null;
  // why the fresh account is not offered: the offer's reason (S9 / S11), or — with a quote but no
  // readable key scheme, where no offer can be computed — that the scheme could not be read (fix round 1)
  const freshReason =
    offer !== null
      ? offer.fresh.available
        ? null
        : A0_FRESH_UNAVAILABLE_COPY[offer.fresh.reason]
      : q !== null && scheme === null
        ? DESTINATION_FRESH_SCHEME_UNREADABLE
        : null;

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {shieldedLine}

        {quote.kind === 'loading' ? (
          <Note tone="info" testID="unshield-quote">
            Asking the relayer for its fee…
          </Note>
        ) : quote.kind === 'error' ? (
          <Note tone="danger" testID="unshield-quote">
            {`The relayer's quote was refused · ${quote.code ?? 'error'}\n${quote.code ? 'Ask the relayer again in a moment.' : quote.message}\n`}
            <Text
              variant="body-sm"
              className="text-accent-shielded font-geist-semibold"
              onPress={() => setAttempt(a => a + 1)}
              accessibilityRole="button"
              accessibilityLabel="Ask the relayer again"
              testID="unshield-quote-retry"
            >
              Retry
            </Text>
          </Note>
        ) : null}
        {notesError ? (
          <Note tone="danger" testID="unshield-notes-error">
            {`Your private balance could not be read · ${notesError}`}
          </Note>
        ) : null}

        {/* Amount card — its one balance line is the PRIVATE balance (decision B-2) */}
        <View
          className={cn(
            'rounded-lg bg-bg-surface-1 border p-5 mb-4',
            overMax ? 'border-danger' : 'border-bg-surface-3',
          )}
        >
          <BalanceRow
            label={PRIVATE_BALANCE}
            value={vault === null ? '—' : `${displayAmount(vault, A0_TOKEN.decimals)} ${sym}`}
            testID="unshield-vault"
          />
          {/* UX-A 3 (the design's .amount-line: baseline, gap 8, centred): the input is sized to its
              content — no min width — so the symbol sits right after the figure */}
          <View className="flex-row items-baseline justify-center gap-2 mb-3" testID="unshield-amount-row">
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#6E727A"
              keyboardType="decimal-pad"
              accessibilityLabel="Amount"
              testID="unshield-amount-input"
              className={cn('font-geist text-balance-xl shrink p-0', overMax ? 'text-danger' : 'text-fg-primary')}
            />
            <Text variant="h2" className={cn(overMax ? 'text-danger' : 'text-fg-secondary')} testID="unshield-amount-symbol">
              {sym}
            </Text>
          </View>
          <View className="items-center">
            {overMax ? (
              <AmountLimitHint
                amount={hasAmount && source !== null ? units : null}
                max={max}
                message={makePublicLimit(displayAmount(max, A0_TOKEN.decimals), sym)}
                testID="unshield-over-max"
              />
            ) : parsed.kind === 'invalid' ? (
              <Text variant="caption" className="text-danger">
                {`Enter an amount of ${sym} (up to ${A0_TOKEN.decimals} decimals)`}
              </Text>
            ) : hasAmount ? null : (
              <Pressable
                onPress={handleMax}
                accessibilityRole="button"
                accessibilityLabel="Max"
                disabled={max <= 0n}
                className={cn(
                  'px-3 py-1.5 rounded-pill',
                  max > 0n ? 'bg-[rgba(91,227,194,0.16)] active:opacity-80' : 'bg-bg-surface-3',
                )}
              >
                {/* one MAX colour (owner phone pass 2026-11-21): the Make private chip's classes, not the transparent accent */}
                <Text variant="overline" className={max > 0n ? 'text-accent-shielded' : 'text-fg-disabled'}>
                  MAX
                </Text>
              </Pressable>
            )}
          </View>
          {source === null && ready && q !== null && notesError === null ? (
            <Text variant="caption" className="text-warning text-center mt-3" testID="unshield-no-note">
              {`No private note can pay the relayer fee of ${displayAmount(q.fee, A0_TOKEN.decimals)} ${sym}.`}
            </Text>
          ) : null}
        </View>

        {/* The destination (decision B-5): "To: … · Change"; the warnings under it, always visible */}
        <DestinationRow
          testID="unshield-dest"
          choice={choice}
          onChoose={setChoice}
          disabled={q === null}
          fresh={{
            available: offer !== null && offer.fresh.available,
            sub: offer !== null && offer.fresh.available ? a0FreshDefaultCopy(offer.fresh.grantLamports) : (freshReason ?? '—'),
          }}
          mainSub={mainAddress ? shortAddress(mainAddress) : 'Your main account'}
          mainMono={mainAddress !== null}
          freshReason={freshReason}
          warning={
            choice === 'main'
              ? {testID: 'unshield-warning-main', text: A0_MAIN_ACCOUNT_WARNING}
              : choice === 'external'
                ? {testID: 'unshield-warning-external', text: A0_EXTERNAL_WARNING}
                : null
          }
        >
          {choice === 'external' ? (
            <View className="mt-2">
              {/* UX-A 2: the WHOLE address is visible — two wrapped monospace lines (a single-line input
                  scrolls its start out of view); Enter submits, it never puts a line break in it */}
              <TextInput
                value={external}
                onChangeText={setExternal}
                placeholder="Recipient address"
                placeholderTextColor="#6E727A"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                textAlignVertical="top"
                accessibilityLabel="Recipient address"
                testID="unshield-external-input"
                className={cn(
                  'font-geist-mono text-body-sm text-fg-primary rounded-md bg-bg-surface-2 border px-3 py-3 min-h-touch-min',
                  extProblem ? 'border-danger' : 'border-bg-surface-3',
                )}
              />
              {extProblem ? (
                <Text variant="caption" className="text-danger mt-1" testID="unshield-external-problem">
                  {extProblem}
                </Text>
              ) : null}
            </View>
          ) : null}
        </DestinationRow>

        {/* Fees card — the relayer fee and what the destination receives visible; the rest behind Details */}
        <View className={cn('rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-4 mb-4', overMax && 'opacity-50')}>
          <Text variant="overline" className="mb-3">
            Fees
          </Text>
          <FeeRow
            label="Relayer fee"
            value={hasAmount && fee !== null ? `${displayAmount(fee, A0_TOKEN.decimals)} ${sym}` : '—'}
          />
          <View className="h-px bg-bg-surface-3 my-3" />
          <View className="flex-row items-center justify-between">
            <Text variant="body-sm" className="text-fg-secondary">
              Destination receives
            </Text>
            <Text variant="balance-md" numeral className="text-fg-primary" testID="unshield-net">
              {`${hasAmount && !overMax ? displayAmount(units, A0_TOKEN.decimals) : '—'} ${sym}`}
            </Text>
          </View>
          {hasAmount && !overMax && fee !== null ? (
            <Text variant="caption" className="text-fg-tertiary mt-3" testID="unshield-amount-line">
              {a0AmountLine(units, fee, A0_TOKEN.decimals, sym)}
            </Text>
          ) : null}
          <DetailsDisclosure testID="unshield-details">
            <View className="h-px bg-bg-surface-3 my-3" />
            <FeeRow label="Network fee" value={hasAmount ? 'Paid by the relayer' : '—'} />
            <FeeRow label="ZK proof fee" value={hasAmount ? 'None · made on this device' : '—'} zk />
            {source !== null ? (
              <Text variant="caption" className="text-fg-tertiary mt-1" testID="unshield-one-note">
                {a0OneNoteLimit(max, A0_TOKEN.decimals, sym)}
              </Text>
            ) : null}
          </DetailsDisclosure>
        </View>

        {/* The design's withdraw banner: the relayed sentence (the destination warnings sit under the row) */}
        <View
          className="rounded-md bg-bg-surface-2 border-l-2 border-l-warning p-4 mb-4 flex-row gap-3"
          testID="unshield-warning"
        >
          <AlertTriangle size={16} color="#F2B53B" strokeWidth={1.75} />
          <View className="flex-1 gap-1">
            <Text variant="body-sm" className="font-geist-semibold text-fg-primary">
              {WHAT_STAYS_PUBLIC}
            </Text>
            <Text variant="caption" className="text-fg-secondary" testID="unshield-relayed">
              {A0_RELAYED_COPY}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 pb-8 pt-2 border-t border-bg-surface-2 bg-bg-base">
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          testID="unshield-cta"
          accessibilityLabel={makePublicCtaIdle(sym)}
          className={cn(
            'min-h-touch-rec rounded-pill items-center justify-center flex-row gap-2',
            canSubmit ? 'bg-accent-shielded active:opacity-90' : 'bg-bg-surface-3',
          )}
        >
          <Text
            variant="body-lg"
            className={cn('font-geist-semibold', canSubmit ? 'text-bg-base' : 'text-fg-disabled')}
          >
            {hasAmount && !overMax ? makePublicCta(displayAmount(units, A0_TOKEN.decimals), sym) : makePublicCtaIdle(sym)}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function Note({tone, children, testID}: {tone: 'info' | 'danger'; children: React.ReactNode; testID?: string}) {
  const Icon = tone === 'info' ? RefreshCw : AlertTriangle;
  return (
    <View
      className={cn(
        'rounded-md bg-bg-surface-2 border-l-2 p-4 mb-4 flex-row gap-3',
        tone === 'danger' ? 'border-l-danger' : 'border-l-accent-shielded',
      )}
      testID={testID}
    >
      <Icon size={16} color={tone === 'danger' ? '#FF5C6A' : '#5BE3C2'} strokeWidth={1.75} />
      <Text variant="caption" className="flex-1 text-fg-secondary">
        {children}
      </Text>
    </View>
  );
}

function FeeRow({label, value, zk}: {label: string; value: string; zk?: boolean}) {
  return (
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2 flex-1">
        {zk ? (
          <View className="w-5 h-5 rounded-pill items-center justify-center bg-[rgba(91,227,194,0.16)]">
            <Shield size={12} color="#5BE3C2" strokeWidth={2} />
          </View>
        ) : null}
        <Text variant="body-sm" className={cn(zk ? 'text-accent-shielded' : 'text-fg-secondary')}>
          {label}
        </Text>
      </View>
      <Text variant="body-sm" numeral className="text-fg-primary">
        {value}
      </Text>
    </View>
  );
}
