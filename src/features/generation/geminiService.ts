import {
  PROMPT_TEMPLATE,
  NEWSLETTER_PROMPT_TEMPLATE,
  DASHBOARD_ANALYSIS_PROMPT_TEMPLATE,
  LANGUAGES,
} from '@/shared/constants';
import { CONSENT_VERSION, loadPrivacyPreference } from '@/shared/privacy';

interface WebsiteParams {
    description: string;
    userName: string;
    businessName: string;
    userEmail: string;
    userPhone: string;
    paletteName: string;
    paletteDetails: string;
    modificationPrompt?: string;
    services?: string;
    location?: string;
    themeColor?: string;
  description: string;
  userName: string;
  businessName: string;
  userEmail: string;
  userPhone: string;
  paletteName: string;
  paletteDetails: string;
  modificationPrompt?: string;
}

interface NewsletterParams {
  description: string;
  businessName: string;
}

interface DashboardAnalysisParams {
  dashboardData: string;
  language: string;
}

const CLIENT_ID_KEY = 'x-client-id';

// Generate or retrieve session fingerprint
function getOrCreateClientID(): string {
  if (typeof window === 'undefined') return '';

  const stored = sessionStorage.getItem(CLIENT_ID_KEY);
  if (stored) return stored;

  // Generate new UUID for this session
  const clientID = crypto.randomUUID();
  sessionStorage.setItem(CLIENT_ID_KEY, clientID);
  return clientID;
}

const cleanResponse = (text: string): string => {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```html')) {
    cleanedText = cleanedText.substring(7, cleanedText.length - 3).trim();
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.substring(3, cleanedText.length - 3).trim();
  }
  return cleanedText;
};

async function callProxy(endpoint: string, body: any) {
  const preference = loadPrivacyPreference();
  if (!preference) throw new Error('Choose a privacy setting before using AI features.');
  if (preference.mode === 'local') throw new Error('Remote AI is disabled in local-only mode.');

  const token = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-AI-Consent': CONSENT_VERSION,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) throw new Error('Unauthorized: server requires authentication.');

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const errorMsg = `RATE_LIMIT_429|${retryAfter || '900'}`;
    throw new Error(errorMsg);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Server error: ${err}`);
  }

  const data = await res.json();
  // New envelope contract: { data, meta, error }
  if (data?.error?.message) {
    throw new Error(data.error.message);
  }
  return data;
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] || character
  );

function localWebsite(params: WebsiteParams): string {
  const title = escapeHtml(params.businessName);
  const description = escapeHtml(params.description);
  const owner = escapeHtml(params.userName);
  const email = escapeHtml(params.userEmail);
  const phone = escapeHtml(params.userPhone);
  const modification = params.modificationPrompt
    ? `<p class="note"><strong>Requested update:</strong> ${escapeHtml(params.modificationPrompt)}</p>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0;font-family:system-ui,sans-serif;color:#183028;background:#f6fff4}main{max-width:900px;margin:auto;padding:64px 24px}
section{background:white;padding:40px;border-radius:20px;box-shadow:0 12px 40px #18302818}h1{font-size:clamp(2.5rem,8vw,5rem);margin:0;color:#166534}
p{font-size:1.1rem;line-height:1.7}.contact{margin-top:32px;padding-top:24px;border-top:1px solid #d1fae5}.note{background:#ecfccb;padding:16px;border-radius:12px}
a{color:#166534}</style></head><body><main><section><p>Welcome to</p><h1>${title}</h1><p>${description}</p>${modification}
<div class="contact"><strong>${owner}</strong><br><a href="mailto:${email}">${email}</a><br><a href="tel:${phone}">${phone}</a></div>
</section></main></body></html>`;
}

