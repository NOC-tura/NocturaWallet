import {initSecureMmkv, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {AddressBookManager} from '../addressBookModule';

describe('AddressBookManager', () => {
  let manager: AddressBookManager;

  beforeEach(() => {
    // Ensure a fresh secure store for each test
    initSecureMmkv('test-key');
    // Clear all data
    mmkvSecure()!.clearAll();
    manager = new AddressBookManager();
  });

  it('addContact stores a contact', () => {
    const contact = manager.addContact({
      name: 'Alice',
      address: 'So1an4addr11111111111111111111111111111111',
      addressType: 'transparent',
    });
    expect(contact.id).toBeTruthy();
    expect(contact.name).toBe('Alice');
    expect(contact.createdAt).toBeGreaterThan(0);

    // Verify it can be retrieved
    const all = manager.getContacts();
    expect(all).toHaveLength(1);
    expect(all[0].address).toBe('So1an4addr11111111111111111111111111111111');
  });

  it('getContacts returns all contacts sorted by lastUsedAt desc', () => {
    manager.addContact({
      name: 'Alice',
      address: 'addr1',
      addressType: 'transparent',
      lastUsedAt: 1000,
    });
    manager.addContact({
      name: 'Bob',
      address: 'addr2',
      addressType: 'transparent',
      lastUsedAt: 3000,
    });
    manager.addContact({
      name: 'Carol',
      address: 'addr3',
      addressType: 'shielded',
      lastUsedAt: 2000,
    });

    const contacts = manager.getContacts();
    expect(contacts).toHaveLength(3);
    expect(contacts[0].name).toBe('Bob');
    expect(contacts[1].name).toBe('Carol');
    expect(contacts[2].name).toBe('Alice');
  });

  it('findByAddress returns matching contact', () => {
    manager.addContact({
      name: 'Dave',
      address: 'targetAddress123',
      addressType: 'transparent',
    });
    const found = manager.findByAddress('targetAddress123');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Dave');
  });

  it('findByAddress returns null for unknown address', () => {
    const found = manager.findByAddress('nonexistentAddress');
    expect(found).toBeNull();
  });

  it('findByName returns partial case-insensitive matches', () => {
    manager.addContact({name: 'Alice Smith', address: 'addr1', addressType: 'transparent'});
    manager.addContact({name: 'Bob Jones', address: 'addr2', addressType: 'transparent'});
    manager.addContact({name: 'Alice Cooper', address: 'addr3', addressType: 'transparent'});

    const results = manager.findByName('alice');
    expect(results).toHaveLength(2);
    expect(results.map(c => c.name)).toContain('Alice Smith');
    expect(results.map(c => c.name)).toContain('Alice Cooper');
  });

  it('removeContact deletes by address', () => {
    manager.addContact({name: 'Eve', address: 'eveAddress', addressType: 'transparent'});
    expect(manager.getContacts()).toHaveLength(1);

    const removed = manager.removeContact('eveAddress');
    expect(removed).toBe(true);
    expect(manager.getContacts()).toHaveLength(0);
  });

  it('updateContact modifies fields (e.g., change name)', () => {
    manager.addContact({name: 'Frank', address: 'frankAddress', addressType: 'transparent'});
    const updated = manager.updateContact('frankAddress', {name: 'Franklin'});
    expect(updated.name).toBe('Franklin');
    expect(updated.address).toBe('frankAddress');

    const found = manager.findByAddress('frankAddress');
    expect(found!.name).toBe('Franklin');
  });

  it('Contacts stored with ADDRESS_BOOK_PREFIX key', () => {
    const contact = manager.addContact({
      name: 'Grace',
      address: 'graceAddress',
      addressType: 'shielded',
    });
    const store = mmkvSecure()!;
    const keys = store.getAllKeys();
    const contactKey = MMKV_KEYS.ADDRESS_BOOK_PREFIX + contact.id;
    expect(keys).toContain(contactKey);

    const raw = store.getString(contactKey);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.name).toBe('Grace');
  });
});
