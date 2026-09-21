import {useWallet} from '@solana/wallet-adapter-react';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';

export function ConnectPanel() {
  const {publicKey} = useWallet();
  return (
    <section>
      <WalletMultiButton />
      {publicKey ? <p>{publicKey.toBase58()}</p> : null}
      {/*
        Stated on the screen, not only in docs. There is no field here to type a
        recovery phrase into, which is what makes the sentence true rather than a
        promise — a phishing clone cannot claim the real site asks for one.
      */}
      <p>Noctura will never ask for your recovery phrase.</p>
    </section>
  );
}
