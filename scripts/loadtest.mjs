#!/usr/bin/env node

/**
 * End-to-end load test against a deployed Cognify.
 *
 * Simulated users go through the same HTTP surface the dashboard uses:
 * `POST /api/documents` (the upload server action) and `POST /api/query`
 * (streamed answers). Ingestion runs on whatever Inngest environment the
 * deployment is synced to, so the timings are the real pipeline's.
 *
 *   node scripts/loadtest.mjs fetch
 *   node scripts/loadtest.mjs run --base-url https://… --users 5 [--docs-per-user 3]
 *                                 [--questions-per-doc 6] [--offset 0] [--label wave-5]
 *   node scripts/loadtest.mjs report [--run <runId> …] [--refresh]
 *   node scripts/loadtest.mjs cleanup --run <runId> | --all
 *
 * Users are created with the service role (`email_confirm: true`) rather than
 * through the sign-up form: sign-up sends a confirmation email and Supabase's
 * built-in mailer is rate limited to a handful per hour. Every test account is
 * `loadtest+<runId>-<n>@example.com`, which is what `cleanup` matches on.
 *
 * `report` snapshots the run's database rows to `loadtest/results/` before
 * summarising, and `cleanup` refuses to delete a run that has no snapshot —
 * deleting a user cascades to its documents and queries, so the metrics would
 * otherwise go with them.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_PATH = path.join(ROOT, 'loadtest/corpus.json');
const CACHE_DIR = path.join(ROOT, 'loadtest/.cache');
const RESULTS_DIR = path.join(ROOT, 'loadtest/results');
const DOCUMENTS_BUCKET = 'documents';
const EMAIL_PREFIX = 'loadtest+';

const READY_POLL_MS = 2000;
const READY_TIMEOUT_MS = 15 * 60 * 1000;
const REFUSAL = /couldn['’]t find that information/i;

// USD per 1M tokens. Same rates as the README's cost queries — check them
// against current pricing before quoting a figure.
const PRICE = { chatInput: 0.15, chatOutput: 0.6, embedding: 0.02 };

// ---------------------------------------------------------------- utilities

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2);
  const args = { command, run: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = rest[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : next;
    if (value !== true) i += 1;
    if (key === 'run') args.run.push(value);
    else args[key] = value;
  }
  return args;
}

async function loadEnvFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} (expected in .env.local)`);
  return value;
}

function adminClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  const sorted = values
    .filter((v) => typeof v === 'number')
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

function mean(values) {
  const nums = values.filter((v) => typeof v === 'number');
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

const sum = (values) =>
  values.filter((v) => typeof v === 'number').reduce((a, v) => a + v, 0);

function dist(values) {
  return {
    n: values.filter((v) => typeof v === 'number').length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: percentile(values, 100),
    mean: mean(values),
  };
}

const msBetween = (from, to) =>
  from && to ? new Date(to).getTime() - new Date(from).getTime() : null;

async function readCorpus() {
  return JSON.parse(await fs.readFile(CORPUS_PATH, 'utf8'));
}

function log(...parts) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
}

// ------------------------------------------------------------------- fetch

async function fetchCorpus() {
  const corpus = await readCorpus();
  await fs.mkdir(CACHE_DIR, { recursive: true });

  for (const doc of corpus.documents) {
    const target = path.join(CACHE_DIR, doc.file);
    try {
      await fs.access(target);
      continue;
    } catch {
      // not cached yet
    }
    const response = await fetch(doc.url, {
      headers: { 'User-Agent': 'cognify-loadtest/1.0' },
    });
    if (!response.ok) {
      console.warn(
        `  ! ${doc.file}: ${response.status} ${response.statusText}`
      );
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(target, buffer);
    log(`fetched ${doc.file} (${(buffer.length / 1e6).toFixed(2)} MB)`);
    // arXiv asks automated clients to pace their requests.
    await sleep(1000);
  }
  log(`corpus ready in ${path.relative(ROOT, CACHE_DIR)}`);
}

// --------------------------------------------------------------------- run

/** Sign in and return the auth cookies the Next.js app expects. */
async function signInCookies(email, password) {
  const jar = new Map();
  const client = createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    }
  );

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);

  // @supabase/ssr writes the session cookies from an auth-state listener,
  // which can land a tick after signInWithPassword resolves.
  for (let i = 0; i < 20 && jar.size === 0; i += 1) await sleep(50);
  if (jar.size === 0) throw new Error(`no session cookies for ${email}`);

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function uploadDocument(baseUrl, cookie, filePath, filename) {
  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: 'application/pdf' }),
    filename
  );

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/documents`, {
    method: 'POST',
    headers: { cookie },
    body: form,
    // The auth proxy answers an unauthenticated request with a redirect to
    // the login page; following it would turn an auth failure into HTML.
    redirect: 'manual',
  });
  const elapsedMs = Date.now() - startedAt;

  let body = null;
  try {
    body = await response.json();
  } catch {
    // non-JSON (redirect, 413 from the platform, …)
  }

  return {
    filename,
    bytes: buffer.length,
    status: response.status,
    ok: response.status === 201,
    documentId: body?.documentId ?? null,
    message: body?.message ?? body?.error ?? response.statusText,
    uploadMs: elapsedMs,
    uploadStartedAt: new Date(startedAt).toISOString(),
  };
}

async function waitForReady(admin, upload) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const uploadStartedAt = new Date(upload.uploadStartedAt).getTime();

  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from('documents')
      .select('status')
      .eq('id', upload.documentId)
      .maybeSingle();

    if (error) throw new Error(`poll failed: ${error.message}`);
    if (!data) return { finalStatus: 'missing', observedReadyMs: null };
    if (data.status === 'ready' || data.status === 'failed') {
      return {
        finalStatus: data.status,
        // Client-observed, so it includes the poll interval: up to
        // READY_POLL_MS later than the database's processing_completed_at.
        observedReadyMs: Date.now() - uploadStartedAt,
      };
    }
    await sleep(READY_POLL_MS);
  }
  return { finalStatus: 'timeout', observedReadyMs: null };
}

async function askQuestion(baseUrl, cookie, documentId, question, inScope) {
  const startedAt = Date.now();
  const result = {
    documentId,
    question,
    inScope,
    startedAt: new Date(startedAt).toISOString(),
    status: null,
    ok: false,
    clientTtfbMs: null,
    clientTtftMs: null,
    clientTotalMs: null,
    answerChars: 0,
    refused: null,
    chunksInHeader: null,
    error: null,
  };

  try {
    const response = await fetch(`${baseUrl}/api/query`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, documentId }),
      redirect: 'manual',
    });
    result.status = response.status;
    result.clientTtfbMs = Date.now() - startedAt;

    if (!response.ok) {
      const text = await response.text();
      result.error = text.slice(0, 300);
      result.clientTotalMs = Date.now() - startedAt;
      return result;
    }

    const header = response.headers.get('X-chunks');
    if (header)
      result.chunksInHeader = JSON.parse(decodeURIComponent(header)).length;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let answer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text && result.clientTtftMs === null) {
        result.clientTtftMs = Date.now() - startedAt;
      }
      answer += text;
    }
    answer += decoder.decode();

    result.clientTotalMs = Date.now() - startedAt;
    result.answerChars = answer.length;
    result.refused = REFUSAL.test(answer);
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.clientTotalMs = Date.now() - startedAt;
  }
  return result;
}

async function simulateUser(ctx, userIndex) {
  const {
    admin,
    baseUrl,
    corpus,
    runId,
    docsPerUser,
    questionsPerDoc,
    offset,
  } = ctx;
  const email = `${EMAIL_PREFIX}${runId}-${userIndex}@example.com`;
  const password = crypto.randomBytes(18).toString('base64url');
  const tag = `user ${userIndex}`;

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Load', last_name: `Test ${userIndex}` },
    });
  if (createError)
    throw new Error(`${tag}: create failed: ${createError.message}`);
  const userId = created.user.id;
  ctx.out.users.push({ index: userIndex, userId, email });

  const cookie = await signInCookies(email, password);

  // Upload one after another, as a person dragging files in would.
  const uploads = [];
  for (let j = 0; j < docsPerUser; j += 1) {
    const doc =
      corpus.documents[
        (offset + userIndex * docsPerUser + j) % corpus.documents.length
      ];
    const upload = await uploadDocument(
      baseUrl,
      cookie,
      path.join(CACHE_DIR, doc.file),
      doc.file
    );
    upload.userId = userId;
    uploads.push(upload);
    ctx.out.uploads.push(upload);
    log(
      `${tag}: upload ${doc.file} -> ${upload.status} in ${upload.uploadMs} ms` +
        (upload.ok ? '' : ` (${upload.message})`)
    );
  }

  // Wait for every accepted upload to finish ingesting.
  await Promise.all(
    uploads
      .filter((upload) => upload.ok)
      .map(async (upload) => {
        Object.assign(upload, await waitForReady(admin, upload));
        log(
          `${tag}: ${upload.filename} ${upload.finalStatus}` +
            (upload.observedReadyMs
              ? ` after ${(upload.observedReadyMs / 1000).toFixed(1)} s`
              : '')
        );
      })
  );

  // Then ask about each ready document. The last question per document is
  // out of scope, to measure whether the model declines instead of guessing.
  for (const upload of uploads.filter((u) => u.finalStatus === 'ready')) {
    for (let q = 0; q < questionsPerDoc; q += 1) {
      const outOfScope = q === questionsPerDoc - 1;
      const pool = outOfScope ? corpus.outOfScopeQuestions : corpus.questions;
      const question = pool[(q + userIndex) % pool.length];
      const result = await askQuestion(
        baseUrl,
        cookie,
        upload.documentId,
        question,
        !outOfScope
      );
      result.userId = userId;
      ctx.out.queries.push(result);
      log(
        `${tag}: q${q + 1} ${result.status} ttft ${result.clientTtftMs} ms, total ${result.clientTotalMs} ms` +
          (result.error ? ` (${result.error.slice(0, 80)})` : '')
      );
    }
  }
}

async function run(args) {
  const baseUrl = String(args['base-url'] ?? '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('--base-url is required');

  const users = Number(args.users ?? 1);
  const docsPerUser = Number(args['docs-per-user'] ?? 3);
  const questionsPerDoc = Number(args['questions-per-doc'] ?? 6);
  const offset = Number(args.offset ?? 0);
  const runId = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 15)
    .toLowerCase();
  const label = args.label ?? `${users}-users`;

  const corpus = await readCorpus();
  for (const doc of corpus.documents) {
    await fs.access(path.join(CACHE_DIR, doc.file)).catch(() => {
      throw new Error(
        `${doc.file} not cached; run \`node scripts/loadtest.mjs fetch\``
      );
    });
  }

  const out = {
    runId,
    label,
    baseUrl,
    config: { users, docsPerUser, questionsPerDoc, offset },
    startedAt: new Date().toISOString(),
    finishedAt: null,
    users: [],
    uploads: [],
    queries: [],
    errors: [],
  };
  const ctx = {
    admin: adminClient(),
    baseUrl,
    corpus,
    runId,
    docsPerUser,
    questionsPerDoc,
    offset,
    out,
  };

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, `${runId}.run.json`);
  log(
    `run ${runId} (${label}): ${users} concurrent users × ${docsPerUser} docs × ${questionsPerDoc} questions against ${baseUrl}`
  );

  // All users start together: concurrency is the number of users.
  const settled = await Promise.allSettled(
    Array.from({ length: users }, (_, i) => simulateUser(ctx, i))
  );
  for (const result of settled) {
    if (result.status === 'rejected') {
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      out.errors.push(message);
      console.error(`  ! ${message}`);
    }
  }

  out.finishedAt = new Date().toISOString();
  await fs.writeFile(outPath, JSON.stringify(out, null, 2));
  log(
    `wrote ${path.relative(ROOT, outPath)} — next: node scripts/loadtest.mjs report --run ${runId}`
  );
}

