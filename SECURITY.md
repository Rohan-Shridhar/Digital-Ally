# Security Policy

## Supported Versions

We currently support security fixes for the latest version on the default branch.

## Reporting a Vulnerability

Please do not open public issues for security reports. Instead, use GitHub
Security Advisories:

1. Go to the Security tab for this repository.
2. Click "Report a vulnerability".
3. Provide a clear description and steps to reproduce.

We will acknowledge receipt within 72 hours and work with you on a fix.

## Rate Limiting, Quotas, and Abuse Blocking

To protect the service, the server enforces both short-term rate limits and longer-term usage quotas, and will automatically block abusive clients.

- **Client identification:** The server prefers a client session fingerprint sent in the `X-Client-ID` HTTP header. The client should generate a UUID (via `crypto.randomUUID()`) and store it in `sessionStorage`. The server validates that header as a UUID and falls back to the request IP when the header is missing or invalid.
- **Short-term rate limiting (per-route):** The `/api/generate/*` routes use a 15-minute sliding window by default and allow up to 10 requests per client in that window. When the short-term rate limit is hit the server responds with HTTP 429 and a JSON body `{ "error": "Rate limit exceeded", "retryAfter": <seconds> }` and a `Retry-After` header with the number of seconds until the client may retry.
- **Global rate limiting:** A global limiter is also applied across API routes (for example to limit bursts). The exact global window and limit may be configured in environment variables or the server configuration.
- **Daily / Monthly quotas:** Longer-term quotas are tracked per `X-Client-ID` (or IP fallback) using Redis counters:
	- Daily quota key pattern: `quota:daily:{clientId}:{YYYY-MM-DD}` — default is 50 requests/day (`DAILY_QUOTA`). Keys are incremented and set with a TTL of 86400 seconds.
	- Monthly quota key pattern: `quota:monthly:{clientId}:{YYYY-MM}` — default is 500 requests/month (`MONTHLY_QUOTA`). These counters are used to enforce monthly caps.
	- When a quota is exceeded the server responds with HTTP 429 and JSON `{ "error": "Quota exceeded", "retryAfter": <seconds> }` and sets the `Retry-After` header.
- **Automated abuse blocking:** The server keeps a short in-memory rolling log of recent requests and errors. When a client (or IP) exhibits repeated malicious or spammy behavior (for example repeated prompt injection, spam patterns, or repeated quota/rate-limit breaches), the server may temporarily add that IP to an auto-blocklist. Blocked clients receive an error response and are prevented from making further requests until the block expires or is removed.
- **Redis and failure modes:** Redis is used to persist quota counters. If Redis is unavailable the server is configured to avoid hard-failing (fail-open) for user requests where appropriate and will log the condition. Administrative endpoints that read usage may return a 503 when Redis is unreachable.
- **Log inspection filters:** The `/api/logs` admin endpoint now accepts query parameters for server-side filtering and sorting. Supported filters include `ip`, `endpoint`, `since`, `until`, `minPromptLength`, and `maxPromptLength`. Supported sorting parameters are `sortBy` (`timestamp`, `promptLength`, `ip`, or `endpoint`), `sortOrder` (`asc` or `desc`), and `limit` to cap the number of returned records.
- **Log pagination:** The `/api/logs` admin endpoint supports offset-based pagination with `offset` and cursor-based pagination with `cursor`. The response includes pagination metadata such as `mode`, `offset`, `nextOffset`, `previousOffset`, `nextCursor`, `previousCursor`, and `hasMore`.

If you believe your client has been incorrectly blocked, please open a confidential support request through the repository Security contact with the following information:

- `X-Client-ID` value sent (if available)
- IP address of the request
- Timestamp of the request (UTC)
- Example request payload and response status

Administrators can inspect and manage the blocklist via server admin tooling or logs.
