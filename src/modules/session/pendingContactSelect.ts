import type {Contact} from '../addressBook/types';

/**
 * Cross-screen contact resolver — bridges the calling screen (typically Send
 * recipient row) and the AddressBook modal. Caller registers a pending
 * selection before opening the modal; on row tap the modal calls
 * `selectContact(c)`, on cancel/back it calls `cancelContactSelection()`.
 *
 * Singleton state · only one pending selection at a time. Any prior pending
 * promise is rejected with `null` when a new awaitContactSelection() lands.
 */

let pending: ((contact: Contact | null) => void) | null = null;

export function awaitContactSelection(): Promise<Contact | null> {
  if (pending) {
    pending(null);
    pending = null;
  }
  return new Promise<Contact | null>(resolve => {
    pending = resolve;
  });
}

export function selectContact(contact: Contact): void {
  if (pending) {
    pending(contact);
    pending = null;
  }
}

export function cancelContactSelection(): void {
  if (pending) {
    pending(null);
    pending = null;
  }
}

export function hasPendingContactSelection(): boolean {
  return pending !== null;
}
