import DOMPurify from 'dompurify';

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src https:;">`;

const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'link',
    'meta',
    'base',
  ],
  FORBID_ATTR: [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'action',
    'formaction',
    'srcdoc',
    'data',
  ],
  FORCE_BODY: false,
};

export interface SanitizeResult {
  html: string;
  hadUnsafeContent: boolean;
}

export function sanitizePreviewHtml(raw: string): SanitizeResult {
  const clean = DOMPurify.sanitize(raw.trim(), PURIFY_CONFIG) as string;
  const hadUnsafeContent = DOMPurify.removed.length > 0;

  const withCsp = clean.includes('<head')
    ? clean.replace(/(<head[^>]*>)/i, `$1${CSP_META}`)
    : CSP_META + clean;

  return { html: withCsp, hadUnsafeContent };
}
