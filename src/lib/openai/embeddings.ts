import { openai } from './client';

/**
 * Generate embeddings for an array of text chunks
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 *
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors (number[][])
 * @throws Error if OpenAI API fails
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error('OpenAI Embedding Error:', error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings in batches to avoid rate limits
 * Recommended batch size: 100 chunks per request
 *
 * @param texts - Array of text strings to embed
 * @param batchSize - Number of texts per batch (default: 100)
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsInBatches(
  texts: string[],
  batchSize: number = 100
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(
      `Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`
    );

    const batchEmbeddings = await generateEmbeddings(batch);
    allEmbeddings.push(...batchEmbeddings);

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay between batches
    }
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query string
 * Useful for RAG query execution
 * 
 * @param text - Single text string to embed
 * @returns Single embedding vector
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}