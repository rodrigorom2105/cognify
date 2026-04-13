#!/usr/bin/env node

import fs from 'node:fs/promises';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET || 'documents';

const DEFAULT_CONFIGS = [
  {
    name: 'baseline-1000-200',
    chunkSize: 1000,
    overlap: 200,
    minChunkSize: 0,
  },
  {
    name: 'cfg-1200-240',
    chunkSize: 1200,
    overlap: 240,
    minChunkSize: 200,
  },
  {
    name: 'cfg-1500-300',
    chunkSize: 1500,
    overlap: 300,
    minChunkSize: 350,
  },
  {
    name: 'cfg-1800-360',
    chunkSize: 1800,
    overlap: 360,
    minChunkSize: 350,
  },
];

function parseArgs(argv) {
  const args = {
    evalPath: 'eval/recall/eval-set.small.json',
    k: 5,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--eval' && argv[i + 1]) {
      args.evalPath = argv[i + 1];
    }
    if (arg === '--k' && argv[i + 1]) {
      args.k = Number(argv[i + 1]);
    }
  }

  return args;
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
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
  } catch {
    // Ignore missing env file.
  }
}

function ensureEnv() {
  const required = [
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }
}

function normalizeExtractedText(text) {
  if (!text) return '';

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])-\n([A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1$2')
    .replace(/[\uFB00]/g, 'ff')
    .replace(/[\uFB01]/g, 'fi')
    .replace(/[\uFB02]/g, 'fl')
    .replace(/[\uFB03]/g, 'ffi')
    .replace(/[\uFB04]/g, 'ffl')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  return stripLikelyPdfBoilerplate(normalized);
}

function stripLikelyPdfBoilerplate(text) {
  const lines = text.split('\n');
  if (lines.length < 20) {
    return text;
  }

  const lineFrequency = new Map();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    lineFrequency.set(line, (lineFrequency.get(line) || 0) + 1);
  }

  const shouldDropRepeatedLine = (line) => {
    const count = lineFrequency.get(line) || 0;
    if (count < 3) return false;
    if (line.length > 80) return false;
    if (/[:;,.!?]$/.test(line)) return false;
    if (/^\d+[.)]\s+/.test(line)) return false;
    return true;
  };

  const shouldDropPageNumberLine = (line) => {
    return (
      /^(page\s+)?\d+$/i.test(line) ||
      /^\d+\s*\/\s*\d+$/i.test(line) ||
      /^[-–—]?\s*\d+\s*[-–—]?$/.test(line)
    );
  };

  const filtered = lines.filter((rawLine) => {
    const line = rawLine.trim();
    if (!line) return false;
    if (shouldDropPageNumberLine(line)) return false;
    if (shouldDropRepeatedLine(line)) return false;
    return true;
  });

  return filtered
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getOverlapText(text, overlapSize) {
  if (text.length <= overlapSize) {
    return text;
  }

  const overlapText = text.slice(-overlapSize);
  const sentenceMatch = overlapText.match(/[.!?]\s+/);
  if (sentenceMatch && sentenceMatch.index !== undefined) {
    return overlapText.slice(sentenceMatch.index + sentenceMatch[0].length);
  }

  return overlapText;
}

