import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Redis from 'ioredis';
import cron from 'node-cron';
import { createLogger } from './logger.js';
import { queryRequestLogs } from './logQuery.js';
import { validateBody } from './validation/middleware.js';
import {
  serverPromptSchema,
  serverNewsletterSchema,
  serverAnalysisSchema,
} from './validation/schemas.js';

dotenv.config();

const app = express();

function sendSuccess(res, statusCode, data, meta = null) {
  return res.status(statusCode).json({
    data: data ?? null,
    meta: meta ?? null,
    error: null,
  });
}

function sendError(res, statusCode, code, message, details = null, meta = null) {
  return res.status(statusCode).json({
    data: null,
    meta: meta ?? null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

function normalizeError(err) {
  if (!err) return { code: 'UNKNOWN_ERROR', message: 'Unknown error' };
  if (typeof err === 'string') return { code: 'UNKNOWN_ERROR', message: err };
  if (err.code && err.message) {
    return {
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }
  if (err.message) {
    return { code: 'UNKNOWN_ERROR', message: err.message, details: err.details };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Unknown error', details: err?.details };
}

const PORT = process.env.PORT || 5174;

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in server environment. Exiting.');
  process.exit(1);
}

const SERVER_CLIENT_TOKEN = process.env.SERVER_CLIENT_TOKEN || null;
if (!SERVER_CLIENT_TOKEN) {
  console.warn(
    'WARNING: SERVER_CLIENT_TOKEN not set. Requests without Authorization will be rejected.'
  );
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CONSENT_VERSION = process.env.AI_CONSENT_VERSION || '2026-06-21';
const API_VERSION = 'v1';
const API_DEPRECATION_SUNSET = 'Wed, 31 Dec 2026 23:59:59 GMT';

// Initialize Redis client for quota tracking
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.warn('Redis connection error:', err.message);
  console.warn('Rate limiting quotas will be unavailable.');
});

redis.on('connect', () => {
  console.log('Connected to Redis for quota tracking');
});

// Schedule a midnight UTC job to clear yesterday's daily counters
cron.schedule(
  '0 0 * * *',
  async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // YYYY-MM-DD
      const pattern = `quota:daily:*:${yesterday}`;
      const keys = await redis.keys(pattern);
      if (keys && keys.length) {
        await redis.del(...keys);
        console.log(`Cleared ${keys.length} daily quota keys for ${yesterday}`);
      } else {
        console.log(`No daily quota keys to clear for ${yesterday}`);
      }
    } catch (err) {
      console.error('Error during scheduled daily quota reset:', err);
    }
  },
  { timezone: 'UTC' }
);

// In-memory request logging and error tracking
const MAX_LOG_ENTRIES = 1000;
const ERROR_THRESHOLD = 5; // errors that trigger blocking
const ERROR_WINDOW = 10 * 60 * 1000; // 10 minutes
const BLOCK_DURATION = 60 * 60 * 1000; // 1 hour

const requestLog = []; // FIFO log of requests
const ipErrorCounts = new Map(); // Track errors per IP within time window
const blockedIPs = new Map(); // Track blocked IPs with unblock time

function addToLog(entry) {
  requestLog.push(entry);
  if (requestLog.length > MAX_LOG_ENTRIES) {
    requestLog.shift(); // Remove oldest entry
  }
}

function trackError(ip) {
  const now = Date.now();
  if (!ipErrorCounts.has(ip)) {
    ipErrorCounts.set(ip, []);
  }

  const errors = ipErrorCounts.get(ip);
  errors.push(now);

  // Remove errors outside the time window
  const validErrors = errors.filter((timestamp) => now - timestamp < ERROR_WINDOW);
  ipErrorCounts.set(ip, validErrors);

  // Check if threshold exceeded and block the IP
  if (validErrors.length > ERROR_THRESHOLD) {
    const unblockTime = now + BLOCK_DURATION;
    blockedIPs.set(ip, unblockTime);
    console.warn(`IP ${ip} blocked for 1 hour due to ${validErrors.length} errors in 10 minutes`);
  }

  return validErrors.length;
}

function isIPBlocked(ip) {
  if (!blockedIPs.has(ip)) {
    return false;
  }

  const unblockTime = blockedIPs.get(ip);
  if (Date.now() > unblockTime) {
    blockedIPs.delete(ip);
    console.log(`IP ${ip} unblocked`);
    return false;
  }

  return true;
}

// Middleware to check if IP is blocked
function checkIPBlocklist(req, res, next) {
  // Prioritize X-Client-ID header, fall back to IP
  let clientIdentifier = req.get('X-Client-ID');
  if (!clientIdentifier || !isValidUUID(clientIdentifier)) {
    clientIdentifier = req.ip || req.connection.remoteAddress || 'unknown';
  }

  if (isIPBlocked(clientIdentifier)) {
    return sendError(res, 403, 'IP_BLOCKED', 'IP address blocked due to excessive errors');
  }
  next();
}

// Middleware to log requests and track errors
function requestLogger(req, res, next) {
  // Prioritize X-Client-ID header, fall back to IP
  let clientIdentifier = req.get('X-Client-ID');
  if (!clientIdentifier || !isValidUUID(clientIdentifier)) {
    clientIdentifier = req.ip || req.connection.remoteAddress || 'unknown';
  }

  const endpoint = req.path;
  const timestamp = new Date().toISOString();

  // Extract prompt length from body if present
  const promptLength = req.body?.prompt?.length || 0;

  // Log the request
  addToLog({
    ip: clientIdentifier,
    endpoint,
    timestamp,
    promptLength,
  });

  // Intercept the response to track errors
  const originalJson = res.json;
  res.json = function (data) {
    const statusCode = res.statusCode;

    // Track 4xx and 5xx errors (excluding 429 rate limit)
    if (statusCode >= 400 && statusCode < 600 && statusCode !== 429) {
      trackError(clientIdentifier);
    }

    return originalJson.call(this, data);
  };

  next();
}

app.use(checkIPBlocklist);
app.use(requestLogger);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '128kb' }));
app.use(['/api/generate/', `/api/${API_VERSION}/generate/`], (req, res, next) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.set('Pragma', 'no-cache');
  next();
});

