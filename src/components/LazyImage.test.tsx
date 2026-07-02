import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LazyImage } from './LazyImage';

vi.mock('react-lazy-load-image-component', () => ({
  LazyLoadImage: ({
    src,
    alt,
    onError,
    className,
    loading,
    decoding,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    className?: string;
    loading?: 'lazy' | 'eager';
    decoding?: 'async' | 'auto' | 'sync';
  }) => (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      data-testid="lazy-image"
      onError={onError}
    />
  ),
}));

describe('LazyImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with lazy loading attributes', () => {
    render(<LazyImage src="/images/placeholder.svg" alt="Business photo" />);

    const image = screen.getByTestId('lazy-image');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('alt', 'Business photo');
  });

  it('switches to fallback image on error', async () => {
    render(<LazyImage src="/broken.jpg" alt="Broken" fallbackSrc="/images/fallback.svg" />);

    const image = screen.getByTestId('lazy-image');

    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });

    expect(screen.getByTestId('lazy-image')).toHaveAttribute('src', '/images/fallback.svg');
  });
});
