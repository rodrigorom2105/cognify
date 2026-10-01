-- Record how long ingestion and querying take, not just what they cost.
--
-- Token counts were already metered, but there was no timing at all: the only
-- proxy for processing time was `documents.updated_at - created_at`, which
-- folds Inngest queue wait into processing and moves on any later update.
-- Query latency was not recorded anywhere.
--
-- Every column is nullable with no default, matching the token columns: NULL
-- means "not measured", so rows from before this change are excluded from
-- averages instead of dragging them toward zero.

alter table public.documents
  add column if not exists chunk_count integer,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists processing_metrics jsonb,
  add column if not exists error_message text;

comment on column public.documents.chunk_count is
  'Chunks stored for this document at ingestion. NULL = not measured.';
comment on column public.documents.processing_started_at is
  'When the Inngest run began extracting text. created_at -> this is queue wait.';
comment on column public.documents.processing_completed_at is
  'When the document was marked ready. started_at -> this is pipeline time; created_at -> this is what the user waits.';
comment on column public.documents.processing_metrics is
  'Per-step timings (ms), step attempts, text and chunk-size stats for the ingestion run.';
comment on column public.documents.error_message is
  'Why processing failed, when status = failed.';

alter table public.queries
  add column if not exists embed_ms integer,
  add column if not exists retrieval_ms integer,
  add column if not exists ttft_ms integer,
  add column if not exists generation_ms integer,
  add column if not exists total_ms integer,
  add column if not exists chunks_returned integer,
  add column if not exists top_similarity double precision,
  add column if not exists avg_similarity double precision;

comment on column public.queries.embed_ms is
  'Time to embed the question. NULL = not measured.';
comment on column public.queries.retrieval_ms is
  'Time for the match_document_chunks RPC. NULL = not measured.';
comment on column public.queries.ttft_ms is
  'Request received -> first answer token, measured server-side. NULL = not measured.';
comment on column public.queries.generation_ms is
  'Chat completion call -> last token. NULL = not measured.';
comment on column public.queries.total_ms is
  'Request received -> last answer token, measured server-side. NULL = not measured.';
comment on column public.queries.chunks_returned is
  'Chunks retrieved and passed to the model as context.';
comment on column public.queries.top_similarity is
  'Cosine similarity of the best retrieved chunk.';
comment on column public.queries.avg_similarity is
  'Mean cosine similarity across the retrieved chunks.';

-- A retried store step re-inserted every chunk it had already written, so a
-- document could end up with each chunk twice. With this constraint the insert
-- becomes an upsert and a retry overwrites instead of duplicating.
alter table public.document_chunks
  add constraint document_chunks_document_id_chunk_index_key
  unique (document_id, chunk_index);
