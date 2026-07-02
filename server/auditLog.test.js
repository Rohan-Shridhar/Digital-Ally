import { describe, it, expect } from 'vitest';
import { recordAuditEvent, queryAuditLog } from './auditLog.js';

describe('auditLog', () => {
  it('records metadata-only audit events', () => {
    const entry = recordAuditEvent({
      event: 'ai.request',
      task: 'website',
      statusCode: 200,
      promptLength: 120,
      responseSizeBytes: 4096,
    });

    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.task).toBe('website');
  });

  it('filters audit log by task', () => {
    recordAuditEvent({ event: 'ai.request', task: 'newsletter', statusCode: 200 });
    const result = queryAuditLog({ task: 'newsletter', limit: 10 });
    expect(result.entries.every((e) => e.task === 'newsletter')).toBe(true);
  });
});
