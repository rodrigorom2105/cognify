// Shared types across the application

export interface User {
  id: string;
  email: string;
  name: string;
  last_name: string;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  status: 'processing' | 'ready' | 'failed';
  file_size_bytes: number;
  page_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Query {
  id: string;
  user_id: string;
  document_id: string;
  query_text: string;
  answer_text: string | null;
  tokens_used: number;
  created_at: string;
}

export interface UserUsage {
  user_id: string;
  documents_uploaded: number;
  queries_made: number;
  tokens_consumed: number;
  last_reset_at: string;
}

export interface ChunkData {
  chunks: string[];
}

export interface EmbeddingData {
  embeddings: number[][];
}