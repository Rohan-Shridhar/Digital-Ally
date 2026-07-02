import React from 'react';
import { EyeIcon, CopyIcon, DownloadIcon, CheckIcon } from '@/components/IconSet';

interface ExportActionsProps {
  generatedUrl: string;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  copyLabel: string;
}

export const ExportActions: React.FC<ExportActionsProps> = ({
  generatedUrl,
  onCopy,
  onDownload,
  copied,
  copyLabel,
}) => (
  <div className="space-y-2">
    <a
      href={generatedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition text-sm"
    >
      <EyeIcon className="w-4 h-4" /> Open in New Tab
    </a>
    <button
      type="button"
      onClick={onDownload}
      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm"
    >
      <DownloadIcon className="w-4 h-4" /> Download HTML
    </button>
    <button
      type="button"
      onClick={onCopy}
      className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-50 transition text-sm"
    >
      {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
      {copyLabel}
    </button>
  </div>
);