export async function generateWebsite(
    { description, userName, businessName, userEmail, userPhone, paletteName, paletteDetails, modificationPrompt, services, location, themeColor }: WebsiteParams
): Promise<string> {
    if (loadPrivacyPreference()?.mode === 'local') {
        return localWebsite({ description, userName, businessName, userEmail, userPhone, paletteName, paletteDetails, modificationPrompt, services, location, themeColor });
    }
    const modificationSection = modificationPrompt
      ? `\n**Modification Request:** "${modificationPrompt}"`
      : '';

    const extraDetails = [
      services ? `Services/Products: ${services}` : '',
      location ? `Location: ${location}` : '',
      themeColor ? `Preferred theme color: ${themeColor}` : '',
    ].filter(Boolean).join('\n');

    const enrichedDescription = extraDetails
      ? `${description}\n\n${extraDetails}`
      : description;

    const textPrompt = PROMPT_TEMPLATE
        .replace('{USER_NAME}', userName)
        .replace('{BUSINESS_NAME}', businessName)
        .replace('{USER_EMAIL}', userEmail)
        .replace('{USER_PHONE}', userPhone)
        .replace('{USER_INPUT}', enrichedDescription)
        .replace('{PALETTE_NAME}', paletteName)
        .replace('{PALETTE_DETAILS}', paletteDetails)
        .replace('{MODIFICATION_SECTION}', modificationSection);

    const data = await callProxy('/api/generate/website', { prompt: textPrompt });
    return cleanResponse(data.html || data.text || '');
export async function generateWebsite({
  description,
  userName,
  businessName,
  userEmail,
  userPhone,
  paletteName,
  paletteDetails,
  modificationPrompt,
}: WebsiteParams): Promise<string> {
  if (loadPrivacyPreference()?.mode === 'local') {
    return localWebsite({
      description,
      userName,
      businessName,
      userEmail,
      userPhone,
      paletteName,
      paletteDetails,
      modificationPrompt,
    });
  }
  const modificationSection = modificationPrompt
    ? `\n**Modification Request:** "${modificationPrompt}"`
    : '';

  const textPrompt = PROMPT_TEMPLATE.replace('{USER_NAME}', userName)
    .replace('{BUSINESS_NAME}', businessName)
    .replace('{USER_EMAIL}', userEmail)
    .replace('{USER_PHONE}', userPhone)
    .replace('{USER_INPUT}', description)
    .replace('{PALETTE_NAME}', paletteName)
    .replace('{PALETTE_DETAILS}', paletteDetails)
    .replace('{MODIFICATION_SECTION}', modificationSection);

  const data = await callProxy('/api/generate/website', { prompt: textPrompt });
  return cleanResponse(data.html || data.text || '');
}

export async function generateNewsletter({
  description,
  businessName,
}: NewsletterParams): Promise<string> {
  if (loadPrivacyPreference()?.mode === 'local') {
    return `${businessName}: Local newsletter draft\n\n${description}\n\nThank you for supporting our business.`;
  }
  const finalPrompt = NEWSLETTER_PROMPT_TEMPLATE.replace('{BUSINESS_NAME}', businessName).replace(
    '{USER_INPUT}',
    description
  );

  const data = await callProxy('/api/generate/newsletter', { prompt: finalPrompt });
  return cleanResponse(data.html || data.text || '');
}

export async function analyzeAndTranslateDashboard({
  dashboardData,
  language,
}: DashboardAnalysisParams): Promise<string> {
  if (loadPrivacyPreference()?.mode === 'local') {
    const langDetails = LANGUAGES.find((l) => l.value === language) || LANGUAGES[0];
    return `Local summary (${langDetails.label}): Your dashboard data is available only in this browser. ${dashboardData.replace(/\s+/g, ' ').trim()}`;
  }
  const langDetails = LANGUAGES.find((l) => l.value === language) || LANGUAGES[0];
  const finalPrompt = DASHBOARD_ANALYSIS_PROMPT_TEMPLATE.replace('{DASHBOARD_DATA}', dashboardData)
    .replace('{LANGUAGE_NAME}', langDetails.label)
    .replace('{LANGUAGE_CODE}', langDetails.value);

  const data = await callProxy('/api/generate/analysis', { prompt: finalPrompt });
  return cleanResponse(data.html || data.text || '');
}
