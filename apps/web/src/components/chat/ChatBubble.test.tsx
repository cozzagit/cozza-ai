import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatBubble } from './ChatBubble';

describe('ChatBubble', () => {
  it('renders user content as plain text', () => {
    render(<ChatBubble role="user" content="ciao" />);
    expect(screen.getByText('ciao')).toBeInTheDocument();
  });

  it('renders assistant content with markdown links', () => {
    render(<ChatBubble role="assistant" content="vai su [docs](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows blinking caret while streaming', () => {
    const { container } = render(
      <ChatBubble role="assistant" content="parziale" streaming />,
    );
    const caret = container.querySelector('span.animate-pulse');
    expect(caret).not.toBeNull();
  });

  it('does not render caret when not streaming', () => {
    const { container } = render(<ChatBubble role="assistant" content="completa" />);
    const caret = container.querySelector('span.animate-pulse');
    expect(caret).toBeNull();
  });
});
