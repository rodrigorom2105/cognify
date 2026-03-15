import { openai } from "./client";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
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
      `[Source ${index + 1}] (chunk ${chunk.chunk_index}, relevance: ${(chunk.similarity * 100).toFixed(1)}%)\n${chunk.content}`
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
 * Stream a RAG-based chat completion
 */
export async function streamRAGAnswer(
  query: string,
  context: RAGContext
): Promise<{ stream: ReadableStream; tokenUsed: number }> {
  const messages: ChatMessage[] = [
    {role: "system", content: buildSystemPrompt(context)},
    {role: "user", content: query}
  ];

  let tokenUsed = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          stream: true,
          temperature: 0.3,
          max_tokens: 1000,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(new TextEncoder().encode(delta));
          }

          // Capture usage from final chunk
          if (chunk.usage) {
            tokenUsed = chunk.usage.total_tokens;
          }
        }

        controller.close();
      }
      catch (error) {
        controller.error(error);
      }
    }
  });

  return { stream, tokenUsed };
}