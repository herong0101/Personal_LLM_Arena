'use client';

import { KeyboardEvent, ReactNode, useState } from 'react';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  submitLabel?: string;
  helperText?: string;
  leadingControls?: ReactNode;
  trailingControls?: ReactNode;
  minRows?: number;
}

export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  placeholder = '輸入訊息...',
  disabled = false,
  isLoading = false,
  submitLabel = '送出',
  helperText = 'Enter 送出，Shift + Enter 換行',
  leadingControls,
  trailingControls,
  minRows = 2,
}: PromptComposerProps) {
  const [isComposing, setIsComposing] = useState(false);

  const canSubmit = Boolean(value.trim()) && !disabled && !isLoading;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as unknown as {
      isComposing?: boolean;
      keyCode?: number;
    };

    if (isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        void onSubmit();
      }
    }
  };

  return (
    <div className="composer-shell">
      {(leadingControls || trailingControls) && (
        <div className="composer-toolbar">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{leadingControls}</div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{trailingControls}</div>
        </div>
      )}

      <div className="flex items-end gap-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={minRows}
          className="composer-input"
        />
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSubmit}
          className="composer-submit"
          aria-label={submitLabel}
          title={submitLabel}
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m13 6 6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      {helperText && <div className="mt-2 px-1 text-xs text-[var(--slate-500)]">{helperText}</div>}
    </div>
  );
}