// UUID validation regex (RFC 4122)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
  return UUID_REGEX.test(str);
}

// Basic rate limiting per IP to mitigate abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

function setApiVersionHeader(req, res, next) {
  res.set('API-Version', API_VERSION);
  next();
}

function setDeprecatedApiHeaders(successorPath) {
  return (req, res, next) => {
    res.set('API-Version', API_VERSION);
    res.set('Deprecation', 'true');
    res.set('Sunset', API_DEPRECATION_SUNSET);
    res.set('Link', `<${successorPath}>; rel="successor-version"`);
    next();
  };
}

app.use(`/api/${API_VERSION}`, setApiVersionHeader);
app.use(
  ['/api/generate/', '/api/health', '/api/usage', '/api/logs'],
  setDeprecatedApiHeaders(`/api/${API_VERSION}`)
);

// Apply auth requirement globally to /api/generate/* routes BEFORE route handlers
app.use(['/api/generate/', `/api/${API_VERSION}/generate/`], requireAuth);

// Stricter rate limiting for /api/generate/* routes
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = req.rateLimit.resetTime
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : 15 * 60;
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: retryAfter,
    });
  },
});

// Structured JSON logger for /api/generate/* routes
const generateLogger = createLogger();

// Redis quota tracking middleware for daily and monthly limits per IP
const DAILY_QUOTA = parseInt(process.env.DAILY_QUOTA || '100', 10);
const MONTHLY_QUOTA = parseInt(process.env.MONTHLY_QUOTA || '1000', 10);
const DAILY_TTL = 86400; // 24 hours in seconds
const MONTHLY_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

async function quotaMiddleware(req, res, next) {
  try {
    // Admin-bypass
    // If a valid admin token is provided, skip all quota checks entirely
    const adminToken = req.get('X-Admin-Token');
    if (adminToken && adminToken === process.env.ADMIN_TOKEN) {
      return next();
    }

    // Prioritize X-Client-ID header (session fingerprint), fall back to IP
    let quotaKey = req.get('X-Client-ID');
    if (!quotaKey || !isValidUUID(quotaKey)) {
      quotaKey = req.ip || req.connection.remoteAddress || 'unknown';
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

    const dailyKey = `quota:daily:${quotaKey}:${today}`;
    const monthlyKey = `quota:monthly:${quotaKey}:${monthKey}`;

    // Check if Redis is connected
    if (redis.status !== 'ready') {
      console.warn('Redis not ready, skipping quota check');
      return next();
    }

    // Use pipeline for atomic operations
    const pipeline = redis.pipeline();
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, DAILY_TTL);
    pipeline.incr(monthlyKey);
    pipeline.expire(monthlyKey, MONTHLY_TTL);

    const results = await pipeline.exec();

    if (!results) {
      console.warn('Redis pipeline failed');
      return next();
    }

    const [dailyIncr] = results[0];
    const [monthlyIncr] = results[2];

    // Check daily quota
    if (dailyIncr > DAILY_QUOTA) {
      const retryAfter = DAILY_TTL;
      return res.status(429).set('Retry-After', retryAfter.toString()).json({
        error: 'Daily quota exceeded',
        quotaLimit: DAILY_QUOTA,
        quotaUsed: dailyIncr,
        retryAfter: retryAfter,
      });
    }

    // Check monthly quota
    if (monthlyIncr > MONTHLY_QUOTA) {
      const retryAfter = MONTHLY_TTL;
      return res.status(429).set('Retry-After', retryAfter.toString()).json({
        error: 'Monthly quota exceeded',
        quotaLimit: MONTHLY_QUOTA,
        quotaUsed: monthlyIncr,
        retryAfter: retryAfter,
      });
    }

    // Attach quota info to request for logging
    req.quotaInfo = {
      daily: { used: dailyIncr, limit: DAILY_QUOTA },
      monthly: { used: monthlyIncr, limit: MONTHLY_QUOTA },
      quotaKey: quotaKey,
    };

    // Inform clients of their current quota status on every successful request
    res.set('X-RateLimit-Daily-Limit', DAILY_QUOTA);
    res.set('X-RateLimit-Daily-Remaining', Math.max(0, DAILY_QUOTA - dailyIncr));
    res.set('X-RateLimit-Monthly-Limit', MONTHLY_QUOTA);
    res.set('X-RateLimit-Monthly-Remaining', Math.max(0, MONTHLY_QUOTA - monthlyIncr));

    next();
  } catch (error) {
    console.error('Error in quota middleware:', error);
    // On error, allow the request to proceed (fail open)
    next();
  }
}

