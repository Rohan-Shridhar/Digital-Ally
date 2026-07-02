import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getServerConfig, getModelForTask, getPublicConfig, AI_TASKS } from './config.js';

describe('server config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_MODEL = 'gemini-test';
    process.env.GEMINI_MODEL_WEBSITE = 'gemini-website';
    process.env.DAILY_QUOTA = '25';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('exposes per-task model selection', () => {
    expect(getModelForTask('website')).toBe('gemini-website');
    expect(getModelForTask('newsletter')).toBe('gemini-test');
  });

  it('returns public config without secrets', () => {
    const pub = getPublicConfig();
    expect(pub.models.website).toBe('gemini-website');
    expect(pub.quotas.daily).toBe(25);
    expect(pub.tasks).toEqual(AI_TASKS);
    expect(pub).not.toHaveProperty('apiKey');
  });
});
