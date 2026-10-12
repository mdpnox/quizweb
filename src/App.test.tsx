import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ezQuiz title', () => {
  render(<App />);
  const titleElement = screen.getByText(/ezQuiz - Nối Từ Vựng Tiếng Anh/i);
  expect(titleElement).toBeInTheDocument();
});
