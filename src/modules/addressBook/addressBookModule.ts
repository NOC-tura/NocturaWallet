import {mmkvSecure} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import type {Contact} from './types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Validate a parsed object has the minimum required Contact fields. */
function isValidContactEntry(entry: unknown): entry is {name: string; address: string; addressType: string; memo?: string; lastUsedAt?: number; createdAt?: number} {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== 'string' || !e.name.trim()) return false;
  if (typeof e.address !== 'string' || !e.address.trim()) return false;
  if (typeof e.addressType !== 'string') return false;
  if (e.addressType !== 'transparent' && e.addressType !== 'shielded') return false;
  return true;
}

export class AddressBookManager {
  private store() {
    const s = mmkvSecure();
    if (!s) throw new Error('Secure MMKV not initialised');
    return s;
  }

  addContact(
    params: Omit<Contact, 'id' | 'createdAt'>,
  ): Contact {
    if (!params.name || !params.name.trim()) {
      throw new Error('Contact name is required');
    }
    if (!params.address || !params.address.trim()) {
      throw new Error('Contact address is required');
    }
    const contact: Contact = {
      ...params,
      id: generateId(),
      createdAt: Date.now(),
    };
    const key = MMKV_KEYS.ADDRESS_BOOK_PREFIX + contact.id;
    this.store().set(key, JSON.stringify(contact));
    return contact;
  }

  getContacts(): Contact[] {
    const store = this.store();
    const keys = store.getAllKeys().filter(k =>
      k.startsWith(MMKV_KEYS.ADDRESS_BOOK_PREFIX),
    );
    const contacts: Contact[] = [];
    for (const key of keys) {
      const raw = store.getString(key);
      if (raw) {
        try {
          contacts.push(JSON.parse(raw) as Contact);
        } catch {
          // skip malformed entries
        }
      }
    }
    // Sort by lastUsedAt descending; nulls/undefined go last
    contacts.sort((a, b) => {
      const aTime = a.lastUsedAt ?? 0;
      const bTime = b.lastUsedAt ?? 0;
      if (aTime === 0 && bTime === 0) return 0;
      if (aTime === 0) return 1;
      if (bTime === 0) return -1;
      return bTime - aTime;
    });
    return contacts;
  }

  findByAddress(address: string): Contact | null {
    const contacts = this.getContacts();
    return contacts.find(c => c.address === address) ?? null;
  }

  findByName(query: string): Contact[] {
    const lower = query.toLowerCase();
    return this.getContacts().filter(c =>
      c.name.toLowerCase().includes(lower),
    );
  }

  removeContact(address: string): boolean {
    const contact = this.findByAddress(address);
    if (!contact) return false;
    const key = MMKV_KEYS.ADDRESS_BOOK_PREFIX + contact.id;
    this.store().remove(key);
    return true;
  }

  updateContact(
    address: string,
    updates: Partial<Omit<Contact, 'id' | 'createdAt'>>,
  ): Contact {
    const contact = this.findByAddress(address);
    if (!contact) throw new Error(`Contact not found: ${address}`);
    const updated: Contact = {...contact, ...updates};
    const key = MMKV_KEYS.ADDRESS_BOOK_PREFIX + contact.id;
    this.store().set(key, JSON.stringify(updated));
    return updated;
  }

  exportContacts(): string {
    const contacts = this.getContacts();
    return JSON.stringify(contacts);
  }

  /**
   * Import contacts from JSON data.
   * Validates each entry against the Contact schema — rejects malformed entries.
   * Deduplicates by address. Max 1000 contacts per import.
   */
  importContacts(data: string): number {
    const raw = JSON.parse(data) as unknown;
    if (!Array.isArray(raw)) {
      throw new Error('Import data must be a JSON array');
    }
    const MAX_IMPORT = 1000;
    if (raw.length > MAX_IMPORT) {
      throw new Error(`Import exceeds maximum of ${MAX_IMPORT} contacts`);
    }

    const store = this.store();
    let count = 0;

    for (const entry of raw) {
      if (!isValidContactEntry(entry)) continue; // skip malformed
      if (this.findByAddress(entry.address)) continue; // skip duplicate

      const saved: Contact = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        name: String(entry.name),
        address: String(entry.address),
        addressType: entry.addressType === 'shielded' ? 'shielded' : 'transparent',
        memo: typeof entry.memo === 'string' ? entry.memo : undefined,
        lastUsedAt: typeof entry.lastUsedAt === 'number' ? entry.lastUsedAt : undefined,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
      };
      const key = MMKV_KEYS.ADDRESS_BOOK_PREFIX + saved.id;
      store.set(key, JSON.stringify(saved));
      count++;
    }
    return count;
  }
}

export const addressBook = new AddressBookManager();
