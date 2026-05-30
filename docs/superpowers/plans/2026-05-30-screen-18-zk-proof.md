# Screen #18 ZK Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ZkProofScreen` (#18) per the design spec — a 7-state machine (idle → building → proving → verifying → ready · failed · sheet · hosted-proving) with timer-driven mock animation, real `zkProver` chain integration, full hosted-prover consent sheet, and FLAG_SECURE.

**Architecture:** Single screen file at `src/screens/shielded/ZkProofScreen.tsx` with `useReducer` state machine + 4 separate `useEffect` hooks (FLAG_SECURE, chain, stage timer, ready→navigate) + inline `StageRow` and `DisclosureCard` subcomponents + bottom sheet via React Native `Modal`. The reducer is pure; effects react to state transitions and the chain result (held in a ref so it can be read inside the stage-timer setTimeout callback without re-triggering effects).

**Tech Stack:** React Native 0.84.1, NativeWind v4, react-native-svg (existing), Jest + @testing-library/react-native + fake timers.

**Spec:** `docs/superpowers/specs/2026-05-30-screen-18-zk-proof-design.md`

**Known module gap (documented):** Spec describes UX as "local-first, hosted-on-consent". Current `zkProver.prove()` is "hosted-first → local → queue" (per `src/modules/zkProver/zkProverModule.ts:107`). Both the default chain attempt and the sheet Proceed call invoke the same `zkProver.prove()` for #18 — functionally both paths fail today (no backend, local stubbed) so the divergence is invisible. When real local prover lands, the module's fallback chain should be inverted and this screen should switch to `proveLocalOnly()` / `proveHostedOnly()` methods. Out of scope for #18.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/screens/shielded/ZkProofScreen.tsx` | Screen + reducer + state types + inline subcomponents + helpers |
| Create | `src/screens/shielded/__tests__/ZkProofScreen.test.tsx` | 12 unit tests covering state transitions, render per state, sheet flow, chain mocking |
| Modify | `src/types/navigation.d.ts` | Add `ZkProofModal: {direction; amount; recipient?}` route |
| Modify | `src/app/Navigator.tsx` | Register route + screen wrapper |
| Modify | `src/screens/shielded/ShieldUnshieldScreen.tsx` | Replace placeholder `Alert.alert` CTA with `navigation.navigate('ZkProofModal', ...)` |

---

## Task 1: Add ZkProofModal route type (additive)

**Files:**
- Modify: `src/types/navigation.d.ts`

- [ ] **Step 1.1: Add route to RootStackParamList**

