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

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

/**
 * Stream a RAG-based chat completion.
 *
 * Usage is returned as a promise, not a number: OpenAI only reports token
 * counts in a final chunk that arrives after the whole answer has streamed,
 * which is long after this function returns. Callers must await `usage`
 * *after* the stream has been consumed, or it will never settle.
 */
export async function streamRAGAnswer(
  query: string,
  context: RAGContext
): Promise<{ stream: ReadableStream; usage: Promise<TokenUsage> }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: query },
  ];

  let settleUsage: (usage: TokenUsage) => void;
  const usage = new Promise<TokenUsage>((resolve) => {
    settleUsage = resolve;
  });

  const stream = new ReadableStream({
    async start(controller) {
      // Whatever was captured before a failure is still worth recording.
      let captured: TokenUsage = EMPTY_USAGE;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          stream: true,
          // Without this OpenAI never emits a usage chunk on a streamed
          // completion, and every token count silently records as 0.
          stream_options: { include_usage: true },
          temperature: 0.3,
          max_tokens: 1000,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
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
      } catch (error) {
        // Settle before erroring the stream so an awaiting caller cannot hang.
        settleUsage(captured);
        controller.error(error);
      }
    },
  });

  return { stream, usage };
}
