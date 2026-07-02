import { describe, it, expect } from 'vitest';
import { serverPromptSchema, serverNewsletterSchema, serverAnalysisSchema } from './schemas.js';

describe('server validation schemas', () => {
  it('validates website prompt', () => {
    expect(serverPromptSchema.safeParse({ prompt: 'Hello world' }).success).toBe(true);
  });

  it('defaults outputFormat to html', () => {
    const result = serverPromptSchema.safeParse({ prompt: 'Hello' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outputFormat).toBe('html');
    }
  });

  it('validates newsletter prompt length', () => {
    expect(serverNewsletterSchema.safeParse({ prompt: 'x'.repeat(8001) }).success).toBe(false);
  });

  it('validates analysis prompt length', () => {
    expect(serverAnalysisSchema.safeParse({ prompt: 'x'.repeat(15001) }).success).toBe(false);
  });
});
