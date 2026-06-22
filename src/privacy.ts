export type AiProcessingMode = 'remote' | 'local';

export interface PrivacyPreference {
  consentVersion: string;
  mode: AiProcessingMode;
  decidedAt: string;
}

export const CONSENT_VERSION = '2026-06-21';
const STORAGE_KEY = 'digital-ally-privacy-preference';

export function loadPrivacyPreference(): PrivacyPreference | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (
      value?.consentVersion === CONSENT_VERSION &&
      (value.mode === 'remote' || value.mode === 'local') &&
      typeof value.decidedAt === 'string'
    ) {
      return value;
    }
  } catch {
    // Invalid or legacy settings are treated as no consent.
  }

  return null;
}

export function savePrivacyPreference(mode: AiProcessingMode): PrivacyPreference {
  const preference = {
    consentVersion: CONSENT_VERSION,
    mode,
    decidedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  return preference;
}

export function clearPrivacyPreference(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem('sessionToken');
  }
}