function splitLongParagraph(paragraph, chunkSize, overlap) {
  const chunks = [];
  const sentences = paragraph.split(/(?<=[.!?])\s+/);

  let currentChunk = '';
  let previousChunk = '';

  for (const sentence of sentences) {
    const potentialChunk = currentChunk
      ? `${currentChunk} ${sentence}`
      : sentence;

    if (potentialChunk.length <= chunkSize) {
      currentChunk = potentialChunk;
    } else if (currentChunk) {
      chunks.push(currentChunk);
      previousChunk = currentChunk;
      const overlapText = getOverlapText(previousChunk, overlap);
      currentChunk = overlapText ? `${overlapText} ${sentence}` : sentence;
    } else {
      const words = sentence.split(/\s+/);
      let wordChunk = '';

      for (const word of words) {
        const candidate = wordChunk ? `${wordChunk} ${word}` : word;
        if (candidate.length <= chunkSize) {
          wordChunk = candidate;
        } else {
          if (wordChunk) chunks.push(wordChunk);
          wordChunk = word;
        }
      }

      if (wordChunk) currentChunk = wordChunk;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function mergeSmallChunks(chunks, minChunkSize) {
  if (chunks.length <= 1 || minChunkSize <= 0) {
    return chunks;
  }

  const merged = [];
  for (const chunk of chunks) {
    if (merged.length === 0) {
      merged.push(chunk);
      continue;
    }

    if (chunk.length < minChunkSize) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }

  if (merged.length > 1 && merged[merged.length - 1].length < minChunkSize) {
    const tail = merged.pop();
    if (tail) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${tail}`;
    }
  }

  return merged;
}

function chunkText(text, config) {
  if (!text || !text.trim()) {
    return [];
  }

  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (normalizedText.length <= config.chunkSize) {
    return [normalizedText];
  }

  const chunks = [];
  const paragraphs = normalizedText.split(/\n\n+/);

  let currentChunk = '';
  let previousChunk = '';

  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) continue;

    const potentialChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (potentialChunk.length <= config.chunkSize) {
      currentChunk = potentialChunk;
    } else if (currentChunk) {
      chunks.push(currentChunk);
      previousChunk = currentChunk;
      const overlapText = getOverlapText(previousChunk, config.overlap);
      currentChunk = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;
    } else {
      const split = splitLongParagraph(
        paragraph,
        config.chunkSize,
        config.overlap
      );
      chunks.push(...split.slice(0, -1));
      currentChunk = split[split.length - 1];
      previousChunk = currentChunk;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  const cleanedChunks = chunks.filter((chunk) => chunk.trim().length > 0);
  return mergeSmallChunks(cleanedChunks, config.minChunkSize);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedBatch(openai, texts, batchSize = 100) {
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      encoding_format: 'float',
    });

    allEmbeddings.push(...response.data.map((item) => item.embedding));

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allEmbeddings;
}

function getRelevantChunkIndexes(chunks, expectedSnippets) {
  const indexes = new Set();

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i].toLowerCase();
    for (const snippet of expectedSnippets) {
      if (chunk.includes(snippet.toLowerCase())) {
        indexes.add(i);
      }
    }
  }

  return indexes;
}

async function fetchPdfText(supabase, documentId) {
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('id, storage_path, status')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  if (document.status !== 'ready') {
    throw new Error(`Document is not ready: ${documentId}`);
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for ${documentId}: ${signedUrlError?.message || 'unknown error'}`
    );
  }

  const parser = new PDFParse({ url: signedUrlData.signedUrl });
  try {
    const textResult = await parser.getText();
    if (!textResult?.text?.trim()) {
      throw new Error(`No text extracted from PDF for document ${documentId}`);
    }
    return textResult.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function main() {
  // Node scripts do not auto-load Next.js env files.
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  ensureEnv();
  const { evalPath, k } = parseArgs(process.argv);

  if (!Number.isInteger(k) || k <= 0) {
    throw new Error('Argument --k must be a positive integer');
  }

  const evalRaw = await fs.readFile(evalPath, 'utf8');
  const evalSet = JSON.parse(evalRaw);

  if (!Array.isArray(evalSet.cases) || evalSet.cases.length === 0) {
    throw new Error('Eval set must contain a non-empty "cases" array');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const uniqueDocIds = [...new Set(evalSet.cases.map((c) => c.documentId))];
  const normalizedTextByDoc = new Map();

  for (const documentId of uniqueDocIds) {
    const rawText = await fetchPdfText(supabase, documentId);
    normalizedTextByDoc.set(documentId, normalizeExtractedText(rawText));
  }

  const queryEmbeddingByText = new Map();
  for (const testCase of evalSet.cases) {
    if (!queryEmbeddingByText.has(testCase.query)) {
      const queryEmbeddings = await embedBatch(openai, [testCase.query], 1);
      queryEmbeddingByText.set(testCase.query, queryEmbeddings[0]);
    }
  }

  const results = [];

  for (const config of DEFAULT_CONFIGS) {
    const chunksByDoc = new Map();
    const embeddingsByDoc = new Map();

    for (const documentId of uniqueDocIds) {
      const text = normalizedTextByDoc.get(documentId);
      const chunks = chunkText(text, config);
      const embeddings = await embedBatch(openai, chunks, 100);
      chunksByDoc.set(documentId, chunks);
      embeddingsByDoc.set(documentId, embeddings);
    }

    let macroRecall = 0;
    let hitAtK = 0;
    let evaluatedCases = 0;

    for (const testCase of evalSet.cases) {
      const chunks = chunksByDoc.get(testCase.documentId);
      const chunkEmbeddings = embeddingsByDoc.get(testCase.documentId);
      const queryEmbedding = queryEmbeddingByText.get(testCase.query);

      if (!chunks || !chunkEmbeddings || !queryEmbedding) {
        continue;
      }

      const relevantIndexes = getRelevantChunkIndexes(
        chunks,
        testCase.expectedSnippets
      );

      if (relevantIndexes.size === 0) {
        console.warn(
          `Skipping case ${testCase.id}: no chunk contained expected snippets for this config.`
        );
        continue;
      }

      const ranked = chunkEmbeddings
        .map((embedding, index) => ({
          index,
          score: cosineSimilarity(queryEmbedding, embedding),
        }))
        .sort((a, b) => b.score - a.score);

      const topK = ranked.slice(0, k).map((item) => item.index);
      const retrievedRelevant = topK.filter((index) =>
        relevantIndexes.has(index)
      ).length;

      const recall = retrievedRelevant / relevantIndexes.size;
      macroRecall += recall;
      if (retrievedRelevant > 0) {
        hitAtK += 1;
      }
      evaluatedCases += 1;
    }

    const recallAtK = evaluatedCases > 0 ? macroRecall / evaluatedCases : 0;
    const hitRateAtK = evaluatedCases > 0 ? hitAtK / evaluatedCases : 0;

    results.push({
      config: config.name,
      chunkSize: config.chunkSize,
      overlap: config.overlap,
      minChunkSize: config.minChunkSize,
      cases: evaluatedCases,
      recallAtK: Number(recallAtK.toFixed(4)),
      hitRateAtK: Number(hitRateAtK.toFixed(4)),
    });
  }

  results.sort((a, b) => b.recallAtK - a.recallAtK);

  console.log('\nRecall tuning results\n');
  for (const result of results) {
    console.log(
      `${result.config} | chunk=${result.chunkSize} overlap=${result.overlap} min=${result.minChunkSize} | Recall@${k}=${result.recallAtK} | Hit@${k}=${result.hitRateAtK} | cases=${result.cases}`
    );
  }

  if (results.length > 0) {
    console.log('\nBest config by Recall@K\n');
    console.log(results[0]);
  }

  await fs.mkdir('eval/recall', { recursive: true });
  await fs.writeFile(
    'eval/recall/results.latest.json',
    JSON.stringify(
      {
        k,
        evaluatedAt: new Date().toISOString(),
        results,
      },
      null,
      2
    ),
    'utf8'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
