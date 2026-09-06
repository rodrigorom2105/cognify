'use client';

import { cn } from '@/lib/utils';
import React, { useCallback, useState } from 'react';
import { uploadDocument } from '@/lib/actions/documents';

const MAX_SIZE_MB = 10;

export default function UploadZone() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const validateFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      return 'That file is not a PDF. Cognify reads PDFs only.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || isUploading) return;

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setStatus(null);
        return;
      }

      setError(null);
      setStatus(`Uploading ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);

      uploadDocument(formData)
        .then((result) => {
          if (!result.success) {
            setError(result.message);
            setStatus(null);
          } else {
            setError(null);
            setStatus(`Uploaded ${file.name}. Processing has started.`);
          }
        })
        .finally(() => setIsUploading(false));
    },
    [isUploading]
  );

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  return (
    <div className="space-y-2">
      {/*
        A label rather than a click-handling div: the file input stays the real
        control, so pointer and keyboard both reach it without extra handlers.
      */}
      <label
        htmlFor="upload-input"
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-dashed px-5 py-6 transition-colors',
          'has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2',
          isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
          isUploading && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className="text-sm font-medium">
          {isUploading ? 'Uploading' : 'Drop a PDF here, or choose a file'}
        </span>
        <span className="text-muted-foreground text-xs">
          PDF with a text layer, up to {MAX_SIZE_MB} MB. Scanned pages cannot be
          read.
        </span>

        <input
          id="upload-input"
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={isUploading}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <p aria-live="polite" className="min-h-4 text-xs">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <span className="text-muted-foreground">{status}</span>
        )}
      </p>
    </div>
  );
}
