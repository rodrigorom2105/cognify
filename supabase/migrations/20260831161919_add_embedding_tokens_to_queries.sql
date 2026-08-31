-- Meter the per-query embedding call.
--
-- Kept out of `tokens_used` on purpose: this is text-embedding-3-small, billed
-- at a different rate than the gpt-4o-mini completion, so summing them into one
-- number would make any cost calculation wrong. NULL means "not measured".
--
-- Ingestion embeddings are still unmetered -- they belong to the document, not
-- to a query, and would need a column on `documents`.

alter table public.queries
  add column if not exists embedding_tokens integer;

comment on column public.queries.embedding_tokens is
  'Tokens billed by text-embedding-3-small for embedding this question. Priced separately from tokens_used; do not sum the two. NULL = not measured.';
