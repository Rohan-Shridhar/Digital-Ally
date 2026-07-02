import React, { useId } from 'react';
import { CheckIcon } from '@/components/IconSet';

interface ValidatedFieldProps {
  id?: string;
  label?: string;
  error?: string;
  isValid?: boolean;
  showSuccess?: boolean;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    className: string;
  }) => React.ReactNode;
}

const baseInputClass =
  'w-full px-4 py-3 bg-white/50 border rounded-lg focus:ring-2 focus:ring-lime-500 transition-colors';
const errorClass = 'border-red-500 focus:ring-red-400';
const validClass = 'border-green-500 focus:ring-green-400';
const defaultClass = 'border-gray-200';

export const ValidatedField: React.FC<ValidatedFieldProps> = ({
  id: providedId,
  label,
  error,
  isValid = false,
  showSuccess = false,
  children,
}) => {
  const generatedId = useId();
  const fieldId = providedId || generatedId;
  const errorId = `${fieldId}-error`;
  const successId = `${fieldId}-success`;
  const hasError = Boolean(error);
  const showValidIndicator = showSuccess && isValid && !hasError;

  const borderClass = hasError ? errorClass : showValidIndicator ? validClass : defaultClass;

  return (
    <div className="relative">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {children({
          id: fieldId,
          'aria-invalid': hasError,
          'aria-describedby': hasError ? errorId : showValidIndicator ? successId : undefined,
          className: `${baseInputClass} ${borderClass} ${showValidIndicator ? 'pr-10' : ''}`,
        })}
        {showValidIndicator && (
          <CheckIcon
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500 pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
      {hasError && (
        <p id={errorId} className="text-red-600 text-sm mt-1" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      {showValidIndicator && (
        <p id={successId} className="sr-only" aria-live="polite">
          Valid
        </p>
      )}
    </div>
  );
};
