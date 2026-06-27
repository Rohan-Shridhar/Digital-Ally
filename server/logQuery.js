const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 500;
const ALLOWED_SORT_FIELDS = new Set(['timestamp', 'promptLength', 'ip', 'endpoint']);

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value) {
  const normalized = firstQueryValue(value);
  if (normalized == null) {
    return '';
  }

  return String(normalized).trim();
}

function parseIntegerParam(value, name, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { value: null };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return { value: parsed };
}

function parseDateParam(value, name) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { value: null };
  }

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be a valid date or ISO timestamp`);
  }

  return { value: parsed };
}

function parseTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareValues(left, right, sortBy) {
  if (sortBy === 'timestamp') {
    return parseTimestamp(left.timestamp) - parseTimestamp(right.timestamp);
  }

  if (sortBy === 'promptLength') {
    return Number(left.promptLength || 0) - Number(right.promptLength || 0);
  }

  return String(left[sortBy] || '').localeCompare(String(right[sortBy] || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function queryRequestLogs(logs, query = {}) {
  const ip = normalizeString(query.ip);
  const endpoint = normalizeString(query.endpoint);
  const sortBy = normalizeString(query.sortBy) || 'timestamp';
  const sortOrder = normalizeString(query.sortOrder).toLowerCase() || 'desc';

  if (!ALLOWED_SORT_FIELDS.has(sortBy)) {
    throw new Error(`sortBy must be one of: ${Array.from(ALLOWED_SORT_FIELDS).join(', ')}`);
  }

  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new Error('sortOrder must be either asc or desc');
  }

  const { value: since } = parseDateParam(query.since, 'since');
  const { value: until } = parseDateParam(query.until, 'until');
  const { value: minPromptLength } = parseIntegerParam(query.minPromptLength, 'minPromptLength', {
    min: 0,
  });
  const { value: maxPromptLength } = parseIntegerParam(query.maxPromptLength, 'maxPromptLength', {
    min: 0,
  });
  const { value: limitValue } = parseIntegerParam(query.limit, 'limit', {
    min: 1,
    max: MAX_LOG_LIMIT,
  });

  const limit = limitValue ?? DEFAULT_LOG_LIMIT;
  const filtered = logs.filter((entry) => {
    if (ip && String(entry.ip || '') !== ip) {
      return false;
    }

    if (endpoint && !String(entry.endpoint || '').toLowerCase().includes(endpoint.toLowerCase())) {
      return false;
    }

    const entryTime = Date.parse(entry.timestamp || '');
    if (since !== null && (Number.isNaN(entryTime) || entryTime < since)) {
      return false;
    }

    if (until !== null && (Number.isNaN(entryTime) || entryTime > until)) {
      return false;
    }

    const promptLength = Number(entry.promptLength || 0);
    if (minPromptLength !== null && promptLength < minPromptLength) {
      return false;
    }

    if (maxPromptLength !== null && promptLength > maxPromptLength) {
      return false;
    }

    return true;
  });

  const direction = sortOrder === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((left, right) => {
    const baseComparison = compareValues(left, right, sortBy);
    if (baseComparison !== 0) {
      return baseComparison * direction;
    }

    return parseTimestamp(left.timestamp) - parseTimestamp(right.timestamp);
  });

  return {
    entries: sorted.slice(0, limit),
    total: sorted.length,
    returned: Math.min(sorted.length, limit),
    limit,
    filters: {
      ip: ip || null,
      endpoint: endpoint || null,
      since: since !== null ? new Date(since).toISOString() : null,
      until: until !== null ? new Date(until).toISOString() : null,
      minPromptLength,
      maxPromptLength,
    },
    sort: {
      by: sortBy,
      order: sortOrder,
    },
  };
}
