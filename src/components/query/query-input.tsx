'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  disabled: boolean;
  prefill?: string;
}

export function QueryInput({
  onSubmit,
  isLoading,
  disabled,
  prefill,
}: QueryInputProps) {
  // "Ask again" drops an earlier question back into the box rather than firing
  // it blind, so it can be edited before it is sent. The parent remounts this
  // component to deliver it, so the initial state is the whole mechanism.
  const [value, setValue] = useState(prefill ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="question" className="heading block text-sm">
        Ask about this document
      </label>

      <Textarea
        id="question"
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          disabled
            ? 'Choose a document first'
            : 'What does this document say about…'
        }
        disabled={disabled || isLoading}
        rows={3}
        autoFocus={!!prefill}
        className="resize-none"
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          Enter to send, Shift + Enter for a new line
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading || disabled}
          size="sm"
        >
          {isLoading && <Loader2 className="size-3.5 animate-spin" />}
          {isLoading ? 'Answering' : 'Ask'}
        </Button>
      </div>
    </div>
  );
}
