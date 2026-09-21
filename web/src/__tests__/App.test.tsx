import {render, screen} from '@testing-library/react';
import {App} from '../App';

it('renders the product name', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name: /noctura/i})).toBeTruthy();
});
