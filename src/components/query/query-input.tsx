'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  disabled: boolean;
}

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [value, setValue] = useState('');
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
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        Ask a question
      </label>
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Select a document first...'
              : 'Ask anything about this document... (Enter to send)'
          }
          disabled={disabled || isLoading}
          rows={3}
          className="resize-none flex-1"
        />
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading || disabled}
          size="icon"
          className="h-19 w-10 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Shift + Enter for new line
      </p>
    </div>
  );
}
