import { describe, it, expect } from 'vitest';
import { sanitizePreviewHtml } from './sanitize';

describe('sanitizePreviewHtml lazy loading integration', () => {
  it('enhances images in sanitized preview HTML', () => {
    const raw = `<!DOCTYPE html><html><head></head><body><img src="https://example.com/photo.jpg" alt="Photo"></body></html>`;
    const { html } = sanitizePreviewHtml(raw);

    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('da-lazy-image');
  });
});
