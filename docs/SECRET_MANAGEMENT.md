# Secret Management & AI Gateway

Digital Ally keeps all AI secrets on the server. The browser never receives or stores the Gemini API key.

## Architecture

```text
Browser (React)                    Express AI Gateway                 Google Gemini
     │                                    │                                │
     │  POST /api/v1/ai/generate          │                                │
     │  Authorization: Bearer <token>     │  GEMINI_API_KEY (server/.env)  │
     │  X-Client-ID: <session-uuid>       │───────────────────────────────►│
     │  X-AI-Consent: <version>           │                                │
     │                                    │  audit log + quotas            │
```

## Secrets

| Secret | Location | Exposed to client? |
|--------|----------|-------------------|
| `GEMINI_API_KEY` | `server/.env` | **Never** |
| `SERVER_CLIENT_TOKEN` | `server/.env` + `VITE_SERVER_CLIENT_TOKEN` in root `.env` | Gateway token only (not an API key) |
| `ADMIN_TOKEN` | `server/.env` | **Never** |

## Centralized AI endpoint

All remote AI requests use a single gateway:

```http
POST /api/v1/ai/generate
Authorization: Bearer <SERVER_CLIENT_TOKEN>
X-Client-ID: <uuid>
X-AI-Consent: 2026-06-21
Content-Type: application/json

{
  "task": "website" | "newsletter" | "analysis",
  "prompt": "...",
  "outputFormat": "html"
}
```

Legacy per-task routes (`/api/v1/generate/website`, etc.) remain for backward compatibility.

## Server-managed configuration

Model selection and quotas are controlled via `server/.env`:

```env
GEMINI_MODEL_WEBSITE=gemini-2.5-flash
GEMINI_MODEL_NEWSLETTER=gemini-2.5-flash
GEMINI_MODEL_ANALYSIS=gemini-2.5-flash
GEMINI_TEMPERATURE=0.7
GEMINI_TOP_P=0.95
DAILY_QUOTA=100
MONTHLY_QUOTA=1000
```

Authenticated clients can read non-secret config:

```http
GET /api/v1/config
Authorization: Bearer <SERVER_CLIENT_TOKEN>
```

## Audit logging

Every AI request is logged with metadata only (no prompt or response bodies):

- Task, model, status code, duration, response size
- Client ID, consent version, quota usage

**View audit logs** (admin only):

```http
GET /api/v1/audit?limit=100&task=website
X-Admin-Token: <ADMIN_TOKEN>
```

Structured JSON is also written to stdout for log aggregation.

## Local development

1. Copy `server/.env.example` → `server/.env` and set secrets.
2. Copy `.env.example` → `.env` and set `VITE_SERVER_CLIENT_TOKEN` to the same value as `SERVER_CLIENT_TOKEN`.
3. Run `npm run start:server` and `npm run dev` (Vite proxies `/api` to the backend).

## Testing

```bash
npm test
```

Server config and audit log modules have dedicated unit tests in `server/`.