In `src/types/navigation.d.ts`, find `ShieldedExplainer: undefined;` (already present from PR #4) and ADD below it:

```ts
  ShieldedExplainer: undefined;
  ZkProofModal: {
    direction: 'private' | 'public';
    amount: string;
    recipient?: string;
  };
```

- [ ] **Step 1.2: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add src/types/navigation.d.ts
git commit -m "feat(#18): add ZkProofModal route type (additive)"
```

---

## Task 2: Write 12 failing tests (RED)

Tests written first per TDD. Will fail with `Cannot find module '../ZkProofScreen'` until Task 3 lands the file.

**Files:**
- Create: `src/screens/shielded/__tests__/ZkProofScreen.test.tsx`

- [ ] **Step 2.1: Write the test file**

Create `src/screens/shielded/__tests__/ZkProofScreen.test.tsx`:

```tsx
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {ZkProofScreen} from '../ZkProofScreen';
import {zkProver} from '../../../modules/zkProver/zkProverModule';
import type {ZKProof} from '../../../modules/zkProver/types';

jest.mock('../../../modules/zkProver/zkProverModule', () => ({
  zkProver: {
    prove: jest.fn(),
  },
}));

const mockProve = zkProver.prove as jest.MockedFunction<typeof zkProver.prove>;

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();
const navigation = {
  navigate: mockNavigate,
  replace: mockReplace,
  goBack: mockGoBack,
  popToTop: mockPopToTop,
} as any;
const route = {
  key: 'ZkProofModal-test',
  name: 'ZkProofModal',
  params: {direction: 'private' as const, amount: '5000000000', recipient: undefined},
} as any;

const mockProof: ZKProof = {
  proofType: 'deposit',
  proofData: 'mock-base64-proof',
  publicInputs: {root: '0x00', nullifier: '0x00', amount: '5000000000'},
  generatedAt: 1700000000000,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockProve.mockReset();
  mockNavigate.mockClear();
  mockReplace.mockClear();
  mockGoBack.mockClear();
  mockPopToTop.mockClear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('ZkProofScreen', () => {
  it('renders 4 stage titles + footer note on mount', () => {
    mockProve.mockReturnValue(new Promise(() => {})); // never resolves
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    expect(getByText('Build witness')).toBeTruthy();
    expect(getByText('Prove')).toBeTruthy();
    expect(getByText('Verify locally')).toBeTruthy();
    expect(getByText('Ready')).toBeTruthy();
    expect(getByText('FLAG_SECURE · screenshots blocked')).toBeTruthy();
  });

  it('starts in building state with hero "Building witness" after mount', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(50); // allow START_BUILDING dispatch
    });
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('advances to proving after 2 seconds when chain pending', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText('Proving')).toBeTruthy();
  });

  it('fast-forwards to ready when chain succeeds during building', async () => {
    mockProve.mockResolvedValue(mockProof);
    const {getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    // Let the promise resolve
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100); // end of building stage
    });
    expect(getByText('Ready')).toBeTruthy();
  });

  it('transitions to failed state when chain fails (chain rejects)', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByText, queryByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100); // end of building, reveals failure
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    expect(queryByText('Retry locally')).toBeTruthy();
    expect(queryByText('Use Noctura hosted prover')).toBeTruthy();
  });

  it('tap Retry locally resets state to idle and re-fires chain', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    mockProve.mockClear();
    fireEvent.press(getByTestId('retry-local-button'));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(mockProve).toHaveBeenCalled();
    expect(getByText('Building witness')).toBeTruthy();
  });

  it('tap Use Noctura hosted prover opens sheet with disclosure cards + opt-in + Proceed', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    expect(getByText('Use Noctura hosted prover')).toBeTruthy(); // sheet title
    expect(getByText('Server SEES')).toBeTruthy();
    expect(getByText("Server CAN'T SEE")).toBeTruthy();
    expect(getByText('Pedersen-hashed commitments')).toBeTruthy();
    expect(getByText('Spend key')).toBeTruthy();
    expect(
      getByText(
        "By proceeding you opt in to a one-time hosted proof. You'll be asked again on the next failure.",
      ),
    ).toBeTruthy();
    expect(getByText('Proceed with hosted proof')).toBeTruthy();
  });

  it('sheet Proceed triggers another zkProver.prove call (hosted attempt)', async () => {
    mockProve.mockRejectedValue(new Error('Hosted prover unreachable'));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockProve.mockClear();
    fireEvent.press(getByTestId('proceed-hosted-button'));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(mockProve).toHaveBeenCalled();
  });

  it('hosted attempt success → ready → Alert with proof-ready copy', async () => {
    mockProve.mockRejectedValueOnce(new Error('first fail'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    expect(getByText("Couldn't generate proof")).toBeTruthy();
    fireEvent.press(getByTestId('use-hosted-button'));
    mockProve.mockResolvedValueOnce(mockProof);
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Proof ready',
      'Transaction simulation (#19) not yet wired — returning to dashboard.',
      expect.any(Array),
    );
  });

  it('hosted attempt failure shows hostedBanner on failed state', async () => {
    mockProve.mockRejectedValueOnce(new Error('first fail'));
    const {getByTestId, getByText} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('use-hosted-button'));
    mockProve.mockRejectedValueOnce(new Error('hosted 503'));
    fireEvent.press(getByTestId('proceed-hosted-button'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getByText(/Hosted prover also failed.*hosted 503/)).toBeTruthy();
  });

  it('tap back × mid-proof shows confirm dialog', () => {
    mockProve.mockReturnValue(new Promise(() => {}));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    act(() => {
      jest.advanceTimersByTime(500); // mid-building
    });
    fireEvent.press(getByTestId('back-button'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Cancel proof generation?',
      'Your transaction will not be sent.',
      expect.any(Array),
    );
  });

  it('tap back × from failed state calls navigation.goBack directly', async () => {
    mockProve.mockRejectedValue(new Error('fail'));
    const {getByTestId} = render(<ZkProofScreen navigation={navigation} route={route} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    fireEvent.press(getByTestId('back-button'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2.2: Verify RED**

Run: `npx jest src/screens/shielded/__tests__/ZkProofScreen.test.tsx 2>&1 | tail -8`
Expected: `Cannot find module '../ZkProofScreen'`. Correct RED.

- [ ] **Step 2.3: Commit RED**

```bash
git add src/screens/shielded/__tests__/ZkProofScreen.test.tsx
git commit -m "test(#18): add failing tests for ZkProofScreen (RED)"
```

---

## Task 3: Implement ZkProofScreen (GREEN)

Single file with reducer + state types + screen + inline subcomponents + helpers. ~350 lines.

**Files:**
- Create: `src/screens/shielded/ZkProofScreen.tsx`

- [ ] **Step 3.1: Create the screen file**

Create `src/screens/shielded/ZkProofScreen.tsx`:

```tsx
import React, {useEffect, useReducer, useRef, useState, useCallback} from 'react';
import {View, Pressable, ScrollView, Alert, Modal, BackHandler} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowLeft, ShieldCheck, Cpu, AlertTriangle, Check} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Text} from '../../components/ui';
import {zkProver} from '../../modules/zkProver/zkProverModule';
import {ScreenSecurityManager} from '../../modules/screenSecurity/screenSecurityModule';
import type {ProofWitness, ZKProof} from '../../modules/zkProver/types';
import type {RootStackParamList} from '../../types/navigation';

const ACCENT = '#5BE3C2';
const DANGER = '#FF5C6A';
const securityManager = new ScreenSecurityManager();

const SEES_ITEMS = ['Pedersen-hashed commitments', 'Network fee', 'Anonymity set ID'];
const CANT_SEE_ITEMS = ['Spend key', 'Recipient address', 'Amount in clear'];

type Props = NativeStackScreenProps<RootStackParamList, 'ZkProofModal'>;

type StageNum = 1 | 2 | 3 | 4;
type StageStatus = 'pending' | 'active' | 'done' | 'errored';

type ChainResult =
  | {kind: 'pending'}
  | {kind: 'success'; proof: ZKProof}
  | {kind: 'failed'; reason: string};

type ZkUiState =
  | {kind: 'idle'}
  | {kind: 'building'; pct: number}
  | {kind: 'proving'; pct: number}
  | {kind: 'verifying'; pct: number}
  | {kind: 'ready'; proof: ZKProof}
  | {kind: 'failed'; erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}
  | {kind: 'sheet'; savedFailure: {erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}}
  | {kind: 'hosted-proving'};

type Action =
  | {type: 'START_BUILDING'}
  | {type: 'TICK'; pct: number}
  | {type: 'ADVANCE_TO_PROVING'}
  | {type: 'ADVANCE_TO_VERIFYING'}
  | {type: 'ADVANCE_TO_READY'; proof: ZKProof}
  | {type: 'FAIL'; erroredStage: 1 | 2 | 3; reason: string; hostedBanner?: string}
  | {type: 'OPEN_SHEET'}
  | {type: 'CLOSE_SHEET'}
  | {type: 'START_HOSTED'}
  | {type: 'RESET'};

function reducer(state: ZkUiState, action: Action): ZkUiState {
  switch (action.type) {
    case 'START_BUILDING':
      return {kind: 'building', pct: 0};
    case 'TICK':
      if (
        state.kind === 'building' ||
        state.kind === 'proving' ||
        state.kind === 'verifying'
      ) {
        return {...state, pct: action.pct};
      }
      return state;
    case 'ADVANCE_TO_PROVING':
      return {kind: 'proving', pct: 0};
    case 'ADVANCE_TO_VERIFYING':
      return {kind: 'verifying', pct: 0};
    case 'ADVANCE_TO_READY':
      return {kind: 'ready', proof: action.proof};
    case 'FAIL':
      return {
        kind: 'failed',
        erroredStage: action.erroredStage,
        reason: action.reason,
        hostedBanner: action.hostedBanner,
      };
    case 'OPEN_SHEET':
      if (state.kind === 'failed') {
        return {
          kind: 'sheet',
          savedFailure: {
            erroredStage: state.erroredStage,
            reason: state.reason,
            hostedBanner: state.hostedBanner,
          },
        };
      }
      return state;
    case 'CLOSE_SHEET':
      if (state.kind === 'sheet') {
        return {kind: 'failed', ...state.savedFailure};
      }
      return state;
    case 'START_HOSTED':
      return {kind: 'hosted-proving'};
    case 'RESET':
      return {kind: 'idle'};
    default:
      return state;
  }
}

function buildMockWitness(params: Props['route']['params']): ProofWitness {
  // Zero-filled values matching ProofWitness shape. Real values flow in once
  // shielded send pipes amount/recipient into proof generation end-to-end.
  const zeroHex = '0x' + '0'.repeat(64);
  return {
    noteCommitment: zeroHex,
    merklePath: [],
    merklePathIndices: [],
    nullifier: zeroHex,
    amount: params.amount,
    recipientAddress: params.recipient,
    noteSecret: zeroHex,
  };
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ZkProofScreen({navigation, route}: Props) {
  const [state, dispatch] = useReducer(reducer, {kind: 'idle'} as ZkUiState);
  const chainResultRef = useRef<ChainResult>({kind: 'pending'});
  const [retryCounter, setRetryCounter] = useState(0);

  // FLAG_SECURE on mount, off on unmount
  useEffect(() => {
    void securityManager.enableSecureScreen();
    return () => {
      void securityManager.disableSecureScreen();
    };
  }, []);

  // Chain effect — runs on mount + every retry. Resets chainResultRef and
  // kicks off zkProver.prove() in the background. Result lands in the ref.
  useEffect(() => {
    let cancelled = false;
    chainResultRef.current = {kind: 'pending'};

    async function runChain() {
      try {
        const witness = buildMockWitness(route.params);
        const proofType = route.params.direction === 'private' ? 'deposit' : 'withdraw';
        const proof = await zkProver.prove(proofType, witness);
        if (cancelled) return;
        chainResultRef.current = {kind: 'success', proof};
      } catch (err) {
        if (cancelled) return;
        chainResultRef.current = {kind: 'failed', reason: extractErrorMessage(err)};
      }
    }

    void runChain();
    return () => {
      cancelled = true;
    };
  }, [retryCounter, route.params]);

  // Mount + retry → kick off the state machine
  useEffect(() => {
    dispatch({type: 'START_BUILDING'});
  }, [retryCounter]);

  // Stage timer — runs once per stage transition (building/proving/verifying).
  // At end of each stage, reads chainResultRef.current and dispatches:
  //   - success → ADVANCE_TO_READY (fast-forward)
  //   - failed  → FAIL (with current stage as erroredStage)
  //   - pending → next stage (or finalize if we're in verifying)
  useEffect(() => {
    if (
      state.kind !== 'building' &&
      state.kind !== 'proving' &&
      state.kind !== 'verifying'
    ) {
      return;
    }

    const duration =
      state.kind === 'building' ? 2000 : state.kind === 'proving' ? 3000 : 2000;
    const totalTicks = Math.floor(duration / 200);
    let tick = 0;

    const interval = setInterval(() => {
      tick++;
      if (tick < totalTicks) {
        dispatch({type: 'TICK', pct: Math.round((tick / totalTicks) * 100)});
      }
    }, 200);

    const timeout = setTimeout(() => {
      const result = chainResultRef.current;
      const currentStage: 1 | 2 | 3 =
        state.kind === 'building' ? 1 : state.kind === 'proving' ? 2 : 3;

      if (result.kind === 'success') {
        dispatch({type: 'ADVANCE_TO_READY', proof: result.proof});
      } else if (result.kind === 'failed') {
        dispatch({type: 'FAIL', erroredStage: currentStage, reason: result.reason});
      } else if (state.kind === 'building') {
        dispatch({type: 'ADVANCE_TO_PROVING'});
      } else if (state.kind === 'proving') {
        dispatch({type: 'ADVANCE_TO_VERIFYING'});
      }
      // If we're in verifying and chain still pending: fall through to
      // the polling effect below.
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state.kind]);

  // Polling fallback — if chain still hasn't returned when verifying ends,
  // poll every 200ms until it does. Rare in practice (would mean total
  // animation time of 7s elapsed without hosted/local resolving).
  useEffect(() => {
    if (state.kind !== 'verifying') return;
    const interval = setInterval(() => {
      const result = chainResultRef.current;
      if (result.kind === 'success') {
        clearInterval(interval);
        dispatch({type: 'ADVANCE_TO_READY', proof: result.proof});
      } else if (result.kind === 'failed') {
        clearInterval(interval);
        dispatch({type: 'FAIL', erroredStage: 3, reason: result.reason});
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state.kind]);

  // Ready → 400ms hold → Alert → popToTop
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const t = setTimeout(() => {
      Alert.alert(
        'Proof ready',
        'Transaction simulation (#19) not yet wired — returning to dashboard.',
        [{text: 'OK', onPress: () => navigation.popToTop()}],
      );
    }, 400);
    return () => clearTimeout(t);
  }, [state.kind, navigation]);

  // Hosted-proving — retry with explicit consent. Calls zkProver.prove() again.
  // The module's chain (hosted-first → local → queue) means the user-visible
  // semantics are "another attempt with the user's explicit awareness". A
  // future module refactor will introduce proveHostedOnly().
  useEffect(() => {
    if (state.kind !== 'hosted-proving') return;
    let cancelled = false;
    async function runHosted() {
      try {
        const witness = buildMockWitness(route.params);
        const proofType = route.params.direction === 'private' ? 'deposit' : 'withdraw';
        const proof = await zkProver.prove(proofType, witness);
        if (cancelled) return;
        dispatch({type: 'ADVANCE_TO_READY', proof});
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: 'FAIL',
          erroredStage: 2,
          reason: "Couldn't generate proof",
          hostedBanner: `Hosted prover also failed: ${extractErrorMessage(err)}`,
        });
      }
    }
    void runHosted();
    return () => {
      cancelled = true;
    };
  }, [state.kind, route.params]);

  // Android hardware back — confirm during proof, otherwise dismiss/close sheet
  const handleBack = useCallback(() => {
    const midProof =
      state.kind === 'building' ||
      state.kind === 'proving' ||
      state.kind === 'verifying' ||
      state.kind === 'hosted-proving';
    if (midProof) {
      Alert.alert('Cancel proof generation?', 'Your transaction will not be sent.', [
        {text: 'Continue proving', style: 'cancel'},
        {text: 'Cancel', style: 'destructive', onPress: () => navigation.goBack()},
      ]);
      return true;
    }
    if (state.kind === 'sheet') {
      dispatch({type: 'CLOSE_SHEET'});
      return true;
    }
    navigation.goBack();
    return true;
  }, [state.kind, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  function handleRetryLocal() {
    setRetryCounter(c => c + 1);
    dispatch({type: 'RESET'});
  }

  function handleOpenSheet() {
    dispatch({type: 'OPEN_SHEET'});
  }

  function handleCloseSheet() {
    dispatch({type: 'CLOSE_SHEET'});
  }

  function handleProceedHosted() {
    dispatch({type: 'START_HOSTED'});
  }

  const stages = computeStages(state);
  const hero = computeHero(state);

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-5 h-12">
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="back-button"
          className="w-12 h-12 items-center justify-center -ml-3">
          <ArrowLeft size={22} color="#A8ACB5" strokeWidth={1.75} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={12} color={ACCENT} strokeWidth={2} />
          <Text variant="overline" className="text-accent-shielded">SHIELDED</Text>
        </View>
        <Text variant="overline" className="text-fg-tertiary">ZK</Text>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 24}}>
        {/* Hero */}
        <View className="items-center mt-6">
          <View
            className="rounded-full items-center justify-center border border-accent-shielded"
            style={{
              width: 88,
              height: 88,
              shadowColor: ACCENT,
              shadowOpacity: hero.spinning ? 0.5 : 0.25,
              shadowRadius: 16,
              shadowOffset: {width: 0, height: 0},
              elevation: 6,
            }}>
            <Cpu size={44} color={ACCENT} strokeWidth={1.75} />
          </View>
          <Text variant="h2" className="text-fg-primary mt-4 text-center">
            {hero.label}
          </Text>
          <Text variant="body-sm" className="text-fg-secondary mt-2 text-center max-w-xs">
            {hero.sub}
          </Text>
        </View>

        {/* Hosted banner (only on failed with hostedBanner) */}
        {state.kind === 'failed' && state.hostedBanner ? (
          <View className="bg-[rgba(255,92,106,0.12)] border border-[rgba(255,92,106,0.32)] rounded-md p-3 mt-6">
            <Text variant="body-sm" className="text-fg-primary">
              {state.hostedBanner}
            </Text>
          </View>
        ) : null}

        {/* Stages */}
        <View className="mt-8 gap-3">
          {stages.map(stage => (
            <StageRow key={stage.num} stage={stage} />
          ))}
        </View>

        {/* "Local prover slow?" link — visible during active stages */}
        {state.kind === 'building' ||
        state.kind === 'proving' ||
        state.kind === 'verifying' ? (
          <Pressable className="mt-4 self-center">
            <Text variant="body-sm" className="text-accent-shielded underline">
              Local prover slow?
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Footer note (always visible above sticky bar) */}
      <View className="flex-row items-center gap-2 px-5 mb-3">
        <ShieldCheck size={14} color={ACCENT} strokeWidth={1.75} />
        <Text variant="body-sm" className="text-accent-shielded">
          FLAG_SECURE · screenshots blocked
        </Text>
      </View>

      {/* Sticky bar — only on failed state */}
      {state.kind === 'failed' ? (
        <View className="px-5 pb-4 gap-3">
          <Pressable
            testID="retry-local-button"
            onPress={handleRetryLocal}
            accessibilityRole="button"
            accessibilityLabel="Retry locally"
            className="h-14 rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
            <Text variant="body-lg" className="font-geist-semibold text-bg-base">
              Retry locally
            </Text>
          </Pressable>
          <Pressable
            testID="use-hosted-button"
            onPress={handleOpenSheet}
            accessibilityRole="button"
            accessibilityLabel="Use Noctura hosted prover"
            className="h-14 rounded-pill bg-bg-surface-1 items-center justify-center active:opacity-90 border border-bg-surface-3">
            <Text variant="body-lg" className="font-geist-semibold text-fg-primary">
              Use Noctura hosted prover
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Hosted prover sheet (Modal) */}
      <Modal
        visible={state.kind === 'sheet'}
        animationType="slide"
        transparent
        onRequestClose={handleCloseSheet}>
        <View className="flex-1 bg-[rgba(0,0,0,0.5)] justify-end">
          <View className="bg-bg-surface-1 rounded-t-lg p-5">
            {/* Grabber */}
            <View className="self-center w-10 h-1 rounded-pill bg-fg-tertiary mb-4" />
            <Text variant="h2" className="text-fg-primary mb-4">
              Use Noctura hosted prover
            </Text>
            <View className="flex-row gap-3 mb-4">
              <DisclosureCard accent="warn" title="Server SEES" items={SEES_ITEMS} />
              <DisclosureCard
                accent="shield"
                title="Server CAN'T SEE"
                items={CANT_SEE_ITEMS}
              />
            </View>
            <Text variant="body-sm" className="text-accent-shielded mb-4">
              By proceeding you opt in to a one-time hosted proof. You'll be asked again on the next failure.
            </Text>
            <Pressable
              testID="proceed-hosted-button"
              onPress={handleProceedHosted}
              accessibilityRole="button"
              accessibilityLabel="Proceed with hosted proof"
              className="h-14 rounded-pill bg-accent-shielded items-center justify-center active:opacity-90">
              <Text variant="body-lg" className="font-geist-semibold text-bg-base">
                Proceed with hosted proof
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── StageRow ─────────────────────────────────────────────────────────────
interface StageRowProps {
  stage: {
    num: StageNum;
    title: string;
    status: StageStatus;
    meta: string;
    statusDisplay: string;
  };
}

function StageRow({stage}: StageRowProps) {
  const isActive = stage.status === 'active';
  const isDone = stage.status === 'done';
  const isErrored = stage.status === 'errored';
  const containerCls = isActive
    ? 'bg-[rgba(91,227,194,0.08)] border border-[rgba(91,227,194,0.32)]'
    : isErrored
    ? 'bg-[rgba(255,92,106,0.08)] border border-[rgba(255,92,106,0.32)]'
    : 'bg-bg-surface-1';
  const discCls = isDone || isActive ? 'bg-accent-shielded-tint' : 'bg-bg-surface-2';
  const numTextColor = isActive ? 'text-accent-shielded' : 'text-fg-tertiary';
  return (
    <View className={`flex-row items-center gap-3 p-3 rounded-md ${containerCls}`}>
      <View
        className={`w-7 h-7 rounded-full items-center justify-center ${discCls}`}>
        {isDone ? (
          <Check size={14} color={ACCENT} strokeWidth={2} />
        ) : isErrored ? (
          <AlertTriangle size={14} color={DANGER} strokeWidth={2} />
        ) : (
          <Text variant="body-sm" mono numeral className={numTextColor}>
            {stage.num}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text variant="body-sm" className="text-fg-primary">
          {stage.title}
        </Text>
        <Text variant="caption" className="text-fg-tertiary">
          {stage.meta}
        </Text>
      </View>
      <Text
        variant="body-sm"
        mono
        numeral
        className={isErrored ? 'text-danger' : 'text-fg-tertiary'}>
        {stage.statusDisplay}
      </Text>
    </View>
  );
}

// ── DisclosureCard ───────────────────────────────────────────────────────
interface DisclosureCardProps {
  accent: 'warn' | 'shield';
  title: string;
  items: string[];
}

function DisclosureCard({accent, title, items}: DisclosureCardProps) {
  const tintBg =
    accent === 'warn' ? 'bg-[rgba(255,184,77,0.12)]' : 'bg-[rgba(91,227,194,0.12)]';
  const tintBorder =
    accent === 'warn' ? 'border-[rgba(255,184,77,0.32)]' : 'border-[rgba(91,227,194,0.32)]';
  const titleColor = accent === 'warn' ? 'text-warning' : 'text-accent-shielded';
  return (
    <View className={`flex-1 p-3 rounded-md border ${tintBg} ${tintBorder}`}>
      <Text variant="overline" className={`${titleColor} mb-2`}>
        {title}
      </Text>
      {items.map(item => (
        <Text key={item} variant="body-sm" className="text-fg-secondary mb-1">
          {item}
        </Text>
      ))}
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
function computeHero(state: ZkUiState): {label: string; sub: string; spinning: boolean} {
  switch (state.kind) {
    case 'idle':
      return {
        label: 'Preparing proof',
        sub: 'Securely generating a zero-knowledge proof of ownership for this transfer. Stays on-device.',
        spinning: false,
      };
    case 'building':
      return {
        label: 'Building witness',
        sub: 'Loading commitment tree and constructing the witness. About 4 seconds.',
        spinning: true,
      };
    case 'proving':
      return {
        label: 'Proving',
        sub: 'Running the Plonk prover. About 6 seconds.',
        spinning: true,
      };
    case 'verifying':
      return {
        label: 'Verify locally',
        sub: 'Sanity-checking the proof on-device before broadcast.',
        spinning: true,
      };
    case 'ready':
      return {
        label: 'Ready',
        sub: 'Proof generated. Submitting to the network.',
        spinning: false,
      };
    case 'failed':
      return {label: "Couldn't generate proof", sub: state.reason, spinning: false};
    case 'sheet':
      return {
        label: "Couldn't generate proof",
        sub: state.savedFailure.reason,
        spinning: false,
      };
    case 'hosted-proving':
      return {
        label: 'Generating on hosted prover',
        sub: 'Connecting to the Noctura proving service.',
        spinning: true,
      };
  }
}

function computeStages(
  state: ZkUiState,
): Array<{
  num: StageNum;
  title: string;
  status: StageStatus;
  meta: string;
  statusDisplay: string;
}> {
  const titles: Record<StageNum, string> = {
    1: 'Build witness',
    2: 'Prove',
    3: 'Verify locally',
    4: 'Ready',
  };
  const row = (num: StageNum, status: StageStatus, meta: string, statusDisplay: string) => ({
    num,
    title: titles[num],
    status,
    meta,
    statusDisplay,
  });

  if (state.kind === 'idle' || state.kind === 'hosted-proving') {
    return ([1, 2, 3, 4] as StageNum[]).map(n => row(n, 'pending', '— · pending', '·'));
  }
  if (state.kind === 'building') {
    return [
      row(1, 'active', 'running · 2.0 s', `${state.pct} %`),
      row(2, 'pending', '— · pending', '·'),
      row(3, 'pending', '— · pending', '·'),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'proving') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'active', 'running · 3.0 s', `${state.pct} %`),
      row(3, 'pending', '— · pending', '·'),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'verifying') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'done', 'done · 3.0 s', '✓'),
      row(3, 'active', 'running · 2.0 s', `${state.pct} %`),
      row(4, 'pending', '— · pending', '·'),
    ];
  }
  if (state.kind === 'ready') {
    return [
      row(1, 'done', 'done · 2.0 s', '✓'),
      row(2, 'done', 'done · 3.0 s', '✓'),
      row(3, 'done', 'done · 2.0 s', '✓'),
      row(4, 'done', 'ready', '✓'),
    ];
  }
  // failed or sheet
  const failure = state.kind === 'failed' ? state : state.savedFailure;
  return ([1, 2, 3, 4] as StageNum[]).map(n => {
    if (n < failure.erroredStage) return row(n, 'done', 'done', '✓');
    if (n === failure.erroredStage) return row(n, 'errored', `error · ${failure.reason}`, '!');
    return row(n, 'pending', '— · pending', '·');
  });
}
```

- [ ] **Step 3.2: Verify GREEN — all 12 tests pass**

Run: `npx jest src/screens/shielded/__tests__/ZkProofScreen.test.tsx 2>&1 | tail -20`
Expected: `Tests: 12 passed, 12 total`.

If tests fail:
- Module/import errors → check paths
- Type errors → fix exact types (often `as any` for navigation/route stubs)
- Async/timing issues → ensure `act` wraps both `Promise.resolve()` flushes and `jest.advanceTimersByTime`
- Wrong text not found → check copy matches `getByText` exactly (em-dashes, smart quotes)
- `react-native-svg` errors in jest → no current mock exists; if hits, may need to add `__mocks__/react-native-svg.ts` (note: lucide-react-native works without explicit mock today; should also work for direct `react-native-svg` imports, but if it crashes add `jest.mock('react-native-svg', () => ({}))` at top of test file)

- [ ] **Step 3.3: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 3.4: Commit GREEN**

```bash
git add src/screens/shielded/ZkProofScreen.tsx
git commit -m "feat(#18): implement ZkProofScreen per §s18 spec (GREEN)"
```

---

## Task 4: Wire Navigator to new route

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 4.1: Add screen import**

In `src/app/Navigator.tsx`, near the other shielded screen imports, ADD:

```ts
import {ZkProofScreen} from '../screens/shielded/ZkProofScreen';
```

- [ ] **Step 4.2: Add screen wrapper function**

In `src/app/Navigator.tsx`, near the other `*ScreenNav` wrapper functions (e.g., `ShieldedExplainerScreenNav`), ADD:

```tsx
function ZkProofScreenNav(
  props: NativeStackScreenProps<RootStackParamList, 'ZkProofModal'>,
) {
  return <ZkProofScreen {...props} />;
}
```

- [ ] **Step 4.3: Register the route**

In `src/app/Navigator.tsx`, near the other `<RootNav.Screen>` registrations (e.g., `name="ShieldedExplainer"`), ADD:

```tsx
<RootNav.Screen
  name="ZkProofModal"
  component={ZkProofScreenNav}
  options={modalScreenOptions}
/>
```

- [ ] **Step 4.4: Type-check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4.5: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(#18): wire Navigator to ZkProofScreen at ZkProofModal route"
```

---

## Task 5: Update ShieldUnshieldScreen CTA

Replace the placeholder `Alert.alert(...)` with `navigation.navigate('ZkProofModal', ...)`.

**Files:**
- Modify: `src/screens/shielded/ShieldUnshieldScreen.tsx` (around line 127)

- [ ] **Step 5.1: Locate the existing CTA**

Run: `grep -n "ZK proof generation flow\|Alert\.alert" src/screens/shielded/ShieldUnshieldScreen.tsx`

You should see lines like:
```
127:    Alert.alert(
129:      `ZK proof generation flow (#18) is not yet wired — this is a visual preview. ${
```

- [ ] **Step 5.2: Read context to find the handler function name**

Run: `sed -n '120,140p' src/screens/shielded/ShieldUnshieldScreen.tsx`

Identify the function containing the `Alert.alert` call (likely `handleCta` or named similarly) and what `props` / state it has access to (direction, amount, etc.).

- [ ] **Step 5.3: Add navigation import + prop**

ShieldUnshieldScreen currently uses `onBack` prop but does not receive a navigation prop. Add navigation by either:

**Option A** (preferred — matches other shielded screens): use `useNavigation()` hook.

At the top of `src/screens/shielded/ShieldUnshieldScreen.tsx`, ensure these imports exist:

```ts
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../types/navigation';
```

Inside the `ShieldUnshieldScreen` function, near the top, add:

```ts
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

- [ ] **Step 5.4: Replace the Alert with navigation.navigate**

Replace the entire `Alert.alert(...)` block (lines roughly 127–135 — confirm exact range when editing) with:

```ts
navigation.navigate('ZkProofModal', {
  direction,
  amount: rawAmount,
  recipient: undefined,
});
```

Where `rawAmount` is the BigInt-as-string lamports value derived from the input. If the component currently stores `amount` as a decimal-input string, convert it first:

```ts
import {parseTokenAmount} from '../../utils/parseTokenAmount';

// inside the handler:
const rawAmount = parseTokenAmount(amount, 9).toString();
```

(SOL has 9 decimals; the conversion turns user-entered `"12.5"` into `"12500000000"`.)

- [ ] **Step 5.5: Type-check + run any existing ShieldUnshieldScreen tests**

Run:
```
npx tsc --noEmit 2>&1 | tail -5
npx jest src/screens/shielded/__tests__/ --passWithNoTests 2>&1 | tail -5
```
Expected: tsc clean. Jest passes (existing shielded tests + new ZkProof tests; ShieldUnshield has no current tests so the section is unaffected).

- [ ] **Step 5.6: Commit**

```bash
git add src/screens/shielded/ShieldUnshieldScreen.tsx
git commit -m "feat(#18): wire ShieldUnshield CTA to ZkProofModal (replace Alert)"
```

---

## Task 6: Acceptance — lint + suite + APK + smoke

- [ ] **Step 6.1: Lint clean**

Run: `npx eslint 'src/**/*.{ts,tsx}' '__mocks__/**/*.ts' 2>&1 | tail -5`
Expected: 0 errors.

- [ ] **Step 6.2: Full Jest suite green**

Run: `npx jest 2>&1 | tail -5`
Expected: 544+ tests pass (was 532 + 12 new).

- [ ] **Step 6.3: Type-check final**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 6.4: Rebuild bundle + APK**

```bash
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android && ./gradlew assembleDebug && cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk ~/Downloads/noctura-2026-05-30-devnet-screen18.apk
```

- [ ] **Step 6.5: Manual smoke (Android device / emulator)**

1. `adb uninstall com.nocturawallet`
2. `adb install ~/Downloads/noctura-2026-05-30-devnet-screen18.apk`
3. Restore from seed
4. Dashboard → tap Shielded toggle → ShieldedExplainer renders → tap Continue → ShieldUnshield (#16) renders
5. Enter amount (e.g. "1") → tap **Shield 1 SOL** button
6. **ZkProof screen renders:** state idle then transitions into "Building witness" with cpu hero, stage 1 active, percentage counter visible
7. After ~2s: state advances. Because local stub throws + hosted backend doesn't exist, chain fails → screen transitions to "Couldn't generate proof" with two CTAs
8. Tap **Retry locally** → returns to building state → same fail
9. Tap **Use Noctura hosted prover** → bottom sheet slides up with "Server SEES" / "Server CAN'T SEE" disclosure cards, opt-in caption, Proceed button
10. Tap **Proceed with hosted proof** → "Generating on hosted prover" hero → fails again → state 6 with new banner "Hosted prover also failed: <reason>"
11. Tap Android back during proving → confirm dialog "Cancel proof generation?"
12. Tap Android back from failed state → returns to ShieldUnshield #16 directly
13. Footer "FLAG_SECURE · screenshots blocked" always visible above sticky bar

Note on FLAG_SECURE: in debug build, `ScreenSecurityManager` no-ops (per existing escape hatch in `screenSecurityModule.ts:39`); the footer text is true intent but blocking only enforces in release builds. PR description should note this.

If any smoke step fails: file as follow-up task, do not patch under this plan unless trivial.

---

## Acceptance Criteria

- [ ] All 12 unit tests in `ZkProofScreen.test.tsx` pass (Task 3.2)
- [ ] `npx tsc --noEmit` clean (Task 6.3)
- [ ] `npx eslint 'src/**/*.{ts,tsx}' '__mocks__/**/*.ts'` 0 errors (Task 6.1)
- [ ] Manual smoke checklist (Task 6.5) passes all 13 steps
- [ ] APK at `~/Downloads/noctura-2026-05-30-devnet-screen18.apk` (Task 6.4)
