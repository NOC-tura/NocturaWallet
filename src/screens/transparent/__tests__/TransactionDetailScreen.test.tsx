import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {readFileSync} from 'fs';
import {join} from 'path';
import {TransactionDetailScreen} from '../TransactionDetailScreen';
import {parseTxDetail} from '../../../modules/solana/txDetail';
import type {RawParsedTx} from '../../../modules/solana/txDetail';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

// post-M1d §5: the new TxDetail shape (transfer, feePayer, signers), switchable per test
const SENT_SPL = {
  signature: 'SIG12345678ABCDEFGHIJ', status: 'confirmed' as const,
  transfer: {
    mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs', symbol: 'TEST', amount: '0.0002',
    from: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', authority: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4',
    fromTokenAccount: '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2',
    to: 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B', toIsTokenAccount: false, toTokenAccount: 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7',
  },
  feePayer: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', signers: ['9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4'],
  feeLamports: 7000n, slot: 525080588, blockTime: 1760000000, memo: null,
};
const mockDetail: {current: unknown} = {current: SENT_SPL};
jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionDetail: jest.fn(() => ({data: mockDetail.current, isLoading: false})),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) =>
    selector({mode: 'transparent'}),
  ),
}));

jest.mock('../../../utils/explorerUrl', () => ({
  getExplorerUrl: jest.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));

jest.mock('../../../modules/addressBook/addressBookModule', () => ({
  addressBook: {
    addContact: jest.fn(),
    findByAddress: jest.fn().mockReturnValue(null),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function withSafeArea(node: React.ReactElement) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: {top: 0, bottom: 0, left: 0, right: 0},
        frame: {x: 0, y: 0, width: 0, height: 0},
      }}>
      {node}
    </SafeAreaProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const ACC = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

beforeEach(() => {
  mockDetail.current = SENT_SPL;
});

it('renders the tx detail (amount, status, fee)', () => {
  const {getByText, getAllByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText('0.0002 TEST')).toBeTruthy(); // post-M1d §5: the new fixture's amount and trusted symbol
  // "Confirmed" appears in both the status pill and the Status detail row
  expect(getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
  expect(getByText('Network fee')).toBeTruthy();
});

it('renders type and hash detail rows', () => {
  const {getByText, getAllByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Type')).toBeTruthy();
  // post-M1d §5: the hero word and the Type row now read the same direction word
  expect(getAllByText('Sent')).toHaveLength(2);
  expect(getByText('Hash')).toBeTruthy();
});

it('renders "Transaction" heading in top bar', () => {
  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Transaction')).toBeTruthy();
});

it('calls onBack when back button is pressed', () => {
  const onBack = jest.fn();
  const {getByLabelText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={onBack} />,
    ),
  );
  fireEvent.press(getByLabelText('Go back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('renders loading state when isLoading is true', () => {
  const {useTransactionDetail} = jest.requireMock('../../../hooks/useSolanaQueries') as {
    useTransactionDetail: jest.Mock;
  };
  useTransactionDetail.mockReturnValueOnce({data: undefined, isLoading: true});

  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Loading transaction…')).toBeTruthy();
});

it('renders not-found state when data is null', () => {
  const {useTransactionDetail} = jest.requireMock('../../../hooks/useSolanaQueries') as {
    useTransactionDetail: jest.Mock;
  };
  useTransactionDetail.mockReturnValueOnce({data: null, isLoading: false});

  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText("Couldn't load this transaction")).toBeTruthy();
});

it('renders "Save to address book" button when tx.to is present', () => {
  const {getByText} = render(
    withSafeArea(
      <TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />,
    ),
  );
  expect(getByText('Save to address book')).toBeTruthy();
});

describe('post-M1d §5 — #27 names the token, the wallet and the direction', () => {
  const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const screen = (account: string | null) =>
    render(withSafeArea(<TransactionDetailScreen signature="SIG12345678ABCDEFGHIJ" account={account} onBack={jest.fn()} />));

  it('the phone-pass case: "Sent", "0.0002 TEST", TO = the main wallet (not the token account)', () => {
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83/); // the wallet's head
    expect(r.queryByText('token account')).toBeNull();
    expect(r.getByTestId('tx-detail-to')).not.toHaveTextContent(/A3hW/); // never the token account's head
  });

  it('R9: the same transaction opened from the MAIN account reads "Received"', () => {
    expect(screen(MAIN).getByTestId('tx-detail-direction')).toHaveTextContent('Received');
  });

  it('a third party, or no account (a deep link) → "Transaction": no direction claimed', () => {
    expect(screen('EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk').getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(screen(null).getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('R11: the owner unknown → the token account, labelled "token account"; it is not offered as a contact', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, to: SENT_SPL.transfer.toTokenAccount, toIsTokenAccount: true}};
    const r = screen(ACC);
    expect(r.getByText('token account')).toBeTruthy();
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  it('R8: an untrusted mint shows whatever symbol the parser resolved (the short mint) after the amount', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, symbol: 'ScamMi…1111'}};
    expect(screen(ACC).getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 ScamMi…1111');
  });

  it('no human amount known → "—", never a raw figure', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, amount: null, symbol: '', mint: null}};
    expect(screen(ACC).getByTestId('tx-detail-amount')).toHaveTextContent('—');
  });

  it('R12: no transfer → the row reads "Fee payer", never "From"; no To, no contact button', () => {
    mockDetail.current = {...SENT_SPL, transfer: null};
    const r = screen(ACC);
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(r.queryByText('From')).toBeNull();
    expect(r.queryByText('Save to address book')).toBeNull();
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('review r1-2: a FAILED transaction reads "Transaction" for its own sender — never "Sent"; the Failed pill shows', () => {
    mockDetail.current = {...SENT_SPL, status: 'failed' as const};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(r.queryByText('Sent')).toBeNull();
    expect(r.getAllByText('Failed').length).toBeGreaterThan(0);
  });

  it('review r1-10: an ordinary send (authority = owner) has no "Authorized by" row', () => {
    expect(screen(ACC).queryByText('Authorized by')).toBeNull();
  });

  it('review r1-10: a delegated transfer shows the owner as From and adds "Authorized by <the delegate>"; not "Sent" for the owner', () => {
    const DELEGATE = 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, authority: DELEGATE}, signers: [DELEGATE], feePayer: DELEGATE};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/); // the owner
    expect(r.getByText('Authorized by')).toBeTruthy();
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^DLGTxx/);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('review r1-10: the owner unknown → From "—", and the authority is shown as "Authorized by", not as From', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, from: null}};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent('—');
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^9Y7Ftt/);
  });

  it('a received transaction does not offer to save one\'s own account as a contact', () => {
    expect(screen(MAIN).queryByText('Save to address book')).toBeNull();
  });
});

