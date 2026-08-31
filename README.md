# Cognify

Upload a PDF, ask questions about it, get answers grounded in the document with citations back to the source passages.

Documents are processed in the background: the text is extracted, chunked, embedded, and stored in pgvector. Questions are answered by embedding the query, retrieving the most similar chunks, and streaming a completion constrained to that retrieved context.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Auth, database, storage | Supabase (Postgres + pgvector) |
| Background jobs | Inngest |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) |
| Answers | OpenAI `gpt-4o-mini`, streamed |
| Hosting | Vercel |

## How it works

**Ingestion** — `uploadDocument` (`src/lib/actions/documents.ts`) validates the file, stores it in Supabase Storage, inserts a `documents` row with status `processing`, and emits a `document.uploaded` event. The Inngest function `process-document` then runs three steps:

1. **Extract and chunk** — pull text with `unpdf`, normalize it, split into chunks of 1500 characters with 300 overlap (350 minimum).
2. **Embed** — generate embeddings in batches of 100.
3. **Store** — write chunks and vectors to `document_chunks`, then set the document to `ready`.

Intermediate data passes between steps through the `processing_temp` table rather than the event payload, which keeps step output under Inngest's size limits.

**Retrieval** — `POST /api/query` authenticates the user, confirms the document belongs to them and is `ready`, embeds the question, calls the `match_document_chunks` RPC for the 8 nearest chunks, and streams an answer. The system prompt restricts the model to the retrieved passages and instructs it to say it could not find the information rather than fill gaps.

### Limits

- PDF only, 10 MB maximum
- 10 documents per user (free tier), tracked in `user_usage`
- Scanned or image-only PDFs are rejected — there is no OCR step

## Getting started

### Package manager: pnpm only

**This project uses pnpm. Do not install with npm, yarn, or bun.**

`pnpm-lock.yaml` is the only lockfile, and the pnpm version is pinned via the `packageManager` field in `package.json`. Vercel installs with `pnpm --frozen-lockfile`, so a lockfile that disagrees with `package.json` fails the build with `ERR_PNPM_OUTDATED_LOCKFILE` before anything compiles.

`package-lock.json`, `yarn.lock`, and `bun.lockb` are gitignored to keep a stray `npm install` from reintroducing a competing lockfile.

```bash
# install
pnpm install

# add or upgrade a dependency — always through pnpm
pnpm add <pkg>
pnpm update <pkg>
```

If you don't have pnpm, corepack ships with Node and will use the pinned version:

```bash
corepack enable
```

### Environment

Copy the variables below into `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security and is used only by the background worker (`src/lib/supabase/service.ts`). It must never be exposed to the client.

`DOCUMENTS_BUCKET` is optional and defaults to `documents`.

### Running locally

Background processing needs the Inngest dev server running alongside Next, in a second terminal:

```bash
pnpm dev        # terminal 1 — Next.js on :3000
pnpm inngest    # terminal 2 — Inngest dev server on :8288
```

Without the dev server, uploads will store the file and create the row, but nothing will process it and the document stays in `processing`.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm inngest` | Inngest dev server (required for background jobs) |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm lint` | ESLint, `--max-warnings 0` |
| `pnpm format` | Prettier over `src/` |
| `pnpm eval:recall` | Recall@5 chunking evaluation |
| `pnpm supabase:start` / `:stop` / `:status` / `:reset` | Local Supabase stack |

## Retrieval evaluation

`scripts/eval-recall.mjs` compares chunking configurations by **Recall@K** and **Hit@K** against a labelled eval set, rather than by raw similarity score — a higher similarity number does not mean the right passage was retrieved.

```bash
pnpm eval:recall
```

Results are written to `eval/recall/results.latest.json`. See [`eval/recall/README.md`](eval/recall/README.md) for how to build the eval set.

The current committed run covers only 2 cases. That is enough to show the 1000/200 baseline dropping a passage the tuned 1500/300 config retrieves, but not enough to separate configurations that both score 1.0. Expand the set before treating those numbers as settled.

## Database

| Table | Purpose |
| --- | --- |
| `documents` | One row per upload: filename, storage path, status, page count |
| `document_chunks` | Chunk text, `chunk_index`, and the pgvector embedding |
| `processing_temp` | Step-to-step handoff for the Inngest pipeline |
| `queries` | Question and answer history per user |
| `user_usage` | Upload and query counters for tier limits |
| `subscriptions` | Billing schema — see "Not implemented" below |

RLS is enabled with owner-scoped policies (`auth.uid() = user_id`) on the user-facing tables. Auth session refresh happens in `src/proxy.ts` (Next.js 16 replaced `middleware.ts` with `proxy.ts`).

### Migrations — no baseline

**`supabase db reset` does not reproduce this schema.** The database was built by hand in the Supabase dashboard, so `supabase/migrations/` starts partway through its history: it contains only incremental changes applied after that point, with no migration that creates the original tables, policies, functions, or the pgvector index.

Treat the remote database as the source of truth until a baseline is captured (`supabase db dump` against the live project, committed as the first migration). Until then, new changes should still be added as migration files so the gap stops growing.

### Token accounting

`queries` records `prompt_tokens`, `completion_tokens`, and their sum in `tokens_used`. The split is stored separately because input and output tokens are billed at different rates, so a total alone cannot produce a cost figure.

`NULL` in those columns means **not measured**, which distinguishes rows written before token metering worked from a genuine zero. Filter them out when computing averages:

```sql
select
  count(*)                                          as queries,
  round(avg(prompt_tokens))                         as avg_input,
  round(avg(completion_tokens))                     as avg_output,
  sum(prompt_tokens)     / 1e6 * 0.15
    + sum(completion_tokens) / 1e6 * 0.60           as approx_usd
from queries
where prompt_tokens is not null;
```

Embedding tokens are **not** metered — neither the per-query embedding nor the ingestion embeddings — so this covers inference cost only.

## Deploying

The app deploys to Vercel. Two things are easy to get wrong:

**Inngest syncing.** Install the [Inngest Vercel integration](https://vercel.com/marketplace/inngest) so every deployment syncs automatically and each git branch gets its own Inngest branch environment. Production and branch environments use **different** event and signing keys — branch environments share one set among themselves, separate from production's. Set both scopes accordingly in Vercel.

Do not set `INNGEST_ENV` in Vercel with an "All Environments" scope; it overrides the automatic branch detection and collapses every preview into a single environment.

**Deployment Protection.** Vercel's Deployment Protection blocks Inngest from reaching `/api/inngest`. Under Standard Protection this affects preview deployments; under All Deployments it affects production too. Either disable it (Project → Settings → Deployment Protection) or, on a Pro plan, configure Protection Bypass for Automation and add the bypass secret to the Inngest integration settings.

Note that `src/app/api/inngest/route.ts` declares `maxDuration = 300`. Vercel's Hobby plan caps function duration well below that, so large documents can be cut off mid-processing.

## Not implemented

Honest status, so nobody goes looking for these:

- **Billing.** The `subscriptions` table and `NEXT_PUBLIC_ENABLE_STRIPE` flag exist, but there is no Stripe code. Tier limits are enforced against `user_usage` counters only.
- **Automated tests.** No unit or integration tests. Verification is manual, plus the retrieval eval harness.
- **OCR.** Image-only PDFs fail extraction rather than falling back.
- **Multi-document questions.** Each query is scoped to a single document.
