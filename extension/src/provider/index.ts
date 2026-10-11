import {registerWallet} from '@wallet-standard/wallet';
import {createBridge} from './bridge';
import {NocturaWallet} from './wallet';

/**
 * The MAIN-world content script (spec §1.1): registers the one wallet "Noctura" on every page, at document_start, top
 * frame only (the manifest). It reads nothing from the page and sends nothing unless the site asks the wallet.
 */
registerWallet(new NocturaWallet(createBridge(window)));
