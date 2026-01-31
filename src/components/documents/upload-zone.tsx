'use client';

import { cn } from '@/lib/utils';
import React, { useCallback, useState } from 'react';
import { uploadDocument } from '@/lib/actions/documents';
import { Upload } from 'lucide-react';

export default function UploadZone() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const MAX_SIZE_MB = 10;

  const validateFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return 'PDF must be smaller than 10MB.';
    }
    return null;
  };

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || isUploading) return;

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setFileName(null);
        return;
      }

      setError(null);
      setFileName(file.name);

      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);

      uploadDocument(formData)
        .then((result) => {
          if (!result.success) {
            setError(result.message);
          } else {
            setError(null);
            setSuccess('Upload successful!');
          }
        })
        .finally(() => {
          setIsUploading(false);
          setFileName(null);
        });
    },
    [isUploading]
  );

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  return (
    <div
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => {
        if (isUploading) return;
        document.getElementById('upload-input')?.click();
      }}
      className={cn(
        'flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white',
        isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <Upload
        className={cn(
          'h-12 w-12 mb-4',
          isUploading ? 'text-blue-500 animate-pulse' : 'text-gray-400'
        )}
      />

      <input
        id="upload-input"
        type="file"
        accept="application/pdf"
        hidden
        disabled={isUploading}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <p className="text-lg font-medium">
        {isUploading ? 'Uploading...' : 'Upload your PDF'}
      </p>

      <p className="text-sm text-gray-500">
        Drag & drop or click to select a file
      </p>

      <p className="mt-2 text-xs text-gray-400">PDF only / Max size: 10MB</p>

      {fileName && (
        <p className="mt-3 text-sm text-green-600">Selected: {fileName}</p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
