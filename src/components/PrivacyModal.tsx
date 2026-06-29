import React from 'react';
import { AiProcessingMode } from '@/shared/privacy';

interface PrivacyModalProps {
  onChoose: (mode: AiProcessingMode) => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ onChoose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="privacy-title"
  >
    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl md:p-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-lime-700">
        Your data, your choice
      </p>
      <h2 id="privacy-title" className="text-2xl font-bold text-gray-900">
        Choose how Digital Ally processes your content
      </h2>
      <p className="mt-3 text-gray-600">
        Remote AI sends the business details and prompts you submit to our server and Google Gemini
        to create content. Digital Ally does not retain request or response content on its server.
      </p>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => onChoose('remote')}
          className="rounded-xl border-2 border-lime-500 p-4 text-left hover:bg-lime-50"
        >
          <span className="block font-bold text-gray-900">Allow remote AI processing</span>
          <span className="mt-1 block text-sm text-gray-600">
            Send only the content needed for generation. Google may process it under its applicable
            service terms.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChoose('local')}
          className="rounded-xl border-2 border-gray-200 p-4 text-left hover:border-gray-400 hover:bg-gray-50"
        >
          <span className="block font-bold text-gray-900">Use local-only mode</span>
          <span className="mt-1 block text-sm text-gray-600">
            No content is sent to the AI server. Generation uses basic templates in this browser.
          </span>
        </button>
      </div>

      <p className="mt-5 text-xs leading-5 text-gray-500">
        Your form and generated content remain in this tab’s memory and are cleared when you start
        over or close the tab. Only your privacy choice and its date are saved in this browser. Read
        the{' '}
        <a
          href="/privacy.html"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-lime-700 underline"
        >
          privacy and retention policy
        </a>
        .
      </p>
    </div>
  </div>
);
