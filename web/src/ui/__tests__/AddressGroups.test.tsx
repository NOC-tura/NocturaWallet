import {render} from '@testing-library/react';
import {AddressGroups} from '../AddressGroups';

const VAULT = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
// The address-poisoning account seen against this project in 2026-09. Never a payee.
const POISON = '6ZiahdPaj8K4gFNRdisMtZjzvDjje1bXdzWwkoSoo6Vd';

describe('AddressGroups', () => {
  it('copies as the exact address: no space characters in the text', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    expect(container.textContent).toBe(VAULT);
  });

  it('groups by four, every group the same element and class', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    const groups = Array.from(container.querySelectorAll('.addr-groups > span'));
    expect(groups.map(g => g.textContent)).toEqual(VAULT.match(/.{1,4}/g));
    expect(new Set(groups.map(g => `${g.tagName}.${g.className}`)).size).toBe(1);
  });

  it('emphasises nothing — the ends are exactly where a poisoning address matches', () => {
    const {container} = render(<AddressGroups address={VAULT} />);
    expect(container.querySelector('b, strong, em, mark')).toBeNull();
  });

  it('control: the vault and the poisoning address differ inside, not at the ends', () => {
    expect(VAULT.slice(0, 4)).toBe(POISON.slice(0, 4));
    expect(VAULT.slice(-4)).toBe(POISON.slice(-4));
    expect(VAULT).not.toBe(POISON);
  });
});
