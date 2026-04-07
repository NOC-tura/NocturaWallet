import {mmkvSecure} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import type {Contact} from './types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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

  importContacts(data: string): number {
    const imported = JSON.parse(data) as Contact[];
    let count = 0;
    for (const contact of imported) {
      if (!this.findByAddress(contact.address)) {
        const store = this.store();
        const saved: Contact = {
          id: contact.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2)),
          name: contact.name,
          address: contact.address,
          addressType: contact.addressType,
          memo: contact.memo,
          lastUsedAt: contact.lastUsedAt,
          createdAt: contact.createdAt ?? Date.now(),
        };
        const key = MMKV_KEYS.ADDRESS_BOOK_PREFIX + saved.id;
        store.set(key, JSON.stringify(saved));
        count++;
      }
    }
    return count;
  }
}

export const addressBook = new AddressBookManager();
