// Shared types across the application.
//
// Every row shape here is derived from `src/lib/supabase/database.types.ts`,
// which is generated from the live schema (`pnpm db:types`). Do not re-declare
// these by hand: a hand-written copy silently drifts from the database, and the
// Supabase client will happily hand you a row that does not match it.

import type { Tables } from '@/lib/supabase/database.types';

export type Document = Tables<'documents'>;
export type DocumentChunk = Tables<'document_chunks'>;
export type Query = Tables<'queries'>;
export type UserUsage = Tables<'user_usage'>;

/**
 * Statuses the application writes to `documents.status`.
 *
 * The column is a plain `text` with no check constraint, so the generated row
 * type is `string`: this union constrains what *we* write, it is not a promise
 * about what the database may return.
 */
export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface ChunkData {
  chunks: string[];
}

export interface EmbeddingData {
  embeddings: number[][];
}
