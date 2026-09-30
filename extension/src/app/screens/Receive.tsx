import {useEffect, useState} from 'react';
import {useWallet} from '../WalletContext';
import {parseAmount, formatAmount} from '../../shared/amount';
import {shortAddress, showUsd} from '../format';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {QrCode} from '../ui/QrCode';
import {Toast} from '../ui/Toast';
import {ExtIcon} from '../ui/ExtIcon';
import {useCopy} from '../ui/useCopy';

/** The pay request's QR is rebuilt this long after the last keystroke. */
export const QR_DEBOUNCE_MS = 200;

/** The field as a request: a positive SOL amount in lamports, or null (no request). */
const requestOf = (text: string): bigint | null => {
  const v = parseAmount(text, 9);
  return v !== null && v > 0n ? v : null;
};
const uriOf = (address: string, amount: bigint | null): string => (amount === null ? `solana:${address}` : `solana:${address}?amount=${formatAmount(amount, 9, {min: 0, max: 9})}&label=Noctura`);

/**
 * #13 receive (spec §5.3). Share is copy only (D19); the clipboard is never cleared (spec §4); the
 * shielded payment code is hidden (D4); the amount request is SOL only, as the design draws it.
 * Works offline (D36): the address is local, only the fiat line needs a price.
 */
export function Receive({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const address = m.account?.publicKey ?? '';
  const [text, setText] = useState('');
  const [amount, setAmount] = useState<bigint | null>(null);
  const [copy, doCopy] = useCopy();
  const [toast, setToast] = useState(false);

  // 200 ms after the last keystroke, the request (and its QR) follows the field.
  useEffect(() => {
    const t = setTimeout(() => setAmount(requestOf(text)), QR_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const decimal = amount === null ? null : formatAmount(amount, 9, {min: 0, max: 9});
  const uri = uriOf(address, amount);
  const shownUri = amount === null ? `solana:${shortAddress(address)}` : `solana:${shortAddress(address)}?amount=${decimal}`;
  const fiat = amount === null || m.prices?.sol == null || m.net.mode === 'offline' ? '—' : showUsd((Number(amount) / 1e9) * m.prices.sol);

  useEffect(() => {
    if (copy === 'copied') setToast(true);
  }, [copy]);

  /**
   * The sticky button copies the field as it reads NOW (final review M2), not the request debounced
   * for the QR: a copy within QR_DEBOUNCE_MS of a keystroke must not carry the previous amount. No
   * request in the field → the bare address, as the button's idle label says.
   */
  const copyRequest = () => {
    const now = requestOf(text);
    doCopy(now === null ? address : uriOf(address, now));
  };
  const copied = copy === 'copied';
  const buttonText = copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Copy failed' : amount === null ? 'Copy address' : 'Copy link';
  return (
    <div className="screen s-recv">
      <TopBar title="Receive" onBack={onBack} />
      <div className="scroll">
        <div className="mode-strip noc-overline">Public address</div>
        <div className="qr-card">
          {amount === null ? null : (
            <div className="pay-ribbon">
              PAY · <b>{formatAmount(amount, 9, {min: 6, max: 9})} SOL</b>
            </div>
          )}
          <div className="qr">
            <QrCode value={uri} label="QR code for receive" />
            <div className="center" aria-hidden="true">
              N
            </div>
          </div>
          <div className="noc-caption app-muted">
            URI · <span className="noc-mono">{shownUri}</span>
          </div>
        </div>
        <button type="button" className="addr-card app-addr-card" onClick={() => doCopy(address)} aria-label="Copy wallet address">
          <div className="lbl noc-overline">
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'WALLET ADDRESS'}</span>
            <span className="noc-caption app-muted">{copied ? 'Noctura does not clear it afterwards.' : 'tap to copy'}</span>
          </div>
          <div className="addr noc-body-sm">
            <AddressGroups address={address} />
          </div>
        </button>
        <div className="amount-card">
          <div className="head">
            <span className="noc-overline">{amount === null ? 'Request amount (optional)' : 'Requested amount'}</span>
            {text === '' ? null : (
              <button type="button" className="clear-x" aria-label="Clear amount" onClick={() => setText('')}>
                <ExtIcon name="close" size={14} />
              </button>
            )}
          </div>
          <div className="input">
            <input className="app-amount-input noc-numeral" inputMode="decimal" aria-label="Request amount" placeholder="0.0" value={text} onChange={e => setText(e.target.value.trim())} />
            <span className="ticker">{amount === null ? 'SOL' : `SOL · ≈ ${fiat}`}</span>
          </div>
        </div>
      </div>
      <div className="sticky-bar">
        <button type="button" className="btn btn-primary" onClick={copyRequest}>
          <ExtIcon name={copy === 'failed' ? 'close' : 'check'} size={18} />
          {buttonText}
        </button>
      </div>
      {toast ? <Toast text="Copied. Noctura does not clear your clipboard." onDone={() => setToast(false)} /> : null}
    </div>
  );
}
