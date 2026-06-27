import test from 'node:test';
import assert from 'node:assert/strict';
import { queryRequestLogs } from './logQuery.js';

const sampleLogs = [
  {
    ip: '10.0.0.1',
    endpoint: '/api/generate/website',
    timestamp: '2026-06-27T10:00:00.000Z',
    promptLength: 120,
  },
  {
    ip: '10.0.0.2',
    endpoint: '/api/logs',
    timestamp: '2026-06-27T11:00:00.000Z',
    promptLength: 20,
  },
  {
    ip: '10.0.0.1',
    endpoint: '/api/generate/newsletter',
    timestamp: '2026-06-27T12:00:00.000Z',
    promptLength: 240,
  },
];

test('returns newest logs first by default', () => {
  const result = queryRequestLogs(sampleLogs, {});

  assert.equal(result.total, 3);
  assert.equal(result.returned, 3);
  assert.deepEqual(result.entries.map((entry) => entry.timestamp), [
    '2026-06-27T12:00:00.000Z',
    '2026-06-27T11:00:00.000Z',
    '2026-06-27T10:00:00.000Z',
  ]);
});

test('filters by ip and endpoint substring', () => {
  const result = queryRequestLogs(sampleLogs, {
    ip: '10.0.0.1',
    endpoint: 'newsletter',
  });

  assert.equal(result.total, 1);
  assert.equal(result.entries[0].endpoint, '/api/generate/newsletter');
});

test('filters by date range and prompt length', () => {
  const result = queryRequestLogs(sampleLogs, {
    since: '2026-06-27T10:30:00.000Z',
    until: '2026-06-27T12:30:00.000Z',
    minPromptLength: '100',
    maxPromptLength: '250',
  });

  assert.equal(result.total, 1);
  assert.equal(result.entries[0].promptLength, 240);
});

test('sorts by prompt length ascending', () => {
  const result = queryRequestLogs(sampleLogs, {
    sortBy: 'promptLength',
    sortOrder: 'asc',
  });

  assert.deepEqual(result.entries.map((entry) => entry.promptLength), [20, 120, 240]);
});

test('rejects invalid sort parameters', () => {
  assert.throws(() => {
    queryRequestLogs(sampleLogs, { sortBy: 'unknown' });
  }, /sortBy must be one of/);
});
