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
  {
    ip: '10.0.0.3',
    endpoint: '/api/health',
    timestamp: '2026-06-27T13:00:00.000Z',
    promptLength: 5,
  },
];

test('returns the first offset-based page by default', () => {
  const result = queryRequestLogs(sampleLogs, { limit: '2' });

  assert.equal(result.pagination.mode, 'offset');
  assert.equal(result.pagination.offset, 0);
  assert.equal(result.pagination.nextOffset, 2);
  assert.equal(result.pagination.hasMore, true);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.map((entry) => entry.timestamp), [
    '2026-06-27T13:00:00.000Z',
    '2026-06-27T12:00:00.000Z',
  ]);
});

test('supports cursor-based pagination', () => {
  const firstPage = queryRequestLogs(sampleLogs, { limit: '2', sortOrder: 'desc' });
  const secondPage = queryRequestLogs(sampleLogs, {
    limit: '2',
    cursor: firstPage.pagination.nextCursor,
  });

  assert.equal(firstPage.pagination.hasMore, true);
  assert.equal(secondPage.pagination.mode, 'cursor');
  assert.equal(secondPage.pagination.offset, 2);
  assert.deepEqual(secondPage.entries.map((entry) => entry.timestamp), [
    '2026-06-27T11:00:00.000Z',
    '2026-06-27T10:00:00.000Z',
  ]);
});

test('supports offset-based pagination', () => {
  const result = queryRequestLogs(sampleLogs, { limit: '2', offset: '1' });

  assert.equal(result.pagination.mode, 'offset');
  assert.equal(result.pagination.offset, 1);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.map((entry) => entry.timestamp), [
    '2026-06-27T12:00:00.000Z',
    '2026-06-27T11:00:00.000Z',
  ]);
});

test('rejects mixed cursor and offset input', () => {
  assert.throws(() => {
    queryRequestLogs(sampleLogs, { cursor: 'MQ', offset: '1' });
  }, /Use either cursor or offset pagination/);
});
