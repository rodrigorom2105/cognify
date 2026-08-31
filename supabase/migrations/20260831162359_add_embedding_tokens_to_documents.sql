-- Meter the embedding tokens spent ingesting a document.
--
-- This is a one-off cost per upload (every chunk is embedded once), so it
-- belongs to the document rather than to any query. Same model and rate as
-- queries.embedding_tokens, but a separate lifecycle: ingestion cost is paid
-- at upload, query cost is paid per question.
--
-- NULL means "not measured" -- documents ingested before this was
-- instrumented stay distinguishable from a genuine zero.

alter table public.documents
  add column if not exists embedding_tokens integer;

comment on column public.documents.embedding_tokens is
  'Tokens billed by text-embedding-3-small to embed every chunk of this document at ingestion. One-off cost per upload. NULL = not measured.';
