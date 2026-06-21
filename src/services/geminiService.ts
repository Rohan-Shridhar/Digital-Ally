import { PROMPT_TEMPLATE, NEWSLETTER_PROMPT_TEMPLATE, DASHBOARD_ANALYSIS_PROMPT_TEMPLATE, LANGUAGES } from '../constants';

interface WebsiteParams {
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
}

async function callProxy(endpoint: string, body: any) {
    const clientID = getOrCreateClientID();
    
    // Use build-time injected token (VITE_CLIENT_TOKEN) as primary auth
    const clientToken = import.meta.env.VITE_CLIENT_TOKEN || '';
    
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
        if (clientToken) {
            headers['Authorization'] = `Bearer ${clientToken}`;
        }
    if (clientID) headers['X-Client-ID'] = clientID;

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
    return data;
}

export async function generateWebsite(
    { description, userName, businessName, userEmail, userPhone, paletteName, paletteDetails, modificationPrompt }: WebsiteParams
): Promise<string> {
    const modificationSection = modificationPrompt
      ? `\n**Modification Request:** "${modificationPrompt}"`
      : '';

    const textPrompt = PROMPT_TEMPLATE
        .replace('{USER_NAME}', userName)
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

export async function generateNewsletter(
    { description, businessName }: NewsletterParams
): Promise<string> {
    const finalPrompt = NEWSLETTER_PROMPT_TEMPLATE
        .replace('{BUSINESS_NAME}', businessName)
        .replace('{USER_INPUT}', description);

    const data = await callProxy('/api/generate/newsletter', { prompt: finalPrompt });
    return cleanResponse(data.html || data.text || '');
}

export async function analyzeAndTranslateDashboard(
    { dashboardData, language }: DashboardAnalysisParams
): Promise<string> {
    const langDetails = LANGUAGES.find(l => l.value === language) || LANGUAGES[0];
    const finalPrompt = DASHBOARD_ANALYSIS_PROMPT_TEMPLATE
        .replace('{DASHBOARD_DATA}', dashboardData)
        .replace('{LANGUAGE_NAME}', langDetails.label)
        .replace('{LANGUAGE_CODE}', langDetails.value);

    const data = await callProxy('/api/generate/analysis', { prompt: finalPrompt });
    return cleanResponse(data.html || data.text || '');
}