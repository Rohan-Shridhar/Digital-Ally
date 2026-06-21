import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in server environment. Exiting.');
  process.exit(1);
}

const SERVER_CLIENT_TOKEN = process.env.SERVER_CLIENT_TOKEN || null;
if (!SERVER_CLIENT_TOKEN) {
  console.warn('WARNING: SERVER_CLIENT_TOKEN not set. Requests without Authorization will be rejected.');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  if (isIPBlocked(clientIp)) {
    return res.status(403).json({ error: 'IP address blocked due to excessive errors' });
  }
  next();
}

// Middleware to log requests and track errors
function requestLogger(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const endpoint = req.path;
  const timestamp = new Date().toISOString();
  
  // Extract prompt length from body if present
  const promptLength = req.body?.prompt?.length || 0;

  // Log the request
  addToLog({
    ip: clientIp,
    endpoint,
    timestamp,
    promptLength,
  });

  // Intercept the response to track errors
  const originalJson = res.json;
  res.json = function (data) {
    const statusCode = res.statusCode;
    
    // Track 4xx and 5xx errors (excluding 429 rate limit)
    if ((statusCode >= 400 && statusCode < 600) && statusCode !== 429) {
      trackError(clientIp);
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

// Basic rate limiting per IP to mitigate abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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

// Redis quota tracking middleware for daily and monthly limits per IP
const DAILY_QUOTA = parseInt(process.env.DAILY_QUOTA || '100', 10);
const MONTHLY_QUOTA = parseInt(process.env.MONTHLY_QUOTA || '1000', 10);
const DAILY_TTL = 86400; // 24 hours in seconds
const MONTHLY_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

async function quotaMiddleware(req, res, next) {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

    const dailyKey = `quota:daily:${clientIp}:${today}`;
    const monthlyKey = `quota:monthly:${clientIp}:${monthKey}`;

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
      return res
        .status(429)
        .set('Retry-After', retryAfter.toString())
        .json({
          error: 'Daily quota exceeded',
          quotaLimit: DAILY_QUOTA,
          quotaUsed: dailyIncr,
          retryAfter: retryAfter,
        });
    }

    // Check monthly quota
    if (monthlyIncr > MONTHLY_QUOTA) {
      const retryAfter = MONTHLY_TTL;
      return res
        .status(429)
        .set('Retry-After', retryAfter.toString())
        .json({
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
      ip: clientIp,
    };

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
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Malformed Authorization header' });
  const token = parts[1];
  if (token !== SERVER_CLIENT_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  next();
}

async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      topP: 0.95,
    }
  });
  return response.text || '';
}

app.post('/api/generate/website', generateLimiter, requireAuth, async (req, res) => {
  try {
    const { prompt, outputFormat = 'html' } = req.body; // Default to 'html'
    if (!prompt || typeof prompt !== 'string' || prompt.length > 10000) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    // Validate outputFormat
    const allowedFormats = ['html', 'react', 'zip']; // Enabled 'zip' support
    if (!allowedFormats.includes(outputFormat)) {
      return res.status(400).json({ error: `Unsupported output format: '${outputFormat}'. Allowed formats are: ${allowedFormats.join(', ')}` });
    }

    let geminiPrompt = prompt;
    // Prepend system instructions to guide Gemini based on the desired output format
    if (outputFormat === 'react') {
      geminiPrompt = `Generate a React functional component based on the following description. Ensure the component is self-contained and uses standard React practices. Only return the JSX/TSX code, no extra explanations or markdown formatting outside the component itself:\n\n${prompt}`;
    } else if (outputFormat === 'html') {
      geminiPrompt = `Generate a complete HTML page based on the following description. Only return the HTML code, no extra explanations or markdown formatting outside the HTML itself:\n\n${prompt}`;
    } else if (outputFormat === 'zip') {
      geminiPrompt = `Generate a complete website (HTML, CSS, and JS) based on: ${prompt}. 
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
        console.error('Failed to parse ZIP JSON from Gemini', parseErr);
        // Fallback: return as raw text if parsing fails, so the client can try to handle it
        return res.json({ zip: generatedContent, warning: 'Parsed as raw text' });
      }
    }

    // Return the generated content, using the outputFormat as the key in the JSON response
    return res.json({ [outputFormat]: generatedContent.trim() });
  } catch (err) {
    console.error('Error in /api/generate/website', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/generate/newsletter', generateLimiter, requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 8000) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    const text = await callGemini(prompt);
    return res.json({ text });
  } catch (err) {
    console.error('Error in /api/generate/newsletter', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/generate/analysis', generateLimiter, requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 15000) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    const text = await callGemini(prompt);
    return res.json({ text });
  } catch (err) {
    console.error('Error in /api/generate/analysis', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, redis: redis.status }));

// Admin endpoint to retrieve request logs and blocked IPs (no auth for monitoring)
app.get('/api/logs', (req, res) => {
  res.json({
    requestLog: requestLog.slice(-100), // Last 100 entries
    logCount: requestLog.length,
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
});

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
