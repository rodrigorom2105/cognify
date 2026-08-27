# Recall@5 Chunk Tuning

This evaluation compares multiple chunk size/overlap configurations using Recall@K instead of raw similarity score.

## 1) Prepare eval set

Edit [eval/recall/eval-set.small.json](eval/recall/eval-set.small.json):
- Replace `documentId` with real document UUIDs.
- Replace each expected snippet with a verbatim excerpt (8-20 words) that should be retrievable for the query.
- Keep 5-15 test cases for fast iteration.

## 2) Run evaluation

```bash
npm run eval:recall
```

## 3) Output

The script prints per-config metrics:
- `Recall@5`: average per-case recall over known-relevant chunks.
- `Hit@5`: percent of cases where at least one relevant chunk appears in top 5.

It also writes results to:
- `eval/recall/results.latest.json`

## Notes

- Required env vars:
  - `OPENAI_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Optional env var:
  - `DOCUMENTS_BUCKET` (defaults to `documents`)