// ------------------------------------------------------------------ report

async function listRunFiles() {
  const files = await fs.readdir(RESULTS_DIR).catch(() => []);
  return files
    .filter((f) => f.endsWith('.run.json'))
    .map((f) => f.replace('.run.json', ''))
    .sort();
}

async function loadSnapshot(admin, runId, refresh) {
  const snapshotPath = path.join(RESULTS_DIR, `${runId}.db.json`);
  if (!refresh) {
    try {
      return JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
    } catch {
      // no snapshot yet
    }
  }

  const runFile = JSON.parse(
    await fs.readFile(path.join(RESULTS_DIR, `${runId}.run.json`), 'utf8')
  );
  const userIds = runFile.users.map((u) => u.userId);
  if (userIds.length === 0) return { documents: [], queries: [] };

  const { data: documents, error: docError } = await admin
    .from('documents')
    .select(
      'id, user_id, filename, status, page_count, file_size_bytes, chunk_count, embedding_tokens, created_at, processing_started_at, processing_completed_at, processing_metrics, error_message'
    )
    .in('user_id', userIds);
  if (docError) throw new Error(`documents: ${docError.message}`);

  const { data: queries, error: queryError } = await admin
    .from('queries')
    .select(
      'id, user_id, document_id, query_text, created_at, tokens_used, prompt_tokens, completion_tokens, embedding_tokens, embed_ms, retrieval_ms, ttft_ms, generation_ms, total_ms, chunks_returned, top_similarity, avg_similarity'
    )
    .in('user_id', userIds);
  if (queryError) throw new Error(`queries: ${queryError.message}`);

  const snapshot = { snapshotAt: new Date().toISOString(), documents, queries };
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

function summarise(runFile, snapshot) {
  const docs = snapshot.documents;
  const ready = docs.filter((d) => d.status === 'ready');
  const failed = docs.filter((d) => d.status === 'failed');
  const metrics = ready.map((d) => d.processing_metrics ?? {});

  const rejectedUploads = runFile.uploads.filter((u) => !u.ok);
  const firstCreated = Math.min(
    ...docs.map((d) => new Date(d.created_at).getTime())
  );
  const lastCompleted = Math.max(
    ...ready.map((d) => new Date(d.processing_completed_at).getTime())
  );
  const ingestWallSeconds =
    ready.length > 0 ? (lastCompleted - firstCreated) / 1000 : null;
  const pagesReady = sum(ready.map((d) => d.page_count));

  const ingestion = {
    uploadsAttempted: runFile.uploads.length,
    uploadsRejected: rejectedUploads.length,
    rejectedReasons: [
      ...new Set(rejectedUploads.map((u) => `${u.status} ${u.message}`)),
    ],
    documents: docs.length,
    ready: ready.length,
    failed: failed.length,
    failureReasons: [...new Set(failed.map((d) => d.error_message))],
    successRate: docs.length ? ready.length / docs.length : null,
    pages: pagesReady,
    chunks: sum(ready.map((d) => d.chunk_count)),
    pagesPerDoc: dist(ready.map((d) => d.page_count)),
    chunksPerDoc: dist(ready.map((d) => d.chunk_count)),
    chunksPerPage: pagesReady
      ? sum(ready.map((d) => d.chunk_count)) / pagesReady
      : null,
    avgChunkChars: mean(metrics.map((m) => m.chunks?.avgSize)),
    uploadMs: dist(runFile.uploads.filter((u) => u.ok).map((u) => u.uploadMs)),
    uploadToReadyMs: dist(
      ready.map((d) => msBetween(d.created_at, d.processing_completed_at))
    ),
    queueMs: dist(metrics.map((m) => m.queueMs)),
    pipelineMs: dist(metrics.map((m) => m.pipelineMs)),
    stepMs: {
      extractAndChunk: dist(metrics.map((m) => m.steps?.extractAndChunk?.ms)),
      generateEmbeddings: dist(
        metrics.map((m) => m.steps?.generateEmbeddings?.ms)
      ),
      storeChunks: dist(metrics.map((m) => m.steps?.storeChunks?.ms)),
    },
    pipelineMsPerPage: dist(
      ready.map((d, i) =>
        d.page_count ? metrics[i].pipelineMs / d.page_count : null
      )
    ),
    stepRetries: sum(
      metrics.flatMap((m) =>
        Object.values(m.steps ?? {}).map((s) => s.retries ?? 0)
      )
    ),
    ingestWallSeconds,
    pagesPerMinute: ingestWallSeconds
      ? (pagesReady / ingestWallSeconds) * 60
      : null,
    embeddingTokens: sum(ready.map((d) => d.embedding_tokens)),
    embeddingTokensPerPage: pagesReady
      ? sum(ready.map((d) => d.embedding_tokens)) / pagesReady
      : null,
    costUsd:
      (sum(ready.map((d) => d.embedding_tokens)) / 1e6) * PRICE.embedding,
  };

  const client = runFile.queries;
  const server = snapshot.queries;
  const queryCost = (q) =>
    ((q.prompt_tokens ?? 0) / 1e6) * PRICE.chatInput +
    ((q.completion_tokens ?? 0) / 1e6) * PRICE.chatOutput +
    ((q.embedding_tokens ?? 0) / 1e6) * PRICE.embedding;
  const okClient = client.filter((q) => q.ok);
  const inScope = okClient.filter((q) => q.inScope);
  const outOfScope = okClient.filter((q) => !q.inScope);

  const querying = {
    attempted: client.length,
    succeeded: okClient.length,
    errorRate: client.length
      ? (client.length - okClient.length) / client.length
      : null,
    errorStatuses: [
      ...new Set(
        client
          .filter((q) => !q.ok)
          .map((q) => `${q.status} ${q.error?.slice(0, 80)}`)
      ),
    ],
    recorded: server.length,
    serverTtftMs: dist(server.map((q) => q.ttft_ms)),
    serverTotalMs: dist(server.map((q) => q.total_ms)),
    embedMs: dist(server.map((q) => q.embed_ms)),
    retrievalMs: dist(server.map((q) => q.retrieval_ms)),
    generationMs: dist(server.map((q) => q.generation_ms)),
    clientTtftMs: dist(okClient.map((q) => q.clientTtftMs)),
    clientTotalMs: dist(okClient.map((q) => q.clientTotalMs)),
    promptTokens: dist(server.map((q) => q.prompt_tokens)),
    completionTokens: dist(server.map((q) => q.completion_tokens)),
    embeddingTokens: dist(server.map((q) => q.embedding_tokens)),
    chunksReturned: dist(server.map((q) => q.chunks_returned)),
    topSimilarity: dist(server.map((q) => q.top_similarity)),
    inScopeAnswered: inScope.length
      ? inScope.filter((q) => !q.refused).length / inScope.length
      : null,
    outOfScopeRefused: outOfScope.length
      ? outOfScope.filter((q) => q.refused).length / outOfScope.length
      : null,
    costUsdPerQuery: mean(server.map(queryCost)),
    costUsdTotal: sum(server.map(queryCost)),
  };

  return {
    runId: runFile.runId,
    label: runFile.label,
    config: runFile.config,
    startedAt: runFile.startedAt,
    ingestion,
    querying,
  };
}

const fmtMs = (v) =>
  v === null || v === undefined
    ? '—'
    : v >= 10000
      ? `${(v / 1000).toFixed(1)} s`
      : `${Math.round(v)} ms`;
const fmtPct = (v) =>
  v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`;
const fmtNum = (v, d = 0) =>
  v === null || v === undefined ? '—' : Number(v).toFixed(d);

function toMarkdown(summaries) {
  const cols = summaries.map((s) => `${s.label} (${s.config.users}u)`);
  const row = (name, fn) => `| ${name} | ${summaries.map(fn).join(' | ')} |`;
  const header = `| Metric | ${cols.join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|`;

  return [
    '## Ingestion',
    header,
    row(
      'Documents ready / attempted',
      (s) => `${s.ingestion.ready} / ${s.ingestion.uploadsAttempted}`
    ),
    row('Success rate', (s) => fmtPct(s.ingestion.successRate)),
    row(
      'Pages / chunks',
      (s) => `${s.ingestion.pages} / ${s.ingestion.chunks}`
    ),
    row(
      'Chunks per doc (p50 / max)',
      (s) =>
        `${fmtNum(s.ingestion.chunksPerDoc.p50)} / ${fmtNum(s.ingestion.chunksPerDoc.max)}`
    ),
    row(
      'Upload → ready p50 / p95',
      (s) =>
        `${fmtMs(s.ingestion.uploadToReadyMs.p50)} / ${fmtMs(s.ingestion.uploadToReadyMs.p95)}`
    ),
    row(
      'Queue wait p50 / p95',
      (s) =>
        `${fmtMs(s.ingestion.queueMs.p50)} / ${fmtMs(s.ingestion.queueMs.p95)}`
    ),
    row(
      'Pipeline p50 / p95',
      (s) =>
        `${fmtMs(s.ingestion.pipelineMs.p50)} / ${fmtMs(s.ingestion.pipelineMs.p95)}`
    ),
    row('Pipeline per page p50', (s) =>
      fmtMs(s.ingestion.pipelineMsPerPage.p50)
    ),
    row(
      'Extract+chunk / embed / store p50',
      (s) =>
        `${fmtMs(s.ingestion.stepMs.extractAndChunk.p50)} / ${fmtMs(s.ingestion.stepMs.generateEmbeddings.p50)} / ${fmtMs(s.ingestion.stepMs.storeChunks.p50)}`
    ),
    row('Step retries', (s) => s.ingestion.stepRetries),
    row('Throughput (pages/min)', (s) => fmtNum(s.ingestion.pagesPerMinute, 1)),
    row(
      'Embedding tokens (per page)',
      (s) =>
        `${s.ingestion.embeddingTokens} (${fmtNum(s.ingestion.embeddingTokensPerPage)})`
    ),
    row('Ingestion cost', (s) => `$${fmtNum(s.ingestion.costUsd, 4)}`),
    '',
    '## Querying',
    header,
    row(
      'Queries ok / attempted',
      (s) => `${s.querying.succeeded} / ${s.querying.attempted}`
    ),
    row('Error rate', (s) => fmtPct(s.querying.errorRate)),
    row(
      'Server TTFT p50 / p95',
      (s) =>
        `${fmtMs(s.querying.serverTtftMs.p50)} / ${fmtMs(s.querying.serverTtftMs.p95)}`
    ),
    row(
      'Server total p50 / p95',
      (s) =>
        `${fmtMs(s.querying.serverTotalMs.p50)} / ${fmtMs(s.querying.serverTotalMs.p95)}`
    ),
    row(
      'Client TTFT p50 / p95',
      (s) =>
        `${fmtMs(s.querying.clientTtftMs.p50)} / ${fmtMs(s.querying.clientTtftMs.p95)}`
    ),
    row(
      'Client total p50 / p95',
      (s) =>
        `${fmtMs(s.querying.clientTotalMs.p50)} / ${fmtMs(s.querying.clientTotalMs.p95)}`
    ),
    row(
      'Embed / retrieval p50',
      (s) =>
        `${fmtMs(s.querying.embedMs.p50)} / ${fmtMs(s.querying.retrievalMs.p50)}`
    ),
    row('Retrieval p95', (s) => fmtMs(s.querying.retrievalMs.p95)),
    row(
      'Prompt / completion tokens (mean)',
      (s) =>
        `${fmtNum(s.querying.promptTokens.mean)} / ${fmtNum(s.querying.completionTokens.mean)}`
    ),
    row('Top-chunk similarity (mean)', (s) =>
      fmtNum(s.querying.topSimilarity.mean, 3)
    ),
    row('In-scope answered', (s) => fmtPct(s.querying.inScopeAnswered)),
    row('Out-of-scope refused', (s) => fmtPct(s.querying.outOfScopeRefused)),
    row('Cost per query', (s) => `$${fmtNum(s.querying.costUsdPerQuery, 5)}`),
    row(
      'Cost per 1,000 queries',
      (s) => `$${fmtNum((s.querying.costUsdPerQuery ?? 0) * 1000, 2)}`
    ),
  ].join('\n');
}

async function report(args) {
  const admin = adminClient();
  const runIds = args.run.length > 0 ? args.run : await listRunFiles();
  if (runIds.length === 0) throw new Error('no runs in loadtest/results');

  const summaries = [];
  for (const runId of runIds) {
    const runFile = JSON.parse(
      await fs.readFile(path.join(RESULTS_DIR, `${runId}.run.json`), 'utf8')
    );
    const snapshot = await loadSnapshot(admin, runId, Boolean(args.refresh));
    summaries.push(summarise(runFile, snapshot));
  }

  await fs.writeFile(
    path.join(RESULTS_DIR, 'summary.json'),
    JSON.stringify(summaries, null, 2)
  );
  const markdown = toMarkdown(summaries);
  await fs.writeFile(path.join(RESULTS_DIR, 'summary.md'), `${markdown}\n`);
  console.log(markdown);
}

// ----------------------------------------------------------------- cleanup

async function cleanup(args) {
  const admin = adminClient();
  let targets = [];

  if (args.all) {
    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error(`listUsers: ${error.message}`);
      targets.push(
        ...data.users.filter((u) => u.email?.startsWith(EMAIL_PREFIX))
      );
      if (data.users.length < 1000) break;
    }
  } else if (args.run.length > 0) {
    for (const runId of args.run) {
      await fs.access(path.join(RESULTS_DIR, `${runId}.db.json`)).catch(() => {
        throw new Error(
          `run ${runId} has no snapshot; run \`report --run ${runId}\` first`
        );
      });
      const runFile = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, `${runId}.run.json`), 'utf8')
      );
      targets.push(
        ...runFile.users.map((u) => ({ id: u.userId, email: u.email }))
      );
    }
  } else {
    throw new Error('pass --run <runId> or --all');
  }

  // Never touch an account outside the load-test namespace.
  targets = targets.filter((u) => u.email?.startsWith(EMAIL_PREFIX));

  for (const user of targets) {
    // Storage objects are not covered by the auth.users cascade.
    const { data: objects } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .list(user.id, { limit: 1000 });
    if (objects?.length) {
      await admin.storage
        .from(DOCUMENTS_BUCKET)
        .remove(objects.map((o) => `${user.id}/${o.name}`));
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    log(
      `${error ? 'FAILED' : 'deleted'} ${user.email}${error ? `: ${error.message}` : ''}`
    );
  }
}

// -------------------------------------------------------------------- main

async function main() {
  await loadEnvFile(path.join(ROOT, '.env.local'));
  await loadEnvFile(path.join(ROOT, '.env'));
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'fetch':
      return fetchCorpus();
    case 'run':
      return run(args);
    case 'report':
      return report(args);
    case 'cleanup':
      return cleanup(args);
    default:
      console.log(
        'usage: node scripts/loadtest.mjs <fetch|run|report|cleanup> [options]'
      );
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
