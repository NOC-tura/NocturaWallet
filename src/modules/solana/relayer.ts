import {PublicKey, AddressLookupTableAccount} from '@solana/web3.js';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';

interface RelayerTable {
  address: string;
  addresses: string[];
}

/**
 * Fetch pre-created Address Lookup Tables from the Noctura relayer.
 * Client does NOT create ALTs (privacy: ALT creation leaves on-chain trace).
 */
export async function getRelayerLookupTables(): Promise<AddressLookupTableAccount[]> {
  try {
    const response = await pinnedFetch(`${API_BASE}/v1/relayer/lookup-tables`);
    const data = (await response.json()) as {tables: RelayerTable[]};
    return data.tables.map(
      table => new AddressLookupTableAccount({
        key: new PublicKey(table.address),
        state: {
          addresses: table.addresses.map(a => new PublicKey(a)),
          deactivationSlot: BigInt('0xffffffffffffffff'), // u64::MAX — table is active
          lastExtendedSlot: 0,
          lastExtendedSlotStartIndex: 0,
        },
      }),
    );
  } catch {
    return [];
  }
}