// Task 8 fix round 1 (Important): the wrap step of a SOL→X swap, parsed by the REAL parser from the real devnet
// response 5i53q9tR… with its transferChecked replaced by a system transfer of 100000000 lamports from 9Y7Ftt…
// to its own token account 3Wzwve… (index 1, owner 9Y7Ftt…). The token account is never offered as a wallet.
describe('fix round 1 — a SOL transfer into a token account', () => {
  const SRC_TA = '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2';
  const wrapDetail = (opts: {dropOwners?: boolean} = {}) => {
    const tx = (
      JSON.parse(readFileSync(join(__dirname, '../../../modules/solana/__tests__/fixtures/tx-test-to-outside.json'), 'utf8')) as {
        result: RawParsedTx;
      }
    ).result;
    const ixs = tx.transaction!.message!.instructions as Array<{program?: string; parsed?: {type?: string; info?: unknown}}>;
    const i = ixs.findIndex(x => x.parsed?.type === 'transferChecked');
    ixs[i] = {program: 'system', parsed: {type: 'transfer', info: {source: ACC, destination: SRC_TA, lamports: 100000000}}};
    if (opts.dropOwners === true) {
      for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
        delete b.owner; // removed: `owner`
      }
    }
    return parseTxDetail(tx, 'SIG', m => (m === 'native' ? 'SOL' : m));
  };

  it('opened from the owner: "Sent", 0.1 SOL, To = the owner wallet (not 3Wzwve…), no "Save to address book"', () => {
    mockDetail.current = wrapDetail();
    const r = render(withSafeArea(<TransactionDetailScreen signature="SIG" account={ACC} onBack={jest.fn()} />));
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.1 SOL');
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByTestId('tx-detail-to')).not.toHaveTextContent(/3Wzwve/);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  it('the owner unknown: the token account is labelled "token account" and is not offered as a contact', () => {
    mockDetail.current = wrapDetail({dropOwners: true});
    const r = render(withSafeArea(<TransactionDetailScreen signature="SIG" account={null} onBack={jest.fn()} />));
    expect(r.getByText('token account')).toBeTruthy();
    expect(r.queryByText('Save to address book')).toBeNull();
  });
});