app.use('/api/', quotaMiddleware);

// Simple auth middleware: require a bearer token that matches SERVER_CLIENT_TOKEN
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer')
    return res.status(401).json({ error: 'Malformed Authorization header' });
  const token = parts[1];
  if (token !== SERVER_CLIENT_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function requireAiConsent(req, res, next) {
  if (req.get('X-AI-Consent') !== CONSENT_VERSION) {
    return res.status(428).json({ error: 'Current AI processing consent is required' });
  }
  next();
}

async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      topP: 0.95,
    },
  });
  return response.text || '';
}

// Utility function to strip non-printable characters
function stripNonPrintable(str) {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// Utility function to detect repeated word patterns (spam detection)
function hasSpamPatterns(str) {
  const words = str.toLowerCase().split(/\s+/);
  const wordCounts = new Map();

  for (const word of words) {
    if (word.length > 0) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      if (wordCounts.get(word) > 20) {
        return true; // Word appears more than 20 times
      }
    }
  }

  return false;
}

async function handleWebsiteGeneration(req, res) {
  try {
    const { prompt, outputFormat = 'html' } = req.validatedBody ?? req.body;
    const { prompt, outputFormat = 'html' } = req.body; // Default to 'html'

    // Validate prompt exists and is a string
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    // Check prompt length (max 5000 chars)
    if (prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt exceeds maximum length of 5000 characters' });
    }

    let cleanedPrompt = stripNonPrintable(prompt);

    if (hasSpamPatterns(cleanedPrompt)) {
      return sendError(res, 400, 'SPAM_DETECTED', 'Prompt contains repeated patterns indicating spam');
      return res.status(400).json({ error: 'Prompt contains repeated patterns indicating spam' });
    }

    // Validate outputFormat
    const allowedFormats = ['html', 'react', 'zip']; // Enabled 'zip' support
    if (!allowedFormats.includes(outputFormat)) {
      return res.status(400).json({
        error: `Unsupported output format: '${outputFormat}'. Allowed formats are: ${allowedFormats.join(', ')}`,
      });
    }

    let geminiPrompt = cleanedPrompt;
    // Prepend system instructions to guide Gemini based on the desired output format
    if (outputFormat === 'react') {
      geminiPrompt = `Generate a React functional component based on the following description. Ensure the component is self-contained and uses standard React practices. Only return the JSX/TSX code, no extra explanations or markdown formatting outside the component itself:\n\n${cleanedPrompt}`;
    } else if (outputFormat === 'html') {
      geminiPrompt = `Generate a complete HTML page based on the following description. Only return the HTML code, no extra explanations or markdown formatting outside the HTML itself:\n\n${cleanedPrompt}`;
    } else if (outputFormat === 'zip') {
      geminiPrompt = `Generate a complete website (HTML, CSS, and JS) based on: ${cleanedPrompt}. 
      Return the result ONLY as a valid JSON object where keys are filenames and values are the file contents.
      Example format: {"index.html": "...", "styles.css": "...", "script.js": "..."}
      Do not include any explanations or markdown formatting.`;
    }

    let generatedContent = await callGemini(geminiPrompt);

    // Handle potential JSON formatting in the response for 'zip' format
    if (outputFormat === 'zip') {
      try {
        // Strip markdown code blocks if Gemini includes them
        const cleanedContent = generatedContent.replace(/```json|```/g, '').trim();
        const files = JSON.parse(cleanedContent);
        return res.json({ zip: files });
      } catch (parseErr) {
        console.error('Failed to parse generated ZIP response');
        // Fallback: return as raw text if parsing fails, so the client can try to handle it
        return res.json({ zip: generatedContent, warning: 'Parsed as raw text' });
      }
    }

    // Return the generated content, using the outputFormat as the key in the JSON response
    return res.json({ [outputFormat]: generatedContent.trim() });
  } catch (err) {
    console.error('Website generation failed');
    return res.status(500).json({ error: 'Server error' });
  }
}

