# Digital Ally Privacy and Data Retention Policy

Last updated: June 21, 2026

## Data flow

Digital Ally collects business details and instructions only when a user enters
them. The data remains in the current browser tab's React memory.

In **Remote AI** mode, the fields needed for a requested feature are assembled
into a prompt and sent over HTTPS to the Digital Ally AI proxy. The proxy
authenticates the request, verifies the current consent version, and forwards
the prompt to Google Gemini. The generated response returns to the browser.

In **Local only** mode, content is generated from deterministic browser
templates. The AI proxy and Gemini are not called.

## Storage and retention

- Form fields, prompts, and generated content: memory only; cleared by **Start
  over**, **Delete my data**, or closing the tab.
- Browser storage: only the selected processing mode, consent-policy version,
  and consent timestamp. **Delete my data** removes this metadata and the
  optional session token.
- Digital Ally server: request and response content is not written to files,
  databases, analytics, or application logs. Responses use `Cache-Control:
  no-store`.
- Provider processing: remote-mode content is processed by Google Gemini and is
  subject to the retention and usage terms of the configured Google service.
  Deployers must link their applicable Google terms before production use.

Because Digital Ally does not persist server logs containing user content,
there is no user-content log data at rest to encrypt. Infrastructure logs must
exclude request bodies and generated responses. If a deployment enables
persistent operational logs, it must use provider-managed encryption at rest,
limit logs to non-content metadata, restrict access, and delete them within 30
days.

## Consent and deletion

Remote processing is unavailable until the user explicitly selects **Allow
remote AI processing**. Consent is versioned and must be collected again when
this policy version changes. Users can switch to local-only processing or use
**Delete my data** at any time.

## Deployment controls

Set `AI_CONSENT_VERSION` on the server to the same value used by the client.
Serve the application and API only over HTTPS. Do not enable HTTP body logging.
