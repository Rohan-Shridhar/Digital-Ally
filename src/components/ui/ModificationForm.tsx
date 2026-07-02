import React from 'react';
import { MicrophoneIcon } from '@/components/IconSet';
import { ValidatedField } from '@/components/ValidatedField';

interface ModificationFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onToggleListening: () => void;
  isListening: boolean;
  isValid: boolean;
  error?: string;
  t: (key: string) => string;
}

export const ModificationForm: React.FC<ModificationFormProps> = ({
  value,
  onChange,
  onSubmit,
  onToggleListening,
  isListening,
  isValid,
  error,
  t,
}) => (
  <div className="mb-6">
    <h3 className="font-bold text-gray-800 mb-2">{t('aiAssistant')}</h3>
    <p className="text-xs text-gray-500 mb-2">{t('aiAssistantHint')}</p>
    <div className="relative">
      <ValidatedField error={error} isValid={isValid} showSuccess>
        {(fieldProps) => (
          <textarea
            {...fieldProps}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${fieldProps.className} mt-1 px-3 py-2 bg-gray-50 h-24 resize-y pr-12`}
            placeholder={t('placeholderAssistant')}
          />
        )}
      </ValidatedField>
      <button
        type="button"
        onClick={onToggleListening}
        className={`absolute top-2 right-2 p-1.5 rounded-full ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        aria-label={isListening ? t('stopListening') : t('startListening')}
      >
        <MicrophoneIcon className="w-4 h-4" />
      </button>
    </div>
    <button
      type="button"
      disabled={!isValid}
      onClick={onSubmit}
      className="mt-4 w-full rounded-lg bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:bg-gray-400"
    >
      {t('updateWithAssistant')}
    </button>
  </div>
);