async function handleNewsletterGeneration(req, res) {
  try {
    const { prompt } = req.validatedBody ?? req.body;

    const text = await callGemini(prompt);
    return res.json({ text });
  } catch (err) {
    console.error('Newsletter generation failed');
    return res.status(500).json({ error: 'Server error' });
  }
}

async function handleAnalysisGeneration(req, res) {
  try {
    const { prompt } = req.validatedBody ?? req.body;

    const text = await callGemini(prompt);
    return res.json({ text });
  } catch (err) {
    console.error('Dashboard analysis failed');
    return res.status(500).json({ error: 'Server error' });
  }
}

function handleHealth(req, res) {
  return res.json({ ok: true, redis: redis.status });
}

// Usage endpoint: returns usage for provided X-Client-ID (must be valid UUID)
async function handleUsage(req, res) {
  try {
    const clientId = req.get('X-Client-ID');
    if (!clientId || !isValidUUID(clientId)) {
      return res.status(400).json({ error: 'Missing or invalid X-Client-ID header' });
    }

    if (redis.status !== 'ready') {
      console.warn('Redis not ready when fetching usage');
      return res.status(503).json({ error: 'Quota service unavailable' });
    }

    const today = new Date().toISOString().split('T')[0];
    const monthKey = new Date().toISOString().slice(0, 7);

    const dailyKey = `quota:daily:${clientId}:${today}`;
    const monthlyKey = `quota:monthly:${clientId}:${monthKey}`;

    const [dailyVal, monthlyVal] = await Promise.all([redis.get(dailyKey), redis.get(monthlyKey)]);

    const requestsToday = parseInt(dailyVal || '0', 10);
    const monthlyUsage = parseInt(monthlyVal || '0', 10);

    return res.json({
      requestsToday,
      dailyCap: DAILY_QUOTA,
      monthlyUsage,
      monthlyCap: MONTHLY_QUOTA,
    });
  } catch (err) {
    console.error('Error in /api/usage', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Admin endpoint to retrieve request logs and blocked IPs (no auth for monitoring)
function handleLogs(req, res) {
  try {
    const logQuery = queryRequestLogs(requestLog, req.query);
    return res.json({
      requestLog: logQuery.entries,
      logCount: logQuery.total,
      returned: logQuery.returned,
      limit: logQuery.limit,
      pagination: logQuery.pagination,
      filters: logQuery.filters,
      sort: logQuery.sort,
      blockedIPs: Array.from(blockedIPs.entries()).map(([ip, unblockTime]) => ({
        ip,
        unblockTime: new Date(unblockTime).toISOString(),
      })),
      errorCounts: Object.fromEntries(
        Array.from(ipErrorCounts.entries()).map(([ip, errors]) => [
          ip,
          { count: errors.length, window: '10 minutes' },
        ])
      ),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

app.post(`/api/${API_VERSION}/generate/website`, generateLimiter, generateLogger, validateBody(serverPromptSchema), handleWebsiteGeneration);
app.post('/api/generate/website', generateLimiter, generateLogger, validateBody(serverPromptSchema), handleWebsiteGeneration);
app.post(
  `/api/${API_VERSION}/generate/website`,
  generateLimiter,
  generateLogger,
  handleWebsiteGeneration
);
app.post('/api/generate/website', generateLimiter, generateLogger, handleWebsiteGeneration);

app.post(`/api/${API_VERSION}/generate/newsletter`, requireAiConsent, validateBody(serverNewsletterSchema), handleNewsletterGeneration);
app.post('/api/generate/newsletter', requireAiConsent, validateBody(serverNewsletterSchema), handleNewsletterGeneration);

app.post(`/api/${API_VERSION}/generate/analysis`, requireAiConsent, validateBody(serverAnalysisSchema), handleAnalysisGeneration);
app.post('/api/generate/analysis', requireAiConsent, validateBody(serverAnalysisSchema), handleAnalysisGeneration);

app.get(`/api/${API_VERSION}/health`, handleHealth);
app.get('/api/health', handleHealth);

app.get(`/api/${API_VERSION}/usage`, handleUsage);
app.get('/api/usage', handleUsage);

app.get(`/api/${API_VERSION}/logs`, handleLogs);
app.get('/api/logs', handleLogs);

app.listen(PORT, () => {
  console.log(`AI proxy server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (redis && redis.status === 'ready') {
    await redis.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (redis && redis.status === 'ready') {
    await redis.quit();
  }
  process.exit(0);
});
