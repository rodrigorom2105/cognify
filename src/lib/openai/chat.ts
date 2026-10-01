import { RateLimitError } from 'openai';
import { openai } from './client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RAGContext {
  chunks: Array<{
    content: string;
    chunk_index: number;
    similarity: number;
  }>;
  documentName: string;
}

/**
 * Build the system prompt for RAG-based Q&A
 */
function buildSystemPrompt(context: RAGContext): string {
  const chunksText = context.chunks.map(
    (chunk, index) =>
      `[Source ${index + 1}] (chunk ${chunk.chunk_index}, semantic score: ${chunk.similarity.toFixed(3)})\n${chunk.content}`
  );

  return `You are a helpful assistant that answers questions based strictly on the provided document context.
    Document: "${context.documentName}"

    Context:
    ${chunksText}

    Rules:
    - Answer ONLY based on the context above
    - If the answer is not in the context, say "I couldn't find that information in this document"
    - Be concise and precise
    - Reference sources by their [Source N] label when relevant`;
}

/**
 * Token counts reported by OpenAI for a single completion.
 *
 * Kept split because input and output tokens are priced differently, so a
 * total alone is not enough to derive cost.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Wall-clock timestamps (ms since epoch) for a streamed completion.
 *
 * `firstTokenAt` is null when the model produced no content at all.
 */
export interface StreamTiming {
  startedAt: number;
  firstTokenAt: number | null;
  completedAt: number;
}

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

/**
 * Stream a RAG-based chat completion.
 *
 * Throws if OpenAI rejects the request before streaming starts (for example a
 * RateLimitError); use `isRateLimitError` to tell that case apart.
 *
 * Usage is returned as a promise, not a number: OpenAI only reports token
 * counts in a final chunk that arrives after the whole answer has streamed,
 * which is long after this function returns. Callers must await `usage`
 * *after* the stream has been consumed, or it will never settle.
 */
export async function streamRAGAnswer(
  query: string,
  context: RAGContext
): Promise<{
  stream: ReadableStream;
  usage: Promise<TokenUsage>;
  timing: Promise<StreamTiming>;
}> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: query },
  ];

  let settleUsage: (usage: TokenUsage) => void;
  const usage = new Promise<TokenUsage>((resolve) => {
    settleUsage = resolve;
  });

  // Settled alongside `usage`, so it carries the same await-after-drain rule.
  let settleTiming: (timing: StreamTiming) => void;
  const timing = new Promise<StreamTiming>((resolve) => {
    settleTiming = resolve;
  });

  // Open the completion before building the stream, not inside start(). A
  // request OpenAI rejects up front (a 429 when the account's tokens-per-minute
  // limit is used up) then throws here, where the route can answer with a
  // clear error. Thrown inside start(), it errored a stream whose response had
  // already begun, and Next.js answered with a bare HTML 500 page.
  const startedAt = Date.now();
  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages,
      stream: true,
      // Without this OpenAI never emits a usage chunk on a streamed
      // completion, and every token count silently records as 0.
      stream_options: { include_usage: true },
      temperature: 0.3,
      // OpenAI counts max_tokens against the per-minute token limit before
      // the answer is generated. The longest answer in the load test was 632
      // tokens, so 1,000 reserved ~370 tokens per question for nothing.
      max_tokens: 700,
    },
    // The SDK retries 429s with backoff and honours Retry-After; the default
    // of 2 retries was too few to outlast a burst at 14 concurrent users.
    { maxRetries: 4 }
  );

  const stream = new ReadableStream({
    async start(controller) {
      // Whatever was captured before a failure is still worth recording.
      let captured: TokenUsage = EMPTY_USAGE;
      let firstTokenAt: number | null = null;

      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            firstTokenAt ??= Date.now();
            controller.enqueue(new TextEncoder().encode(delta));
          }

          // Usage arrives in a final chunk that carries no content.
          if (chunk.usage) {
            captured = {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            };
          }
        }

        controller.close();
        settleUsage(captured);
        settleTiming({ startedAt, firstTokenAt, completedAt: Date.now() });
      } catch (error) {
        // Settle before erroring the stream so an awaiting caller cannot hang.
        settleUsage(captured);
        settleTiming({ startedAt, firstTokenAt, completedAt: Date.now() });
        controller.error(error);
      }
    },
  });

  return { stream, usage, timing };
}

/**
 * True when an error, or the error it wraps, is OpenAI rejecting a request
 * for exceeding the account's rate limit (HTTP 429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  return error instanceof Error && error.cause instanceof RateLimitError;
}
