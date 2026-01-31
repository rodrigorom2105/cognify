'use client';

import { cn } from '@/lib/utils';
import { useCallback, useState } from 'react';
import { uploadDocument } from '@/lib/actions/documents';

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;

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

    uploadDocument(formData)
      .then((result) => {
        if (!result.success) {
          setError(result.message);
        } else {
          setError(null);
        }
      })
      .finally(() => {
        setFileName(null);
      });
  }, []);

  return (
    <div
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => document.getElementById('upload-input')?.click()}
      className={cn(
        'flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors',
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
      )}
    >
      <input
        id="upload-input"
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <p className="text-lg font-medium">Upload your PDF</p>

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
