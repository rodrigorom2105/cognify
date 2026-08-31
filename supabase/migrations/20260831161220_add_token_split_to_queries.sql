-- Split token accounting on `queries`.
--
-- `tokens_used` alone cannot produce a cost figure: input and output tokens
-- are billed at different rates. Both columns are nullable with no default so
-- that NULL means "not measured" -- rows written before token metering was
-- fixed stay distinguishable from a genuine zero, and AVG()/SUM() over them
-- skip the bad rows instead of being dragged toward zero.
--
-- NOTE: this repository has no baseline migration. The schema was built by
-- hand in the Supabase dashboard, so this file is an incremental change
-- against an existing database, not a from-scratch definition. `supabase db
-- reset` will NOT reproduce the schema. See README.

alter table public.queries
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer;

comment on column public.queries.prompt_tokens is
  'Input tokens billed for the chat completion. NULL = not measured.';

comment on column public.queries.completion_tokens is
  'Output tokens billed for the chat completion. NULL = not measured.';

comment on column public.queries.tokens_used is
  'prompt_tokens + completion_tokens for the chat completion. Excludes embedding tokens (query embedding and ingestion embeddings are not metered).';
